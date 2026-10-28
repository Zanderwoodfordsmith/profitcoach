import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pickPages, quoteIsExact, rankGroups, recencyWeight, type PainMention } from "./marketPains";

const NOW = Date.parse("2026-10-28T12:00:00Z");

function mention(id: string, author: string, over: Partial<PainMention> = {}): PainMention {
  return {
    id,
    label: "cash flow",
    quote: "We are busy every night but I still can't make the cash flow work.",
    trigger: null,
    tried: null,
    wants: null,
    speaker: "owner",
    size_evidence: null,
    uk_evidence: "£",
    author_key: author,
    url: `https://forum.example.co.uk/threads/${id}`,
    domain: "forum.example.co.uk",
    date: "2026-06-01",
    ...over,
  };
}

describe("quoteIsExact", () => {
  const page = "Hi all.\nWe’re   busy every night but I still can’t make the cash flow work. Any advice?";
  it("accepts a word-for-word quote despite curly quotes and spacing", () => {
    assert.equal(quoteIsExact("We're busy every night but I still can't make the cash flow work.", page), true);
  });
  it("rejects a reworded quote", () => {
    assert.equal(quoteIsExact("We are busy every night but cash flow does not work.", page), false);
  });
  it("rejects sentences joined from different places", () => {
    assert.equal(quoteIsExact("Hi all. Any advice?", page), false);
  });
});

describe("recencyWeight", () => {
  it("counts the last year fully, the year before by half", () => {
    assert.equal(recencyWeight("2026-03-01", NOW), 1);
    assert.equal(recencyWeight("2025-03-01", NOW), 0.5);
    assert.equal(recencyWeight(null, NOW), 0.5);
  });
});

describe("rankGroups", () => {
  it("counts separate owners, not mentions, and marks thin pains weak", () => {
    const mentions = [
      mention("m1", "a"),
      mention("m2", "a"),
      mention("m3", "a"),
      mention("m4", "b"),
      mention("m5", "c"),
      mention("m6", "d"),
      mention("m7", "e", { label: "staff", quote: "I can't find a manager I trust to run the place." }),
    ];
    const ranked = rankGroups(
      [
        { name: "Busy but no cash", ids: ["m1", "m2", "m3", "m4", "m5", "m6"] },
        { name: "No manager to trust", ids: ["m7"] },
        { name: "Other", ids: [] },
      ],
      mentions,
      NOW
    );
    assert.equal(ranked[0]!.name, "Busy but no cash");
    assert.equal(ranked[0]!.owners, 4);
    assert.equal(ranked[0]!.mentions, 6);
    assert.equal(ranked[0]!.weak, false);
    assert.equal(new Set(ranked[0]!.quotes.map((q) => q.url)).size, ranked[0]!.quotes.length);
    assert.equal(ranked[1]!.weak, true);
  });
});

describe("pickPages", () => {
  it("drops Reddit, LinkedIn and listing pages, and puts forum threads first", () => {
    const hit = (url: string) => ({ url, title: "", description: "", date: null, query: "" });
    const picked = pickPages(
      [hit("https://www.reddit.com/r/x/comments/1"), hit("https://news.example.com/story"), hit("https://www.linkedin.com/posts/1"), hit("https://www.ukbusinessforums.co.uk/whats-new/posts/1816471/"), hit("https://www.ukbusinessforums.co.uk/threads/help.123/")],
      []
    );
    assert.deepEqual(
      picked.map((p) => p.url),
      ["https://www.ukbusinessforums.co.uk/threads/help.123/", "https://news.example.com/story"]
    );
  });
});
