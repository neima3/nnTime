import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import {
  createEphemeralDb,
  insertUser,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "../db/test-db";
import { pushSubscriptions } from "../db/schema";

const webPushMocks = vi.hoisted(() => ({
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock("web-push", () => ({
  default: webPushMocks,
}));

import { sendToUser } from "./push";

let env: EphemeralDb | null = null;
let dbAvailable = false;

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
  } catch (error) {
    rethrowIfMigrationFailure(error);
  }
}, 60_000);

afterAll(async () => {
  await env?.teardown();
}, 60_000);

beforeEach(() => {
  process.env.VAPID_PUBLIC_KEY = "test-public-key";
  process.env.VAPID_PRIVATE_KEY = "test-private-key";
  webPushMocks.sendNotification.mockReset();
  webPushMocks.setVapidDetails.mockClear();
});

afterEach(() => {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
});

const itDb = (name: string, fn: () => Promise<void>) =>
  it(name, async () => {
    if (!dbAvailable || !env) return;
    await fn();
  });

async function seedSubscriptions(count: number) {
  if (!env) throw new Error("DB unavailable");
  const userId = uuidv7();
  await insertUser(env.db, userId);
  for (let index = 0; index < count; index++) {
    await env.db.insert(pushSubscriptions).values({
      id: uuidv7(),
      userId,
      endpoint: `https://push.invalid/${userId}/${index}`,
      keys: { p256dh: `key-${index}`, auth: `auth-${index}` },
    });
  }
  return userId;
}

const PAYLOAD = {
  title: "Review today",
  body: "A quiet moment to close the loop on your day.",
  tag: "review-today",
  url: "/app/review",
};

describe.sequential("sendToUser", () => {
  itDb("reports unconfigured transport without querying or sending", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    const userId = await seedSubscriptions(1);

    await expect(sendToUser(userId, PAYLOAD, { db: env!.db })).resolves.toEqual({
      configured: false,
      subscriptions: 0,
      sent: 0,
      pruned: 0,
      retryableFailures: 0,
    });
    expect(webPushMocks.sendNotification).not.toHaveBeenCalled();
  });

  itDb("classifies success, stale subscription, and transient failure", async () => {
    const userId = await seedSubscriptions(3);
    webPushMocks.sendNotification
      .mockResolvedValueOnce({ statusCode: 201 })
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockRejectedValueOnce(new Error("network unavailable"));

    const result = await sendToUser(userId, PAYLOAD, {
      db: env!.db,
      sendNotification: webPushMocks.sendNotification,
    });

    expect(result).toEqual({
      configured: true,
      subscriptions: 3,
      sent: 1,
      pruned: 1,
      retryableFailures: 1,
    });
    const live = await env!.db
      .select()
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          isNull(pushSubscriptions.deletedAt),
        ),
      );
    expect(live).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain("push.invalid");
  });

  itDb("treats 404 and 410 as stale but 429 and 500 as retryable", async () => {
    const userId = await seedSubscriptions(4);
    webPushMocks.sendNotification
      .mockRejectedValueOnce({ statusCode: 404 })
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockRejectedValueOnce({ statusCode: 429 })
      .mockRejectedValueOnce({ statusCode: 500 });

    await expect(
      sendToUser(userId, PAYLOAD, {
        db: env!.db,
        sendNotification: webPushMocks.sendNotification,
      }),
    ).resolves.toEqual({
      configured: true,
      subscriptions: 4,
      sent: 0,
      pruned: 2,
      retryableFailures: 2,
    });
  });

  itDb("bounds provider requests and sends subscriptions concurrently", async () => {
    const userId = await seedSubscriptions(2);
    const releases: Array<() => void> = [];
    webPushMocks.sendNotification.mockImplementation(
      () =>
        new Promise((resolve) => {
          releases.push(() => resolve({ statusCode: 201 }));
        }),
    );

    const delivery = sendToUser(userId, PAYLOAD, {
      db: env!.db,
      sendNotification: webPushMocks.sendNotification,
    });
    await vi.waitFor(() => {
      expect(webPushMocks.sendNotification).toHaveBeenCalledTimes(2);
    });
    for (const release of releases) release();

    await expect(delivery).resolves.toMatchObject({ sent: 2 });
    for (const call of webPushMocks.sendNotification.mock.calls) {
      expect(call[2]).toMatchObject({ timeout: 30_000 });
    }
  });

  itDb("reports an empty live subscription set honestly", async () => {
    const userId = await seedSubscriptions(0);
    await expect(sendToUser(userId, PAYLOAD, { db: env!.db })).resolves.toEqual({
      configured: true,
      subscriptions: 0,
      sent: 0,
      pruned: 0,
      retryableFailures: 0,
    });
    expect(webPushMocks.sendNotification).not.toHaveBeenCalled();
  });
});
