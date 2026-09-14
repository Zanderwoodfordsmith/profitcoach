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
});
