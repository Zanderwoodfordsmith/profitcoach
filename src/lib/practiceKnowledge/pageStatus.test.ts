import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pageStatusBySlug } from "./pageStatus";
import { emptyPracticePayload, sourced } from "./sourced";
import type { PracticeKnowledgePayload, PracticeKnowledgeRow } from "./types";

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

function fill(payload: PracticeKnowledgePayload, path: string, value: string | string[] = "Yes") {
  const [group, key] = path.split(".") as [keyof PracticeKnowledgePayload, string];
  const bucket = payload[group] as Record<string, ReturnType<typeof sourced> | null>;
  bucket[key] = sourced(value, "coach_edit", "2026-01-01T00:00:00.000Z");
}

describe("page status", () => {
  it("asks for the coach when this page still has empty answers", () => {
    assert.equal(pageStatusBySlug("story", row()), "needs_you");
  });

  it("marks later pages as BCA to do while they are still unwritten", () => {
    assert.equal(pageStatusBySlug("campaigns", row()), "bca");
    assert.equal(pageStatusBySlug("profile", row()), "bca");
  });

  it("stays BCA to do once the answers are in and the page is not written yet", () => {
    const payload = emptyPracticePayload();
    for (const path of [
      "proof.career_results",
      "proof.superpowers",
      "proof.problems_asked",
      "market.roles_held",
      "market.industries_worked",
      "market.industries_credibility",
      "practice.voice_known_for",
      "practice.voice_coaching_style",
    ]) {
      fill(payload, path);
    }
    assert.equal(pageStatusBySlug("profile", row({ payload })), "bca");
  });

  it("asks for a review once BCA has written the page", () => {
    const at = "2026-02-01T00:00:00.000Z";
    const built = { blocks: [{ type: "lede" as const, text: "Ready" }], generated_at: at, model: "m" };
    assert.equal(
      pageStatusBySlug("profile", row({ built_sections: { "story:bio": built, "story:onepager": built } })),
      "review"
    );
  });

  it("stays BCA to do when some of the page is written and the rest is not", () => {
    const at = "2026-02-01T00:00:00.000Z";
    const built = { blocks: [{ type: "lede" as const, text: "Ready" }], generated_at: at, model: "m" };
    assert.equal(pageStatusBySlug("profile", row({ built_sections: { "story:bio": built } })), "bca");
  });

  it("marks a page done once the coach has signed off the current version", () => {
    const at = "2026-02-01T00:00:00.000Z";
    const payload = emptyPracticePayload();
    payload.review.approved_sections = sourced({ "story:bio": at, "story:onepager": at }, "coach_edit", at);
    const built = { blocks: [{ type: "lede" as const, text: "Ready" }], generated_at: at, model: "m" };
    assert.equal(
      pageStatusBySlug(
        "profile",
        row({ payload, built_sections: { "story:bio": built, "story:onepager": built } })
      ),
      "done"
    );
  });
});
