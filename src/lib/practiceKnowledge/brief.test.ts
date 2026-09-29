import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPracticeBrief, patchFromBriefEdit, readyForRecommendation } from "./brief";
import { emptyPracticePayload, sourced } from "./sourced";

describe("practice brief", () => {
  it("shows gaps until LinkedIn and proof exist", () => {
    const sections = buildPracticeBrief(emptyPracticePayload(), null);
    assert.equal(sections.find((s) => s.id === "experience")?.filled, false);
    assert.equal(sections.find((s) => s.id === "priorities")?.filled, false);
    assert.equal(sections.find((s) => s.id === "win")?.blocks[0]?.kind, "gap");
  });

  it("writes LinkedIn roles as prose and a precise result as proof", () => {
    const payload = emptyPracticePayload();
    payload.market.roles_held = sourced(["Sales Director", "MD"], "linkedin");
    payload.proof.career_results = sourced(
      [
        {
          id: "1",
          company: "JCB",
          role: "MD",
          metric_from: "£150k profit",
          metric_to: "£9m",
          timeframe: "4 years",
          mechanism: "a weekly rhythm",
          proof_type: "career",
          precise: true,
        },
      ],
      "interview"
    );
    payload.proof.superpowers = sourced("Turns chaos into a weekly rhythm", "interview");
    payload.proof.problems_asked = sourced(["Margin"], "interview");
    const sections = buildPracticeBrief(payload, null);
    assert.equal(sections.find((s) => s.id === "experience")?.filled, true);
    assert.equal(readyForRecommendation(payload), true);
  });

  it("patches a corrected superpower back onto the payload", () => {
    const payload = emptyPracticePayload();
    const patch = patchFromBriefEdit(payload, "proof.superpowers", "Keeps the team accountable");
    assert.equal(patch.proof?.superpowers?.value, "Keeps the team accountable");
    assert.equal(patch.proof?.superpowers?.source, "coach_edit");
  });
});
