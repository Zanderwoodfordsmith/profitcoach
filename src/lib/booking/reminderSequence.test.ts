import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_REMINDER_SEQUENCE,
  sentReminderStepIds,
} from "./reminderSequence";

describe("sentReminderStepIds", () => {
  it("does not treat a sent 24h reminder as the 2-hour step", () => {
    const ids = sentReminderStepIds({
      reminderSends: { "24h": "2026-09-29T13:30:16.751Z" },
      reminderSentAt: "2026-09-29T13:30:16.751Z",
      sequence: DEFAULT_REMINDER_SEQUENCE,
    });
    assert.equal(ids.has("24h"), true);
    assert.equal(ids.has("2h"), false);
  });

  it("still treats a legacy reminder_sent_at with no step map as the 2-hour step", () => {
    const ids = sentReminderStepIds({
      reminderSends: {},
      reminderSentAt: "2026-09-16T11:48:26.454Z",
      sequence: DEFAULT_REMINDER_SEQUENCE,
    });
    assert.equal(ids.has("2h"), true);
    assert.equal(ids.has("24h"), false);
  });
});
