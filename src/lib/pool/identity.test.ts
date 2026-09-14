import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPersonalLinkedInUrl,
  normalizeGooglePlaceId,
  normalizePoolEmail,
  normalizePoolPhone,
  normalizePoolWebsite,
  poolIdentityKey,
} from "./identity";

describe("pool identity", () => {
  it("keys people on personal LinkedIn first", () => {
    assert.equal(
      poolIdentityKey({
        linkedin_url: "linkedin.com/in/jane-doe",
        place_id: "ChIJreV9aqYWdkgROM_boL6YbwA",
        email: "info@shop.com",
      }),
      "li:https://www.linkedin.com/in/jane-doe/"
    );
  });

  it("keys business-only Maps rows on Place ID, not website", () => {
    assert.equal(
      poolIdentityKey({
        place_id: "ChIJreV9aqYWdkgROM_boL6YbwA",
        website: "https://www.mcdonalds.com/gb",
        phone: "+44 161 000 0000",
      }),
      "g:ChIJreV9aqYWdkgROM_boL6YbwA"
    );
  });

  it("falls back to email, phone, then website", () => {
    assert.equal(
      poolIdentityKey({ email: "Owner@Shop.COM" }),
      "em:owner@shop.com"
    );
    assert.equal(poolIdentityKey({ phone: "+1 (415) 555-1212" }), "ph:14155551212");
    assert.equal(
      poolIdentityKey({ website: "https://www.acme.co.uk/contact" }),
      "ws:acme.co.uk"
    );
  });

  it("rejects company LinkedIn and junk Place IDs", () => {
    assert.equal(isPersonalLinkedInUrl("https://www.linkedin.com/company/acme"), false);
    assert.equal(normalizeGooglePlaceId("not-a-place"), null);
    assert.equal(normalizePoolEmail("not-email"), null);
    assert.equal(normalizePoolPhone("123"), null);
    assert.equal(normalizePoolWebsite(""), null);
  });
});
