import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDecisionMakerHeadline } from "./headline";

describe("isDecisionMakerHeadline", () => {
  it("accepts owners, founders, CEOs, MDs and chairs", () => {
    for (const h of [
      "Managing Director at UPR Scaffolding",
      "MD | Green Commercial Cleaning",
      "Co-Founder & CEO, Bauer Energy",
      "Chief Executive Officer @ Bauer Energy Limited",
      "Owner, Smith Joinery",
      "Managing Partner at Harlow & Pike LLP",
      "Chairman, Rhinox Group",
    ]) {
      assert.equal(isDecisionMakerHeadline(h), true, h);
    }
  });

  it("rejects coaches, consultants, recruiters and look-alike titles", () => {
    for (const h of [
      "Business Coach and Founder of Growth Co",
      "Owner, Recruitment Partners",
      "Product Owner at AnyKey Software",
      "Vice President of Sales",
      "Sales Director at BMD",
      "",
      null,
    ]) {
      assert.equal(isDecisionMakerHeadline(h), false, String(h));
    }
  });
});
