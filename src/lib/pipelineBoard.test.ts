import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultPipelineLayout } from "./pipelineLayout";
import { pipelineColumnForProspect } from "./pipelineBoard";
import type { ProspectRow } from "./prospectRow";

function row(status: string, extra: Partial<ProspectRow> = {}): ProspectRow {
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
    ...extra,
  };
}

describe("pipelineColumnForProspect", () => {
  it("parks unmarked Pool people in To sort", () => {
    assert.equal(
      pipelineColumnForProspect(row("leads"), defaultPipelineLayout()),
      "to_sort"
    );
  });

  it("parks CRM imports that only look Expressed", () => {
    assert.equal(
      pipelineColumnForProspect(
        row("leads", {
          prospect_source: "ghl",
          status: { value: "interested", label: "Interested", isAuto: false },
        }),
        defaultPipelineLayout()
      ),
      "to_sort"
    );
  });

  it("keeps a follow-up on Follow-up even when the import looks interested", () => {
    assert.equal(
      pipelineColumnForProspect(
        row("leads", {
          prospect_source: "ghl",
          status: { value: "interested", label: "Interested", isAuto: false },
          next_action: { id: "a1", text: "Call back", dueAt: null },
        }),
        defaultPipelineLayout()
      ),
      "follow_up"
    );
  });

  it("keeps a completed scorecard on Interested", () => {
    assert.equal(
      pipelineColumnForProspect(
        row("leads", {
          last_assessed_at: "2026-09-01T00:00:00Z",
          status: { value: "interested", label: "Interested", isAuto: false },
        }),
        defaultPipelineLayout()
      ),
      "interested"
    );
  });

  it("keeps an explicit Interested status on Interested", () => {
    assert.equal(
      pipelineColumnForProspect(row("interested"), defaultPipelineLayout()),
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
