import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inboundMightBeSupportFollowUp,
  isBinnedSupportEmail,
  isInactiveSupportMailboxEmail,
  normalizeSupportEmailSubject,
  shouldSkipInactiveSupportEmail,
  supportPlusTag,
} from "./inboundEmailMatch";

describe("support+name@ mail", () => {
  const to = (identifier: string) => ({ to_attendees: [{ identifier }] });

  it("reads the tag from a support+ alias", () => {
    assert.equal(
      supportPlusTag(to("support+willwalsh@businesscoachacademy.com")),
      "willwalsh"
    );
    assert.equal(
      supportPlusTag(to("Support+PaulWainwright@BusinessCoachAcademy.com")),
      "paulwainwright"
    );
  });

  it("ignores plain support@, other people's aliases and other domains", () => {
    assert.equal(supportPlusTag(to("support@businesscoachacademy.com")), null);
    assert.equal(supportPlusTag(to("zander+x@businesscoachacademy.com")), null);
    assert.equal(supportPlusTag(to("support+x@example.com")), null);
    assert.equal(supportPlusTag({}), null);
  });

  it("keeps a Sales Robot export Gmail filed under Sent", () => {
    const salesRobot = {
      role: "sent",
      folders: ["CATEGORY_PERSONAL", "UNREAD", "IMPORTANT", "SENT"],
    };
    assert.equal(isBinnedSupportEmail(salesRobot), false);
    assert.equal(isBinnedSupportEmail({ role: "trash", folders: [] }), true);
    assert.equal(isBinnedSupportEmail({ role: "unknown", folders: ["SPAM"] }), true);
  });
});

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
