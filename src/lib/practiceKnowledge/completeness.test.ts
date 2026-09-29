import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeCompleteness } from "./completeness";
import { emptyPracticePayload, sourced } from "./sourced";
import { brainPatchFromPractice } from "./syncBrain";

describe("practice knowledge completeness", () => {
  it("starts empty", () => {
    const { score, missing_fields } = computeCompleteness(emptyPracticePayload());
    assert.equal(score, 0);
    assert.ok(missing_fields.includes("proof.career_results"));
    assert.ok(missing_fields.includes("proof.superpowers"));
  });

  it("accepts one precise career result as proof", () => {
    const payload = emptyPracticePayload();
    payload.proof.career_results = sourced(
      [
        {
          id: "1",
          company: "JCB",
          role: "MD",
          metric_from: "£150k profit",
          metric_to: "£9m",
          timeframe: "4 years",
          mechanism: "keeping the team accountable",
          proof_type: "career",
          precise: true,
        },
      ],
      "interview"
    );
    const { missing_fields } = computeCompleteness(payload);
    assert.ok(!missing_fields.includes("proof.career_results"));
  });

  it("syncs career results into brain client_results", () => {
    const payload = emptyPracticePayload();
    payload.proof.superpowers = sourced("Turns chaos into a weekly rhythm", "interview");
    payload.proof.career_results = sourced(
      [
        {
          id: "1",
          company: "IBM",
          role: "Sales Director",
          metric_from: "$10M ARR",
          metric_to: "$40M",
          timeframe: "4 years",
          mechanism: "streamlining the sales cycle",
          proof_type: "career",
          precise: true,
        },
      ],
      "interview"
    );
    const patch = brainPatchFromPractice(payload);
    assert.match(patch.superpowers ?? "", /weekly rhythm/);
    assert.equal(patch.client_results?.[0]?.title, "IBM · Sales Director");
    assert.match(patch.client_results?.[0]?.story ?? "", /\$10M ARR/);
  });
});
