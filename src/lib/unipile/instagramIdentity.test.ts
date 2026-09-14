import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  instagramUsername,
  normalizeInstagramProfileUrl,
} from "./instagramIdentity";

describe("instagram identity", () => {
  it("parses profile URLs and handles", () => {
    assert.equal(instagramUsername("https://www.instagram.com/kimsisland/"), "kimsisland");
    assert.equal(instagramUsername("@Kimsisland"), "kimsisland");
    assert.equal(
      normalizeInstagramProfileUrl("instagram.com/kimsisland"),
      "https://www.instagram.com/kimsisland/"
    );
  });

  it("rejects posts and reserved paths", () => {
    assert.equal(instagramUsername("https://www.instagram.com/p/abc123/"), null);
    assert.equal(instagramUsername("https://www.instagram.com/reel/xyz/"), null);
  });
});
