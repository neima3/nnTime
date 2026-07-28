import { describe, expect, it } from "vitest";
import { assertQueueOwner } from "../lib/queue-ownership";

describe("queued mutation ownership", () => {
  it("accepts a queued mutation only for the authenticated owner", () => {
    expect(() => assertQueueOwner("user-a", "user-a")).not.toThrow();
    expect(() => assertQueueOwner("user-a", null)).not.toThrow();
  });

  it("fails closed when a queued mutation reaches another account", async () => {
    let thrown: unknown;
    try {
      assertQueueOwner("user-b", "user-a");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Response);
    const response = thrown as Response;
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "queue_owner_mismatch", retryable: false },
    });
  });
});
