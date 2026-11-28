import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cleanText, splitHeadline } from "./prospectsSetup";

describe("prospects setup: LinkedIn headline into title and company", () => {
  it("splits 'title at company'", () => {
    assert.deepEqual(splitHeadline("Managing Director at Acme Ltd"), { title: "Managing Director", company: "Acme Ltd" });
    assert.deepEqual(splitHeadline("Founder @ Brew Co | Coffee lover"), { title: "Founder", company: "Brew Co" });
  });
  it("keeps the first part when there's no company", () => {
    assert.deepEqual(splitHeadline("Helping owners grow | Speaker"), { title: "Helping owners grow", company: null });
    assert.deepEqual(splitHeadline(null), { title: null, company: null });
  });
});

describe("prospects setup: clean LinkedIn text", () => {
  it("drops null bytes and half emojis, keeps whole emojis", () => {
    assert.equal(cleanText("Sam\u0000 Lee"), "Sam Lee");
    assert.equal(cleanText("Ann \uD83D"), "Ann");
    assert.equal(cleanText("Jo 😀"), "Jo 😀");
    assert.equal(cleanText("  "), null);
  });
});

describe("prospects setup: long headlines", () => {
  it("never cuts an emoji in half", () => {
    const title = splitHeadline(`${"a".repeat(199)}😀 more`).title!;
    assert.equal(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(title), false);
    assert.equal(Array.from(title).length, 200);
  });
});
