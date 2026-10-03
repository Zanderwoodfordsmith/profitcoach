import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatBusinessLabel,
  formatProspectPersonName,
  pipelineCardIdentity,
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

describe("pipelineCardIdentity", () => {
  it("keeps a real name and skips the email", () => {
    assert.deepEqual(
      pipelineCardIdentity({
        full_name: "Ada Lovelace",
        email: "ada@analyticalengines.co.uk",
      }),
      { title: "Ada Lovelace", detail: null }
    );
  });

  it("reads a name from the email when the contact is Unknown", () => {
    assert.deepEqual(
      pipelineCardIdentity({
        full_name: "Unknown",
        email: "jane.smith@richardsengineering.com",
      }),
      { title: "Jane Smith", detail: null }
    );
  });

  it("shows the email and a domain business for a role inbox", () => {
    assert.deepEqual(
      pipelineCardIdentity({
        full_name: "Unknown",
        email: "info@richardsengineering.com",
      }),
      { title: "info@richardsengineering.com", detail: "Richards Engineering" }
    );
  });

  it("does not invent a business from Gmail", () => {
    assert.deepEqual(
      pipelineCardIdentity({
        full_name: "Unknown",
        email: "ada@gmail.com",
      }),
      { title: "Ada", detail: null }
    );
  });
});
