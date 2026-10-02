import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { supportCallEventTitle } from "./supportCallHosts";

describe("supportCallEventTitle", () => {
  it("uses the member's full name and the host's first name", () => {
    assert.equal(
      supportCallEventTitle("zander", "Zander Woodford-Smith"),
      "BCA Support Call : Zander Woodford-Smith & Zander"
    );
    assert.equal(
      supportCallEventTitle("pam", "Jane Smith"),
      "BCA Support Call : Jane Smith & Pam"
    );
  });

  it("returns null for calendars that are not support hosts", () => {
    assert.equal(supportCallEventTitle("andy", "Jane Smith"), null);
  });
});
