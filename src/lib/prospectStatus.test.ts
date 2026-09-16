import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveProspectStatus } from "./prospectStatus";

describe("resolveProspectStatus inbound lift", () => {
  it("moves scorecard fills stored as Pool into Interested", () => {
    assert.equal(
      resolveProspectStatus({
        prospect_status: "leads",
        prospect_source: "lead_capture",
      }).value,
      "interested"
    );
    assert.equal(
      resolveProspectStatus({
        prospect_status: "leads",
        last_completed_at: "2026-09-01T00:00:00Z",
      }).value,
      "interested"
    );
  });

  it("moves people coaches added into Interested", () => {
    assert.equal(
      resolveProspectStatus({
        prospect_status: "leads",
        prospect_source: "manual",
      }).value,
      "interested"
    );
  });

  it("leaves campaign pool people at Pool", () => {
    assert.equal(
      resolveProspectStatus({
        prospect_status: "leads",
        prospect_source: "linkedin_campaign",
      }).value,
      "leads"
    );
    assert.equal(
      resolveProspectStatus({
        prospect_status: "leads",
      }).value,
      "leads"
    );
  });
});
