import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("durable notification regression contract", () => {
  it("keeps computed jobs out of append-only planner history", () => {
    const notifications = source("src/server/services/notifications.ts");
    expect(notifications).not.toContain("plannerEvents");
    expect(notifications).toContain("schema.notificationJobs");
  });

  it("removes the legacy planner-event delivery wrapper", () => {
    const push = source("src/server/services/push.ts");
    expect(push).not.toContain("deliverDueNudges");
    expect(push).not.toContain("plannerEvents");
    expect(push).toContain("retryableFailures");
  });

  it("does not swallow notification computation or delivery failures", () => {
    const route = source("src/app/api/v1/jobs/tick/route.ts");
    expect(route).not.toContain("notification tick failed");
    expect(route).not.toContain("push delivery failed");
    expect(route).not.toContain("notificationsError");
    expect(route).toContain("failSchedulerRun");
    expect(route).toContain('error: "scheduler tick failed"');
  });

  it("locks payload coverage for every ADR-004 notification type", () => {
    const policyTest = source(
      "src/server/services/notification-policy.test.ts",
    );
    for (const type of [
      "start",
      "halfway",
      "wrap-up",
      "review-today",
      "weekly-review",
    ]) {
      expect(policyTest).toContain(`"${type}"`);
    }
  });

  it("keeps reminder timing and lock-screen privacy user-configurable", () => {
    const settings = source("src/components/SettingsClient.tsx");
    for (const key of [
      "startOffsetMin",
      "halfwayOffsetMin",
      "wrapUpOffsetMin",
      "hideActivityTitlesOnLockScreen",
    ]) {
      expect(settings).toContain(key);
    }
    expect(settings).toContain("Hide activity names on lock screen");
    expect(settings).toContain("Start reminder timing");
    expect(settings).toContain("Halfway reminder timing");
    expect(settings).toContain("Wrap-up reminder timing");
  });

  it("adds infrastructure without rewriting production planner history", () => {
    const migration = source(
      "drizzle/0009_durable_notification_jobs.sql",
    );
    expect(migration).not.toMatch(/^\s*DELETE\s+FROM\b/im);
    expect(migration).not.toMatch(/^\s*TRUNCATE\b/im);
    expect(migration).not.toMatch(
      /^\s*UPDATE\s+"?planner_events"?\b/im,
    );
    expect(migration).toContain('CREATE TABLE "notification_jobs"');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "notification_jobs_dedup_idx"',
    );
  });
});
