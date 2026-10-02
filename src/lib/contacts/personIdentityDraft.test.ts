import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { personIdentityNameDraft } from "./personIdentityDraft";

describe("personIdentityNameDraft", () => {
  it("leaves email display names blank", () => {
    assert.deepEqual(
      personIdentityNameDraft({
        fullName: "farah@ampverve.com",
        email: "farah@ampverve.com",
      }),
      { firstName: "", lastName: "" }
    );
  });

  it("drops a parenthetical note from stored names", () => {
    assert.deepEqual(
      personIdentityNameDraft({
        fullName: "Farah Zahid (fixing meeting after your chat with Mohsin on LinkedIn)",
        firstName: "Farah",
        lastName: "Zahid (fixing meeting after your chat with Mohsin on LinkedIn)",
        email: "farah@ampverve.com",
      }),
      { firstName: "Farah", lastName: "Zahid" }
    );
  });

  it("splits a normal full name", () => {
    assert.deepEqual(
      personIdentityNameDraft({ fullName: "Ada Lovelace" }),
      { firstName: "Ada", lastName: "Lovelace" }
    );
  });
});
