import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  conversationMatchesFilters,
  EMPTY_INBOX_FILTERS,
  inboxFiltersActive,
  isOtherEmailConversation,
  toggleExcludedTag,
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

describe("conversationMatchesFilters", () => {
  it("shows LinkedIn threads in the default list, linked or not", () => {
    assert.equal(conversationMatchesFilters(row(), EMPTY_INBOX_FILTERS), true);
    assert.equal(
      conversationMatchesFilters(row({ contact_id: "c1" }), EMPTY_INBOX_FILTERS),
      true
    );
    assert.equal(
      conversationMatchesFilters(row({ in_campaign: true }), EMPTY_INBOX_FILTERS),
      true
    );
  });

  it("still applies needs-reply to LinkedIn threads", () => {
    const filters: InboxFilters = {
      ...EMPTY_INBOX_FILTERS,
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

  it("filters LinkedIn by channel without hiding unmatched threads", () => {
    const filters: InboxFilters = {
      ...EMPTY_INBOX_FILTERS,
      channel: "linkedin",
    };
    assert.equal(conversationMatchesFilters(row(), filters), true);
    assert.equal(
      conversationMatchesFilters(row({ last_channel: "email" }), filters),
      false
    );
  });
});

describe("toggleInboxFlag", () => {
  it("makes other email and work-person flags exclusive", () => {
    const otherOn = toggleInboxFlag(
      { ...EMPTY_INBOX_FILTERS, isProspect: true },
      "otherEmail"
    );
    assert.equal(otherOn.otherEmail, true);
    assert.equal(otherOn.isProspect, false);
    const prospectOn = toggleInboxFlag(otherOn, "isProspect");
    assert.equal(prospectOn.isProspect, true);
    assert.equal(prospectOn.otherEmail, false);
  });
});

describe("isOtherEmailConversation", () => {
  it("flags email that is not a prospect, pool person, campaign, or booking", () => {
    assert.equal(
      isOtherEmailConversation(row({ last_channel: "email" })),
      true
    );
    assert.equal(
      isOtherEmailConversation(
        row({ last_channel: "email", contact_type: "client" })
      ),
      true
    );
  });

  it("keeps prospect, pool, campaign, and booking email in the work inbox", () => {
    assert.equal(
      isOtherEmailConversation(
        row({ last_channel: "email", contact_type: "prospect" })
      ),
      false
    );
    assert.equal(
      isOtherEmailConversation(row({ last_channel: "email", in_pool: true })),
      false
    );
    assert.equal(
      isOtherEmailConversation(
        row({ last_channel: "email", in_campaign: true })
      ),
      false
    );
    assert.equal(
      isOtherEmailConversation(row({ last_channel: "email", booking_id: "b1" })),
      false
    );
    assert.equal(isOtherEmailConversation(row({ last_channel: "linkedin" })), false);
  });
});

describe("pool and prospect filters", () => {
  it("shows pool LinkedIn threads in the default list", () => {
    assert.equal(
      conversationMatchesFilters(row({ in_pool: true }), EMPTY_INBOX_FILTERS),
      true
    );
  });

  it("filters to pool members", () => {
    const filters: InboxFilters = { ...EMPTY_INBOX_FILTERS, inPool: true };
    assert.equal(
      conversationMatchesFilters(
        row({ last_channel: "email", contact_id: "c1", in_pool: true }),
        filters
      ),
      true
    );
    assert.equal(
      conversationMatchesFilters(
        row({ last_channel: "email", contact_id: "c1" }),
        filters
      ),
      false
    );
  });

  it("filters to prospects, dropping clients and unlinked threads", () => {
    const filters: InboxFilters = { ...EMPTY_INBOX_FILTERS, isProspect: true };
    const email = { last_channel: "email", contact_id: "c1" };
    assert.equal(
      conversationMatchesFilters(row({ ...email, contact_type: "prospect" }), filters),
      true
    );
    assert.equal(
      conversationMatchesFilters(row({ ...email, contact_type: "client" }), filters),
      false
    );
    assert.equal(
      conversationMatchesFilters(row({ last_channel: "email" }), filters),
      false
    );
  });

  it("hides non-prospect email from the default list", () => {
    assert.equal(
      conversationMatchesFilters(row({ last_channel: "email" }), EMPTY_INBOX_FILTERS),
      false
    );
    assert.equal(
      conversationMatchesFilters(
        row({ last_channel: "email", contact_type: "client" }),
        EMPTY_INBOX_FILTERS
      ),
      false
    );
    assert.equal(
      conversationMatchesFilters(
        row({ last_channel: "email", contact_type: "prospect" }),
        EMPTY_INBOX_FILTERS
      ),
      true
    );
    assert.equal(
      conversationMatchesFilters(
        row({ last_channel: "email", in_pool: true }),
        EMPTY_INBOX_FILTERS
      ),
      true
    );
  });

  it("switches to the other email bucket", () => {
    const filters: InboxFilters = { ...EMPTY_INBOX_FILTERS, otherEmail: true };
    assert.equal(
      conversationMatchesFilters(row({ last_channel: "email" }), filters),
      true
    );
    assert.equal(
      conversationMatchesFilters(
        row({ last_channel: "email", contact_type: "prospect" }),
        filters
      ),
      false
    );
  });
});

describe("exclude tags", () => {
  const tagged = (tags: string[]) =>
    row({
      last_channel: "email",
      contact_id: "c1",
      contact_type: "prospect",
      prospect_tags: tags,
    });

  it("hides conversations carrying any excluded tag, case-insensitively", () => {
    const filters: InboxFilters = {
      ...EMPTY_INBOX_FILTERS,
      excludeTags: ["Personal"],
    };
    assert.equal(conversationMatchesFilters(tagged(["personal"]), filters), false);
    assert.equal(conversationMatchesFilters(tagged(["hot"]), filters), true);
    assert.equal(conversationMatchesFilters(tagged([]), filters), true);
    assert.equal(inboxFiltersActive(filters), true);
  });

  it("combines include and exclude", () => {
    const filters: InboxFilters = {
      ...EMPTY_INBOX_FILTERS,
      tag: "hot",
      excludeTags: ["personal"],
    };
    assert.equal(conversationMatchesFilters(tagged(["hot"]), filters), true);
    assert.equal(
      conversationMatchesFilters(tagged(["hot", "Personal"]), filters),
      false
    );
    assert.equal(conversationMatchesFilters(tagged(["cold"]), filters), false);
  });

  it("toggles a tag in and out, clearing a matching include", () => {
    const withInclude: InboxFilters = { ...EMPTY_INBOX_FILTERS, tag: "Hot" };
    const excluded = toggleExcludedTag(withInclude, "hot");
    assert.deepEqual(excluded.excludeTags, ["hot"]);
    assert.equal(excluded.tag, null);
    const cleared = toggleExcludedTag(excluded, "HOT");
    assert.deepEqual(cleared.excludeTags, []);
  });
});
