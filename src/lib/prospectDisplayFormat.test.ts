import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatBusinessLabel,
  formatProspectPersonName,
} from "./prospectDisplayFormat";

describe("formatBusinessLabel", () => {
  it("strips trailing Ltd and Limited", () => {
    assert.equal(
      formatBusinessLabel("121 Plumbing Solutions LTD"),
      "121 Plumbing Solutions"
    );
    assert.equal(
      formatBusinessLabel("Total Improvements Limited"),
      "Total Improvements"
    );
    assert.equal(
      formatBusinessLabel("Caprani Plumbing & Heating Limited"),
      "Caprani Plumbing & Heating"
    );
  });

  it("leaves person names alone", () => {
    assert.equal(formatProspectPersonName("jane smith"), "Jane Smith");
    assert.equal(formatBusinessLabel("Jane Smith"), "Jane Smith");
  });

  it("drops a trailing parenthetical note from a person name", () => {
    assert.equal(
      formatProspectPersonName(
        "Zahid (fixing meeting after your chat with Mohsin on LinkedIn)"
      ),
      "Zahid"
    );
    assert.equal(
      formatProspectPersonName(
        "Farah Zahid (fixing meeting after your chat with Mohsin on LinkedIn)"
      ),
      "Farah Zahid"
    );
  });
});
