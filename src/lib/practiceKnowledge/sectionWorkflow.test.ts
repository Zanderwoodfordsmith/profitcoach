import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sectionByKey } from "./blueprint";
import { sectionWorkflow, signOffFreshAnswers } from "./sectionWorkflow";
import { emptyPracticePayload, sourced } from "./sourced";
import type { PracticeKnowledgeRow } from "./types";

function row(overrides: Partial<PracticeKnowledgeRow> = {}): PracticeKnowledgeRow {
  return {
    coach_id: "c1",
    status: "capturing",
    payload: emptyPracticePayload(),
    linkedin_seeded_at: null,
    form_completed_at: null,
    interview_completed_at: null,
    coach_reviewed_at: null,
    admin_reviewed_at: null,
    completeness_score: 0,
    missing_fields: [],
    report_payload: null,
    report_generated_at: null,
    built_sections: {},
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("section workflow", () => {
  it("keeps an unwritten section in To do for BCA", () => {
    const work = sectionWorkflow(sectionByKey("voice:sound")!, row());
    assert.equal(work.status, "todo");
    assert.equal(work.owner, "bca");
  });

  it("asks the coach to review a written section, then treats a later edit as changed", () => {
    const ref = sectionByKey("voice:sound")!;
    const written = row({
      built_sections: {
        "voice:sound": { blocks: [{ type: "lede", text: "Direct" }], generated_at: "2026-03-01T00:00:00.000Z", model: "m" },
      },
    });
    assert.deepEqual(
      { status: sectionWorkflow(ref, written).status, owner: sectionWorkflow(ref, written).owner },
      { status: "review", owner: "coach" }
    );

    written.payload.review.approved_sections = sourced({ "voice:sound": "2026-03-02T00:00:00.000Z" }, "coach_edit");
    assert.equal(sectionWorkflow(ref, written).status, "done");

    written.built_sections["voice:sound"] = {
      ...written.built_sections["voice:sound"],
      edited_at: "2026-03-03T00:00:00.000Z",
    };
    const again = sectionWorkflow(ref, written);
    assert.equal(again.status, "review");
    assert.equal(again.owner, "coach");
    assert.equal(again.changed, true);
  });

  it("holds campaign messaging for BCA after the coach signs off", () => {
    const ref = sectionByKey("campaigns:messaging")!;
    const sample = row({
      payload: emptyPracticePayload(),
      built_sections: {
        "campaigns:messaging": { blocks: [{ type: "lede", text: "Hi" }], generated_at: "2026-03-01T00:00:00.000Z", model: "m" },
      },
    });
    sample.payload.review.approved_sections = sourced({ "campaigns:messaging": "2026-03-02T00:00:00.000Z" }, "coach_edit");
    assert.deepEqual(
      { status: sectionWorkflow(ref, sample).status, owner: sectionWorkflow(ref, sample).owner },
      { status: "review", owner: "bca" }
    );
    sample.payload.review.bca_approved_sections = sourced({ "campaigns:messaging": "2026-03-04T00:00:00.000Z" }, "admin");
    assert.equal(sectionWorkflow(ref, sample).status, "done");
  });

  it("sends a section back to BCA when the coach asks for a change", () => {
    const ref = sectionByKey("voice:sound")!;
    const sample = row({
      built_sections: {
        "voice:sound": { blocks: [{ type: "lede", text: "Direct" }], generated_at: "2026-03-01T00:00:00.000Z", model: "m" },
      },
    });
    sample.payload.review.notes = sourced(
      [{ id: "n1", body: "Shorter", at: "2026-03-05T00:00:00.000Z", page: "voice", section: "voice:sound" }],
      "coach_edit"
    );
    const work = sectionWorkflow(ref, sample);
    assert.equal(work.status, "todo");
    assert.equal(work.owner, "bca");
  });

  it("starts imported facts in Review and missing facts in To do", () => {
    const ref = sectionByKey("story:experience")!;
    assert.equal(sectionWorkflow(ref, row()).status, "todo");
    assert.equal(sectionWorkflow(ref, row()).owner, "coach");

    const payload = emptyPracticePayload();
    payload.market.roles_held = sourced(["Managing Director"], "linkedin", "2026-02-01T00:00:00.000Z");
    payload.market.industries_worked = sourced(["Building services"], "linkedin", "2026-02-01T00:00:00.000Z");
    const filled = sectionWorkflow(ref, row({ payload }));
    assert.equal(filled.status, "review");
    assert.equal(filled.owner, "coach");

    payload.review.approved_sections = sourced({ "story:experience": "2026-02-02T00:00:00.000Z" }, "coach_edit");
    assert.equal(sectionWorkflow(ref, row({ payload })).status, "done");

    payload.market.roles_held = sourced(["Finance Director"], "coach_edit", "2026-02-03T00:00:00.000Z");
    const changed = sectionWorkflow(ref, row({ payload }));
    assert.equal(changed.status, "review");
    assert.deepEqual(changed.changedFields, ["market.roles_held"]);
  });

  it("treats the coach's own answers as Done until they change them", () => {
    const ref = sectionByKey("story:problems")!;
    const payload = emptyPracticePayload();
    payload.proof.problems_asked = sourced(["Cash is tight"], "interview", "2026-01-01T00:00:00.000Z");
    assert.equal(sectionWorkflow(ref, row({ payload })).status, "done");
  });

  it("keeps a manual choice until the section itself changes", () => {
    const ref = sectionByKey("story:experience")!;
    const payload = emptyPracticePayload();
    payload.market.roles_held = sourced(["Managing Director"], "linkedin", "2026-02-01T00:00:00.000Z");
    payload.market.industries_worked = sourced(["Building services"], "linkedin", "2026-02-01T00:00:00.000Z");
    payload.review.section_status = sourced({ "story:experience": "todo|2026-02-02T00:00:00.000Z" }, "coach_edit");
    assert.equal(sectionWorkflow(ref, row({ payload })).status, "todo");

    payload.market.roles_held = sourced(["Finance Director"], "coach_edit", "2026-02-03T00:00:00.000Z");
    assert.equal(sectionWorkflow(ref, row({ payload })).status, "review");
  });

  it("stamps the first complete answer, and leaves an older stamp when it is edited", () => {
    const before = emptyPracticePayload();
    const after = emptyPracticePayload();
    after.proof.problems_asked = sourced(["Cash is tight"], "coach_edit", "2026-04-01T00:00:00.000Z");
    const first = signOffFreshAnswers(before, after);
    assert.equal(first.review.approved_sections?.value?.["story:problems"], "2026-04-01T00:00:00.000Z");

    const edited = emptyPracticePayload();
    edited.review.approved_sections = first.review.approved_sections;
    edited.proof.problems_asked = sourced(["Cash is always tight"], "coach_edit", "2026-04-02T00:00:00.000Z");
    const second = signOffFreshAnswers(first, edited);
    assert.equal(second.review.approved_sections?.value?.["story:problems"], "2026-04-01T00:00:00.000Z");
  });
});
