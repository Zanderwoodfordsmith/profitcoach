import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  facebookProfileIdentifier,
  normalizeFacebookProfileUrl,
} from "./facebookIdentity";

describe("facebook identity", () => {
  it("parses vanity URLs and numeric ids", () => {
    assert.equal(facebookProfileIdentifier("https://www.facebook.com/kims"), "kims");
    assert.equal(
      facebookProfileIdentifier("https://www.facebook.com/profile.php?id=12345678901"),
      "12345678901"
    );
    assert.equal(
      normalizeFacebookProfileUrl("facebook.com/kims"),
      "https://www.facebook.com/kims"
    );
  });

  it("rejects non-profile paths", () => {
    assert.equal(facebookProfileIdentifier("https://www.facebook.com/watch"), null);
    assert.equal(facebookProfileIdentifier("https://www.facebook.com/groups/123"), null);
  });
});
