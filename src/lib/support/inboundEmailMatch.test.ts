import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inboundMightBeSupportFollowUp,
  isInactiveSupportMailboxEmail,
  normalizeSupportEmailSubject,
  shouldSkipInactiveSupportEmail,
} from "./inboundEmailMatch";

describe("support inbound email matching", () => {
  it("treats Gmail Important mail with no inbox as filed away", () => {
    const peter = {
      role: "important",
      folders: ["IMPORTANT", "CATEGORY_PERSONAL"],
      subject: "Re: Incompetence, confusion & ineptitude",
      in_reply_to: { id: "parent", message_id: "<parent@mail>" },
    };
    assert.equal(isInactiveSupportMailboxEmail(peter), true);
    assert.equal(inboundMightBeSupportFollowUp(peter), true);
    assert.equal(shouldSkipInactiveSupportEmail(peter), false);
  });

  it("keeps unread personal mail that Unipile reports without an inbox label", () => {
    assert.equal(
      isInactiveSupportMailboxEmail({
        role: "unknown",
        folders: ["UNREAD", "CATEGORY_PERSONAL"],
      }),
      false
    );
    assert.equal(
      shouldSkipInactiveSupportEmail({
        role: "unknown",
        folders: ["UNREAD", "CATEGORY_UPDATES"],
        subject: "Security alert",
      }),
      true
    );
  });

  it("still skips archived mail that is not a reply", () => {
    const archived = {
      role: "archive",
      folders: ["CATEGORY_PROMOTIONS"],
      subject: "Your invoice",
    };
    assert.equal(shouldSkipInactiveSupportEmail(archived), true);
  });

  it("normalizes reply subjects back to the ticket title", () => {
    assert.equal(
      normalizeSupportEmailSubject(
        "Re: RE: Incompetence, confusion & ineptitude (SUP-0510)"
      ),
      "incompetence, confusion & ineptitude"
    );
  });
});
