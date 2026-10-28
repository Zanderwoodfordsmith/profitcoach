import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TODAY, WITH_SCRIPTS, formatCount, funnelOf, messagesPerClient } from "./coachLevers";

describe("coach levers", () => {
  it("today: 1,000 messages for one client", () => {
    assert.equal(formatCount(messagesPerClient(TODAY)!), "1,000");
    const f = funnelOf(TODAY, 1000);
    assert.deepEqual([f.interested, f.calls, f.fits].map(formatCount), ["10", "5", "4"]);
    assert.equal(formatCount(f.clients), "1");
  });

  it("the new calls alone: 250 messages, so 4x", () => {
    assert.equal(formatCount(messagesPerClient({ ...WITH_SCRIPTS, interest: TODAY.interest })!), "250");
  });

  it("with more yeses too: 100 messages, so 10x", () => {
    assert.equal(formatCount(messagesPerClient(WITH_SCRIPTS)!), "100");
  });

  it("a rate of 0 means no clients", () => {
    assert.equal(messagesPerClient({ ...TODAY, close: 0 }), null);
  });
});
