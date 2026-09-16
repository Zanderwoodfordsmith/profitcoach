import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultPipelineLayout } from "./pipelineLayout";
import { pipelineColumnForProspect } from "./pipelineBoard";
import type { ProspectRow } from "./prospectRow";

function row(status: string): ProspectRow {
  return {
    id: "p1",
    full_name: "Ada",
    job_title: null,
    email: null,
    business_name: null,
    phone: null,
    type: "prospect",
    prospect_status: status,
    status: { value: status, label: status, isAuto: false },
    boss_score: null,
    boss_score_at: null,
    boss_score_report_token: null,
    boss_score_premium: null,
    boss_score_premium_at: null,
    boss_score_premium_source: null,
    last_assessed_at: null,
    revenue: null,
    team_size: null,
    years_in_business: null,
    outcome: null,
    obstacles: null,
    preferred_support: null,
    boss_level: null,
  };
}

describe("pipelineColumnForProspect", () => {
  it("places Pool-status inbound people on Interested when Pool is hidden", () => {
    assert.equal(
      pipelineColumnForProspect(row("leads"), defaultPipelineLayout()),
      "interested"
    );
  });

  it("keeps booked people on Booked", () => {
    assert.equal(
      pipelineColumnForProspect(row("booked"), defaultPipelineLayout()),
      "booked"
    );
  });
});
