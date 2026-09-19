import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { supportAttentionBadgeCount } from "./adminAttention";

describe("supportAttentionBadgeCount", () => {
  it("is 0 when the ticket is not in the attention set", () => {
    assert.equal(supportAttentionBadgeCount(undefined), 0);
  });

  it("shows 1 for an unread new ticket with no follow-up replies", () => {
    assert.equal(
      supportAttentionBadgeCount({ unreadReplies: 0, mention: false }),
      1
    );
  });

  it("shows follow-up volume when someone else has replied", () => {
    assert.equal(
      supportAttentionBadgeCount({ unreadReplies: 3, mention: false }),
      3
    );
  });

  it("shows 1 for an unread mention with no follow-up replies", () => {
    assert.equal(
      supportAttentionBadgeCount({ unreadReplies: 0, mention: true }),
      1
    );
  });
});
