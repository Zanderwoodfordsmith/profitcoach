import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  changedShare,
  settleConfidence,
  suggestionTargetAt,
} from "./replySuggestionRules";

const ticket = {
  status: "open",
  source: "direct",
  created_at: "2026-11-06T10:00:00Z",
  created_by: "coach",
};
const fromCoach = { created_at: "2026-11-06T11:00:00Z", created_by: "coach", author_role: "coach" };
const fromStaff = { created_at: "2026-11-06T12:00:00Z", created_by: "zander", author_role: "admin" };

describe("suggestionTargetAt", () => {
  it("answers the opening message when nobody has replied", () => {
    assert.equal(suggestionTargetAt({ ticket, replies: [] }), ticket.created_at);
  });

  it("answers the coach's latest message", () => {
    assert.equal(
      suggestionTargetAt({ ticket, replies: [fromStaff, fromCoach] }),
      fromCoach.created_at
    );
  });

  it("does nothing when BCA has the last word", () => {
    assert.equal(suggestionTargetAt({ ticket, replies: [fromCoach, fromStaff] }), null);
  });

  it("does nothing on a finished chat, or one BCA started", () => {
    assert.equal(suggestionTargetAt({ ticket: { ...ticket, status: "resolved" }, replies: [] }), null);
    assert.equal(
      suggestionTargetAt({ ticket: { ...ticket, source: "admin_created" }, replies: [] }),
      null
    );
  });

  it("treats a guest's email reply as theirs", () => {
    const guest = { ...ticket, created_by: null };
    const reply = { created_at: "2026-11-06T13:00:00Z", created_by: null, author_role: null };
    assert.equal(suggestionTargetAt({ ticket: guest, replies: [reply] }), reply.created_at);
  });
});

describe("settleConfidence", () => {
  it("drops to low when the draft still has a gap to fill", () => {
    assert.equal(settleConfidence("high", "I fixed it by [what I changed]."), "low");
  });

  it("leaves it alone for a normal link", () => {
    assert.equal(settleConfidence("high", "See [Billing](https://x.com/billing)."), "high");
  });
});

describe("changedShare", () => {
  it("is 0 when sent as written and 1 when all new", () => {
    assert.equal(changedShare("Hi Bruce, thanks.", "hi bruce thanks"), 0);
    assert.equal(changedShare("one two", "three four"), 1);
  });

  it("sits between for an edit", () => {
    const share = changedShare("one two three four", "one two three five");
    assert.ok(share > 0 && share < 0.5);
  });
});
