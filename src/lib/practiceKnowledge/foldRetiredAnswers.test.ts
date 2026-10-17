import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyPracticePayload, foldRetiredAnswers, mergePracticePayload, normalizePracticePayload, sourced } from "./sourced";

const AT = "2026-10-01T00:00:00.000Z";

function withOldAnswers() {
  return mergePracticePayload(emptyPracticePayload(), {
    market: {
      ...emptyPracticePayload().market,
      industries_credibility: sourced(["Construction"], "coach_edit", AT),
      industries_understand: sourced(["Construction", "Facilities"], "coach_edit", AT),
    },
    client: {
      ...emptyPracticePayload().client,
      pains_now: sourced(["No say over his week"], "coach_edit", AT),
      pains_later: sourced(["Five more years of it"], "coach_edit", AT),
      stuck: sourced([{ id: "a", problem: "Trapped", consequence: "Resents the job", awake: "" }], "coach_edit", AT),
      inner_voice: sourced("I cannot risk the salary.", "interview", AT),
      trust: sourced([{ id: "t", authority: "Ran a 7-figure firm", social_proof: "", scarcity: "Six clients at once" }], "coach_edit", AT),
    },
  });
}

describe("folding retired Who You Help answers", () => {
  it("moves each old answer into the box that replaced it", () => {
    const out = foldRetiredAnswers(withOldAnswers());
    assert.deepEqual(out.market.industries_credibility?.value, ["Construction", "Facilities"]);
    assert.deepEqual(out.client.pains_now?.value, ["No say over his week", "Five more years of it", "Trapped. Resents the job"]);
    assert.deepEqual(out.client.says?.value, ["I cannot risk the salary."]);
    assert.equal(out.client.why_you?.value, "Ran a 7-figure firm. Six clients at once");
  });

  it("clears the old boxes with an edit, so the next save removes them", () => {
    const out = foldRetiredAnswers(withOldAnswers());
    assert.deepEqual(out.client.pains_later?.value, []);
    assert.equal(out.client.pains_later?.source, "coach_edit");
    assert.deepEqual(out.client.stuck?.value, []);
    assert.equal(out.client.inner_voice?.value, "");
  });

  it("does not add lines twice when the stored row still has the old boxes", () => {
    const once = foldRetiredAnswers(withOldAnswers());
    // The database still holds the old boxes until the coach next saves.
    const reread = normalizePracticePayload({ ...withOldAnswers(), client: { ...withOldAnswers().client, pains_now: once.client.pains_now } });
    assert.deepEqual(reread.client.pains_now?.value, once.client.pains_now?.value);
    assert.deepEqual(foldRetiredAnswers(once), once);
  });
});
