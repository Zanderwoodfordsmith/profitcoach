import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SUPPORT_SCHEDULE_MIN_LEAD_MS,
  assertFutureSchedule,
} from "./scheduledReplies";

describe("assertFutureSchedule", () => {
  const now = Date.parse("2026-10-02T08:00:00.000Z");

  it("accepts a time at least a minute ahead", () => {
    const iso = new Date(now + SUPPORT_SCHEDULE_MIN_LEAD_MS).toISOString();
    assert.equal(assertFutureSchedule(iso, now).toISOString(), iso);
  });

  it("rejects the past and the next few seconds", () => {
    assert.throws(
      () => assertFutureSchedule(new Date(now + 30_000).toISOString(), now),
      /at least one minute/
    );
  });

  it("rejects a bad timestamp", () => {
    assert.throws(() => assertFutureSchedule("not-a-date", now), /Invalid/);
  });
});
