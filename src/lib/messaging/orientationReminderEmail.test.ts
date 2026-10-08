import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  orientationReminderHtml,
  orientationReminderSequence,
  orientationReminderSubject,
  orientationReminderText,
} from "./orientationReminderEmail";

const sample = {
  stepId: "confirmation",
  firstName: "Alex",
  when: "Tuesday, 14 October 2026, 10:00 am BST",
  joinUrl: "https://theprofitcoach.com/zoom-pam",
  startsAtIso: "2026-10-14T09:00:00.000Z",
  endsAtIso: "2026-10-14T09:30:00.000Z",
  calendarEventCreated: true,
};

describe("orientation reminders", () => {
  it("points the booking email at welcome, the short questions, and Pick Your Path", () => {
    const text = orientationReminderText(sample);
    const html = orientationReminderHtml(sample);
    assert.match(text, /short questions/i);
    assert.match(text, /Start Here/);
    assert.match(text, /Pick Your Path/);
    assert.match(text, /theprofitcoach\.com\/zoom-pam/);
    assert.doesNotMatch(text, /practice setup/i);
    assert.match(html, /\/welcome/);
    assert.match(html, /welcome-questions\.png/);
    assert.match(html, /start-here\.png/);
    assert.match(html, /pick-your-path\.png/);
    assert.match(html, /location=https/);
    assert.equal(
      orientationReminderSubject("confirmation"),
      "You're booked — orientation call with Pam"
    );
  });

  it("keeps the day-before and hour-before notes short", () => {
    const day = orientationReminderText({ ...sample, stepId: "24h" });
    const dayHtml = orientationReminderHtml({ ...sample, stepId: "24h" });
    const hour = orientationReminderText({ ...sample, stepId: "1h" });
    const hourHtml = orientationReminderHtml({ ...sample, stepId: "1h" });

    assert.match(day, /How are you getting on/i);
    assert.match(day, /theprofitcoach\.com\/zoom-pam/);
    assert.doesNotMatch(day, /Pick Your Path/);
    assert.doesNotMatch(day, /welcome video/i);
    assert.doesNotMatch(dayHtml, /welcome-questions\.png/);

    assert.match(hour, /about an hour/);
    assert.match(hour, /theprofitcoach\.com\/zoom-pam/);
    assert.doesNotMatch(hour, /Pick Your Path/);
    assert.doesNotMatch(hour, /How are you getting on/i);
    assert.doesNotMatch(hourHtml, /\.png/);
    assert.equal(
      orientationReminderSubject("1h"),
      "In an hour: orientation call with Pam"
    );
  });

  it("schedules a confirmation, one day, and one hour", () => {
    const minutes = orientationReminderSequence().map((step) => step.minutes_before);
    assert.deepEqual(minutes, [0, 24 * 60, 60]);
    assert.deepEqual(
      orientationReminderSequence().map((step) => step.id),
      ["confirmation", "24h", "1h"]
    );
    assert.equal(
      orientationReminderSequence().every((step) => step.email && !step.sms),
      true
    );
  });
});
