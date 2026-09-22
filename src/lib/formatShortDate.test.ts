import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatDayLabel,
  formatUpcomingDayLabel,
} from "./formatShortDate";

describe("formatUpcomingDayLabel", () => {
  const now = new Date(2026, 8, 22, 12, 0, 0); // Tue 22 Sep 2026 local

  it("labels today and overdue as Today", () => {
    assert.equal(
      formatUpcomingDayLabel(new Date(2026, 8, 22, 8, 0, 0).toISOString(), now),
      "Today"
    );
    assert.equal(
      formatUpcomingDayLabel(new Date(2026, 8, 21, 18, 0, 0).toISOString(), now),
      "Today"
    );
  });

  it("labels tomorrow", () => {
    assert.equal(
      formatUpcomingDayLabel(new Date(2026, 8, 23, 9, 0, 0).toISOString(), now),
      "Tomorrow"
    );
  });

  it("labels weekdays within the next week", () => {
    assert.equal(
      formatUpcomingDayLabel(new Date(2026, 8, 25, 9, 0, 0).toISOString(), now),
      "Friday"
    );
    assert.equal(
      formatUpcomingDayLabel(new Date(2026, 8, 28, 9, 0, 0).toISOString(), now),
      "Monday"
    );
  });

  it("falls back to short date beyond a week", () => {
    assert.equal(
      formatUpcomingDayLabel(new Date(2026, 8, 30, 9, 0, 0).toISOString(), now),
      "30 Sep"
    );
  });
});

describe("formatDayLabel", () => {
  it("still uses Yesterday for the past", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(15, 0, 0, 0);
    assert.equal(formatDayLabel(yesterday.toISOString()), "Yesterday");
  });
});
