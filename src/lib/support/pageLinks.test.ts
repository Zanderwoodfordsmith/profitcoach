import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { supportMarkdownToEmailInnerHtml } from "./supportMessageHtml";
import {
  activePageLinkQuery,
  insertPageLink,
  matchPageLinks,
} from "./pageLinks";

const pages = [
  { path: "/coach/settings?tab=profile", label: "Your profile", group: "Settings" },
  { path: "/coach/campaigns", label: "Campaigns", group: "Get Clients" },
  { path: "/coach/campaigns?tab=magnets", label: "Lead magnets", group: "Get Clients" },
];

describe("activePageLinkQuery", () => {
  it("reads the search after @@, spaces included", () => {
    assert.deepEqual(activePageLinkQuery("See @@lead mag", 14), {
      start: 4,
      query: "lead mag",
    });
  });

  it("opens on @@ alone", () => {
    assert.deepEqual(activePageLinkQuery("@@", 2), { start: 0, query: "" });
  });

  it("ignores one @, an email address, and @@@", () => {
    assert.equal(activePageLinkQuery("Ask @pam", 8), null);
    assert.equal(activePageLinkQuery("pam@@x", 6), null);
    assert.equal(activePageLinkQuery("See @@@x", 8), null);
  });

  it("stops at a new line", () => {
    assert.equal(activePageLinkQuery("@@camp\nnext", 11), null);
  });
});

describe("matchPageLinks", () => {
  it("finds a page from any of its words, in any order", () => {
    assert.deepEqual(
      matchPageLinks(pages, "magnets lead").map((p) => p.label),
      ["Lead magnets"]
    );
  });

  it("puts names starting with the search first", () => {
    assert.equal(matchPageLinks(pages, "get")[0]?.label, "Campaigns");
    assert.equal(matchPageLinks(pages, "lead")[0]?.label, "Lead magnets");
  });

  it("finds nothing when no page matches", () => {
    assert.deepEqual(matchPageLinks(pages, "zebra"), []);
  });
});

describe("insertPageLink", () => {
  it("swaps the search for a live-site link and puts the caret after it", () => {
    const { next, caret } = insertPageLink(
      "See @@lead now",
      { start: 4, end: 10 },
      pages[2]!
    );
    assert.equal(
      next,
      "See [Lead magnets](https://www.theprofitcoach.com/coach/campaigns?tab=magnets)  now"
    );
    assert.equal(next[caret - 1], " ");
    assert.equal(next.slice(caret), " now");
  });

  it("becomes a real link in the email", () => {
    const { next } = insertPageLink("@@", { start: 0, end: 2 }, pages[2]!);
    const html = supportMarkdownToEmailInnerHtml(next);
    assert.match(
      html,
      /href="https:\/\/www\.theprofitcoach\.com\/coach\/campaigns\?tab=magnets"/
    );
    assert.match(html, />Lead magnets</);
  });
});
