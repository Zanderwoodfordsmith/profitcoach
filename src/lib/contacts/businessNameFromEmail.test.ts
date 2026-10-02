import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { businessNameFromEmail } from "./businessNameFromEmail";
import { suggestContactIdentity } from "./suggestContactIdentity";

describe("businessNameFromEmail", () => {
  it("titles a company domain", () => {
    assert.equal(businessNameFromEmail("farah@ampverve.com"), "Ampverve");
  });

  it("spaces a concatenated business word", () => {
    assert.equal(
      businessNameFromEmail("hello@richardsengineering.com"),
      "Richards Engineering"
    );
    assert.equal(
      businessNameFromEmail("hello@richards-engineering.co.uk"),
      "Richards Engineering"
    );
  });

  it("keeps a leading number", () => {
    assert.equal(businessNameFromEmail("hi@121plumbing.co.uk"), "121 Plumbing");
  });

  it("splits on and", () => {
    assert.equal(
      businessNameFromEmail("hi@smithandjones.com"),
      "Smith and Jones"
    );
  });

  it("ignores generic inboxes", () => {
    assert.equal(businessNameFromEmail("farah@gmail.com"), null);
    assert.equal(businessNameFromEmail("farah@hotmail.co.uk"), null);
    assert.equal(businessNameFromEmail("farah@outlook.com"), null);
    assert.equal(businessNameFromEmail("farah@yahoo.co.uk"), null);
    assert.equal(businessNameFromEmail("farah@icloud.com"), null);
  });
});

describe("suggestContactIdentity", () => {
  it("uses a stored first and last name hidden behind a note", () => {
    const suggestion = suggestContactIdentity({
      fullName:
        "Farah Zahid (fixing meeting after your chat with Mohsin on LinkedIn)",
      firstName: "Farah",
      lastName: "Zahid (fixing meeting after your chat with Mohsin on LinkedIn)",
      email: "farah@ampverve.com",
      businessName: null,
    });
    assert.equal(suggestion.displayName, "Farah Zahid");
    assert.equal(suggestion.persistName, true);
    assert.equal(suggestion.shownBusiness, "Ampverve");
    assert.equal(suggestion.persistBusiness, true);
  });

  it("leaves a gmail contact without a guessed business", () => {
    const suggestion = suggestContactIdentity({
      fullName: "Ada Lovelace",
      email: "ada@gmail.com",
      businessName: null,
    });
    assert.equal(suggestion.displayName, "Ada Lovelace");
    assert.equal(suggestion.persistName, false);
    assert.equal(suggestion.shownBusiness, null);
    assert.equal(suggestion.persistBusiness, false);
  });
});
