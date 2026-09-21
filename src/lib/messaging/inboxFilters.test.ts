import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  conversationMatchesFilters,
  EMPTY_INBOX_FILTERS,
  inboxFiltersActive,
  isOtherLinkedInConversation,
  toggleInboxFlag,
  type InboxFilterConversation,
  type InboxFilters,
} from "./inboxFilters";

function row(
  partial: Partial<InboxFilterConversation> = {}
): InboxFilterConversation {
  return {
    last_channel: "linkedin",
    ...partial,
  };
}

describe("isOtherLinkedInConversation", () => {
  it("flags unmatched LinkedIn threads", () => {
    assert.equal(isOtherLinkedInConversation(row()), true);
    assert.equal(
      isOtherLinkedInConversation(row({ reply_channels: ["linkedin"] })),
      true
    );
  });

  it("keeps CRM, campaign, and booking threads in the work inbox", () => {
    assert.equal(
      isOtherLinkedInConversation(row({ contact_id: "c1" })),
      false
    );
    assert.equal(
      isOtherLinkedInConversation(row({ in_campaign: true })),
      false
    );
    assert.equal(
      isOtherLinkedInConversation(row({ booking_id: "b1" })),
      false
    );
    assert.equal(
      isOtherLinkedInConversation(row({ last_channel: "email" })),
      false
    );
  });
});

describe("conversationMatchesFilters", () => {
  it("hides unmatched LinkedIn from the default list", () => {
    assert.equal(
      conversationMatchesFilters(row(), EMPTY_INBOX_FILTERS),
      false
    );
    assert.equal(
      conversationMatchesFilters(row({ contact_id: "c1" }), EMPTY_INBOX_FILTERS),
      true
    );
  });

  it("switches to the other LinkedIn bucket", () => {
    const filters: InboxFilters = {
      ...EMPTY_INBOX_FILTERS,
      otherLinkedIn: true,
    };
    assert.equal(conversationMatchesFilters(row(), filters), true);
    assert.equal(
      conversationMatchesFilters(row({ contact_id: "c1" }), filters),
      false
    );
    assert.equal(
      conversationMatchesFilters(row({ in_campaign: true }), filters),
      false
    );
  });

  it("lets search find unmatched LinkedIn without opening the filter", () => {
    assert.equal(
      conversationMatchesFilters(row(), EMPTY_INBOX_FILTERS, {
        searching: true,
      }),
      true
    );
  });

  it("still applies needs-reply inside the other bucket", () => {
    const filters: InboxFilters = {
      ...EMPTY_INBOX_FILTERS,
      otherLinkedIn: true,
      needsReply: true,
    };
    assert.equal(
      conversationMatchesFilters(row({ last_direction: "outbound" }), filters),
      false
    );
    assert.equal(
      conversationMatchesFilters(row({ last_direction: "inbound" }), filters),
      true
    );
  });
});

describe("toggleInboxFlag", () => {
  it("makes other LinkedIn and in-campaign exclusive", () => {
    const otherOn = toggleInboxFlag(EMPTY_INBOX_FILTERS, "otherLinkedIn");
    assert.equal(otherOn.otherLinkedIn, true);
    assert.equal(otherOn.inCampaign, false);

    const withCampaign: InboxFilters = {
      ...EMPTY_INBOX_FILTERS,
      inCampaign: true,
      campaignId: "camp-1",
    };
    const switched = toggleInboxFlag(withCampaign, "otherLinkedIn");
    assert.equal(switched.otherLinkedIn, true);
    assert.equal(switched.inCampaign, false);
    assert.equal(switched.campaignId, null);

    const backToCampaign = toggleInboxFlag(otherOn, "inCampaign");
    assert.equal(backToCampaign.inCampaign, true);
    assert.equal(backToCampaign.otherLinkedIn, false);
  });

  it("counts other LinkedIn as an active filter", () => {
    assert.equal(inboxFiltersActive(EMPTY_INBOX_FILTERS), false);
    assert.equal(
      inboxFiltersActive({ ...EMPTY_INBOX_FILTERS, otherLinkedIn: true }),
      true
    );
  });
});
