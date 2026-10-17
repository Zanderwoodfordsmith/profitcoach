import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { csvLeadFlag, optionalLeadFlag } from "./leadFlags";

describe("optionalLeadFlag", () => {
  it("keeps missing fields null instead of false", () => {
    assert.equal(optionalLeadFlag(undefined, null), null);
  });

  it("reads Harvest openProfile and Unipile is_open_profile", () => {
    assert.equal(optionalLeadFlag(true), true);
    assert.equal(optionalLeadFlag(undefined, true), true);
    assert.equal(optionalLeadFlag("false"), false);
  });
});

describe("csvLeadFlag", () => {
  it("exports yes, no, or blank", () => {
    assert.equal(csvLeadFlag(true), "yes");
    assert.equal(csvLeadFlag(false), "no");
    assert.equal(csvLeadFlag(null), "");
  });
});
