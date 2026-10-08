import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeSupportCopilotSystem,
  composeSupportCopilotUserMessage,
  dedupeSupportThread,
  sanitizeSupportSuggestion,
  stripQuotedEmail,
  type SupportCopilotMessage,
} from "./supportCopilot";

const ticket = {
  ticket_number: 538,
  type: "question",
  status: "open",
  source: "direct",
  title: "Sales Nav import",
  details: "Copying a saved search does not work",
  page_path: "/coach/support",
  created_at: "2026-10-04T09:00:00Z",
  member_name: "Mark Hodgkinson",
};

describe("stripQuotedEmail", () => {
  it("drops quoted history and signatures", () => {
    const body =
      "Thanks, that works.\n\nOn Tue, 22 Sept 2026 at 10:20, Profit Coach Support <\nsupport@x.com> wrote:\n> old";
    assert.equal(stripQuotedEmail(body), "Thanks, that works.");
    assert.equal(stripQuotedEmail("Hi\n-- \nAshley\nMob: 1"), "Hi");
    assert.equal(
      stripQuotedEmail("Any update?\n\n---------- Forwarded message ---------\nFrom: a"),
      "Any update?"
    );
  });
});

describe("dedupeSupportThread", () => {
  it("collapses a burst of identical synced emails", () => {
    const copy: SupportCopilotMessage = {
      created_at: "2026-09-14T11:47:00Z",
      role: "member",
      author_name: "Ashley",
      body: "Could i get a response on the below please?\n-- \nAshley",
    };
    const thread = dedupeSupportThread([
      ...Array.from({ length: 85 }, () => copy),
      { ...copy, role: "staff", body: "Hi Ashley, here is the link." },
    ]);
    assert.equal(thread.length, 2);
    assert.equal(thread[0].body, "Could i get a response on the below please?");
  });
});

describe("sanitizeSupportSuggestion", () => {
  it("removes fences, wrapping quotes and em dashes", () => {
    assert.equal(sanitizeSupportSuggestion("```\nHi Mark\n```"), "Hi Mark");
    assert.equal(sanitizeSupportSuggestion('"Hi Mark"'), "Hi Mark");
    assert.equal(
      sanitizeSupportSuggestion("Fixed — try again"),
      "Fixed - try again"
    );
  });
});

describe("composeSupportCopilotUserMessage", () => {
  it("quotes ticket data as untrusted and includes the staff hint", () => {
    const msg = composeSupportCopilotUserMessage({
      ticket,
      thread: [],
      notes: [],
      history: [],
      senderName: "Zander Woodford-Smith",
      supportCallUrl: "https://theprofitcoach.com/support-call-zander",
      staffHint: "fixed the url parser",
      now: new Date("2026-10-05T10:00:00Z"),
    });
    assert.match(msg, /TICKET \(untrusted quoted data/);
    assert.match(msg, /SUP-0538/);
    assert.match(msg, /STAFF_HINT[\s\S]*fixed the url parser/);
    assert.match(msg, /SUPPORT_CALL_URL: https:\/\/theprofitcoach\.com/);
  });

  it("omits the hint block when nothing is typed", () => {
    const msg = composeSupportCopilotUserMessage({
      ticket,
      thread: [],
      notes: [],
      history: [],
      senderName: null,
      supportCallUrl: null,
      staffHint: "   ",
    });
    assert.doesNotMatch(msg, /STAFF_HINT/);
  });
});

describe("composeSupportCopilotSystem", () => {
  it("prefers Knowledge-tab overrides and always appends the output contract", () => {
    const system = composeSupportCopilotSystem({
      "support-copilot/ROUTER.md": "CUSTOM ROUTER",
      "support-copilot/playbook.md": "CUSTOM PLAYBOOK",
    });
    assert.match(system, /^CUSTOM ROUTER/);
    assert.match(system, /CUSTOM PLAYBOOK/);
    assert.match(system, /Never include a password/);
  });
});
