import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bookingEventAttendees } from "./bookingEventAttendees";

describe("bookingEventAttendees", () => {
  it("includes the guest and Pam, once each", () => {
    const attendees = bookingEventAttendees({
      guestEmail: "Alex@Example.com",
      guestName: "Alex Coach",
      extra: [{ email: "pam@businesscoachacademy.com", name: "Pam" }],
    });
    assert.deepEqual(
      attendees.map((row) => row.email),
      ["alex@example.com", "pam@businesscoachacademy.com"]
    );
  });

  it("does not invite Pam twice when she is the guest", () => {
    const attendees = bookingEventAttendees({
      guestEmail: "pam@businesscoachacademy.com",
      guestName: "Pam",
      extra: [{ email: "Pam@businesscoachacademy.com", name: "Pam" }],
    });
    assert.equal(attendees.length, 1);
  });
});
