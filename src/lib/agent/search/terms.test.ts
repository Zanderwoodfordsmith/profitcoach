import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { matchScore, queryGroups, queryWords } from "./terms";

describe("queryWords", () => {
  it("drops filler and keeps the meaningful words", () => {
    assert.deepEqual(queryWords("Find the guy called John at Acme Ltd"), ["john", "acme"]);
    assert.deepEqual(queryWords("Who did we remove from the IT campaign?"), ["remove", "it", "campaign"]);
  });

  it("keeps the words when the query is only filler", () => {
    assert.deepEqual(queryWords("The Guy"), ["the", "guy"]);
  });

  it("takes accents and punctuation off", () => {
    assert.deepEqual(queryWords("José O'Brien-Smith"), ["jose", "o", "brien", "smith"]);
  });
});

describe("queryGroups", () => {
  it("adds short and long forms of first names", () => {
    const [first, last] = queryGroups("Pamela Woodford");
    assert.ok(first.split("|").includes("pam"));
    assert.equal(last, "woodford");
  });

  it("works the other way round too", () => {
    assert.ok(queryGroups("Pam")[0].split("|").includes("pamela"));
  });

  it("adds the singular, so accountants finds an accountant", () => {
    assert.equal(matchScore("Financial Accountant", queryGroups("accountants")), 1);
    assert.equal(queryGroups("business")[0], "business");
  });
});

describe("matchScore", () => {
  it("scores 1 when Pamela Woodford meets Pam Woodford", () => {
    assert.equal(matchScore("Pam Woodford", queryGroups("Pamela Woodford")), 1);
  });

  it("matches word starts, not the middle of words", () => {
    assert.equal(matchScore("Accountants in Leeds", queryGroups("account")), 1);
    assert.equal(matchScore("Big Accountants", queryGroups("count")), 0);
  });

  it("counts a near spelling partly when fuzzy", () => {
    const score = matchScore("Pam Woodford", queryGroups("Woodfrod"), { fuzzy: true });
    assert.ok(score > 0.5 && score < 1, `got ${score}`);
    assert.equal(matchScore("Pam Woodford", queryGroups("Woodfrod")), 0);
  });

  it("gives half when one of two words matches", () => {
    assert.equal(matchScore("Pam Smith", queryGroups("Pamela Woodford")), 0.5);
  });
});
