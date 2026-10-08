import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { intervalsOverlapWithBuffer } from "./computeBookingSlots";
import {
  clampBookingDurationMinutes,
  directBookingWindow,
  directSlotConflicts,
} from "./directBookingSlot";

describe("clampBookingDurationMinutes", () => {
  it("keeps a custom length inside 5–180 minutes", () => {
    assert.equal(clampBookingDurationMinutes(45, 20), 45);
    assert.equal(clampBookingDurationMinutes(1, 20), 5);
    assert.equal(clampBookingDurationMinutes(400, 20), 180);
    assert.equal(clampBookingDurationMinutes(undefined, 20), 20);
  });
});

describe("directBookingWindow", () => {
  const now = new Date("2026-10-08T09:00:00.000Z");

  it("ends after the requested length", () => {
    const window = directBookingWindow({
      startsAt: "2026-10-09T09:00:00.000Z",
      durationMinutes: 45,
      now,
    });
    assert.equal(window.ok, true);
    if (!window.ok) return;
    assert.equal(window.end.toISOString(), "2026-10-09T09:45:00.000Z");
  });

  it("rejects a time that has already passed", () => {
    const window = directBookingWindow({
      startsAt: "2026-10-08T08:00:00.000Z",
      durationMinutes: 20,
      now,
    });
    assert.equal(window.ok, false);
  });
});

describe("directSlotConflicts", () => {
  const start = new Date("2026-10-09T09:00:00.000Z");
  const end = new Date("2026-10-09T09:45:00.000Z");

  it("allows a longer call when nothing else is booked", () => {
    assert.equal(
      directSlotConflicts({
        start,
        end,
        existing: [],
        bufferMinutes: 0,
      }),
      false
    );
  });

  it("blocks a longer call that runs into the next booking", () => {
    assert.equal(
      directSlotConflicts({
        start,
        end,
        existing: [
          {
            starts_at: "2026-10-09T09:30:00.000Z",
            ends_at: "2026-10-09T09:50:00.000Z",
          },
        ],
        bufferMinutes: 0,
      }),
      true
    );
  });

  it("treats buffer as occupied time around this call", () => {
    assert.equal(
      intervalsOverlapWithBuffer(
        start.getTime(),
        new Date("2026-10-09T09:20:00.000Z").getTime(),
        [
          {
            starts_at: "2026-10-09T09:30:00.000Z",
            ends_at: "2026-10-09T09:50:00.000Z",
          },
        ],
        15
      ),
      true
    );
  });
});
