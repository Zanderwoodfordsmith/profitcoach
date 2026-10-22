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

describe("folding the voice and offer boxes trimmed on 20 Oct", () => {
  function withOldOffer() {
    const empty = emptyPracticePayload();
    return mergePracticePayload(empty, {
      practice: {
        ...empty.practice,
        voice_values: sourced(["Graft"], "coach_edit", AT),
        voice_qualities: sourced(["Reliability", "graft"], "coach_edit", AT),
        voice_dislike_in_people: sourced(["Blame shifting"], "coach_edit", AT),
        min_fee: sourced("£1,500 a month", "coach_edit", AT),
        payment_terms: sourced("Six-month minimum", "coach_edit", AT),
        delivery_format: sourced("one_to_one", "coach_edit", AT),
        delivery_model: sourced("coaching", "coach_edit", AT),
        guarantee: sourced("trial", "coach_edit", AT),
      },
    });
  }

  it("moves values, dislikes and payment terms into the boxes that replaced them", () => {
    const out = foldRetiredAnswers(withOldOffer());
    assert.deepEqual(out.practice.voice_values?.value, ["Graft", "Reliability"]);
    assert.deepEqual(out.practice.voice_pet_peeves?.value, ["Blame shifting"]);
    assert.equal(out.practice.min_fee?.value, "£1,500 a month\nSix-month minimum");
    assert.deepEqual(out.practice.voice_qualities?.value, []);
  });

  it("writes old dropdown answers into the new How you deliver and Guarantee boxes", () => {
    const out = foldRetiredAnswers(withOldOffer());
    assert.equal(out.practice.session_rhythm?.value, "One-to-one coaching");
    assert.equal(out.practice.guarantee_terms?.value, "A trial period: they can stop if it is not right.");
    // The brochure and website still read the dropdown answers.
    assert.equal(out.practice.delivery_format?.value, "one_to_one");
  });

  it("moves old client stories into Results, leaving career or client for the coach", () => {
    const payload = emptyPracticePayload();
    payload.proof.career_results = sourced(
      [{ id: "r1", company: "CAMMS", role: "", metric_from: "£2.5k ARR", metric_to: "£2.6m ARR", timeframe: "", mechanism: "", proof_type: "career", precise: true }],
      "coach_edit",
      AT
    );
    payload.proof.client_results = sourced(
      [
        { id: "a", title: "Boards at war", story: "Stopped the war and rebuilt the board." },
        { id: "b", title: "John Davy, business owner (testimonial)", story: "Pam is the best coach I have had." },
      ],
      "coach_edit",
      AT
    );
    const out = foldRetiredAnswers(payload);
    const results = out.proof.career_results?.value ?? [];
    assert.deepEqual(results.map((r) => [r.id, r.proof_type]), [["r1", "career"], ["story-a", ""], ["story-b", "client"]]);
    assert.equal(results[1].summary, "Boards at war");
    assert.equal(results[1].mechanism, "Stopped the war and rebuilt the board.");
    assert.equal(results[2].client_name, "John Davy, business owner");
    assert.equal(results[2].quote, "Pam is the best coach I have had.");
    assert.deepEqual(out.proof.client_results?.value, []);
    // Running it again adds nothing.
    assert.equal(foldRetiredAnswers(mergePracticePayload(out, { proof: { ...out.proof, client_results: payload.proof.client_results } })).proof.career_results?.value.length, 3);
  });
});
