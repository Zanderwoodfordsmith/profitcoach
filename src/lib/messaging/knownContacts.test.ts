import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowlistedEmail,
  emptyKnownContactIndex,
  matchKnownContact,
  type KnownContactIndex,
  type KnownContactMatch,
} from "./knownContacts";

function contact(partial: Partial<KnownContactMatch> = {}): KnownContactMatch {
  return {
    id: "c1",
    full_name: "Ada",
    email: "ada@example.com",
    phone: null,
    ...partial,
  };
}

function index(partial: Partial<KnownContactIndex> = {}): KnownContactIndex {
  const base = emptyKnownContactIndex();
  const ada = contact();
  base.byEmail.set("ada@example.com", ada);
  return {
    ...base,
    ...partial,
    byEmail: partial.byEmail ?? base.byEmail,
    byPhone: partial.byPhone ?? base.byPhone,
    extraEmails: partial.extraEmails ?? base.extraEmails,
  };
}

describe("allowlistedEmail", () => {
  it("allows a CRM contact email", () => {
    assert.equal(allowlistedEmail(index(), "ada@example.com"), true);
    assert.equal(allowlistedEmail(index(), "ADA@example.com"), true);
  });

  it("allows a pool email that is not yet a contact", () => {
    const extra = new Set(["pool@example.com"]);
    assert.equal(
      allowlistedEmail(index({ extraEmails: extra }), "pool@example.com"),
      true
    );
    assert.equal(matchKnownContact(index({ extraEmails: extra }), {
      email: "pool@example.com",
    }), null);
  });

  it("rejects unknown personal mail", () => {
    assert.equal(allowlistedEmail(index(), "stranger@example.com"), false);
    assert.equal(allowlistedEmail(index(), null), false);
  });
});
