import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  conversationPersonName,
  looksLikePersonName,
} from "./conversationDisplay";

const NOTED =
  "Farah Zahid (fixing meeting after your chat with Mohsin on LinkedIn)";

describe("conversationPersonName", () => {
  it("shows the person in front of a parenthetical note, not the email", () => {
    assert.equal(looksLikePersonName(NOTED), false);
    assert.equal(
      conversationPersonName({
        prospectFullName: NOTED,
        prospectEmail: "farah@ampverve.com",
      }),
      "Farah Zahid"
    );
  });
});
