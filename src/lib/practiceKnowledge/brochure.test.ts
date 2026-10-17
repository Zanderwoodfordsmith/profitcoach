import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyPracticePayload, sourced } from "./sourced";
import type { PracticeKnowledgeRow } from "./types";
import { programmeBrochureFromBlueprint } from "./brochure";

const AT = "2026-10-10T10:00:00.000Z";

function row(): PracticeKnowledgeRow {
  const payload = emptyPracticePayload();
  payload.proof.problems_asked = sourced(["Cash is always tight"], "interview");
  payload.practice.help_with = sourced(["The weekly number", "A 90-day plan that sticks"], "interview");
  payload.practice.offer_timeframe = sourced("A number they trust within 90 days", "interview");
  payload.practice.min_fee = sourced("£1,500 a month", "interview");
  payload.proof.client_results = sourced(
    [{ id: "a", title: "Jane Doe, MD (testimonial)", story: "She found the margin." }],
    "admin"
  );
  return {
    coach_id: "c1",
    status: "capturing",
    payload,
    linkedin_seeded_at: null,
    form_completed_at: null,
    interview_completed_at: null,
    coach_reviewed_at: null,
    admin_reviewed_at: null,
    completeness_score: 0,
    missing_fields: [],
    report_payload: null,
    report_generated_at: null,
    built_sections: {
      "offer:lines": {
        blocks: [
          { type: "heading", text: "Short" },
          { type: "message", label: "Short line", body: "I help trade MDs keep more." },
        ],
        generated_at: AT,
        model: "test",
      },
      "story:bio": {
        blocks: [
          { type: "heading", text: "Short bio" },
          { type: "paragraph", text: "I help trade MDs keep the margin they already earn." },
          {
            type: "stats",
            items: [
              { value: "28", label: "Years in business" },
              { value: "11%", label: "Net margin" },
            ],
          },
        ],
        generated_at: AT,
        model: "test",
      },
    },
    created_at: AT,
    updated_at: AT,
  };
}

describe("90-day programme brochure", () => {
  it("fills a sendable pack from Blueprint sources, with the fee held back", () => {
    const pack = programmeBrochureFromBlueprint({
      slug: "jo",
      name: "Jo Bloggs",
      avatarUrl: null,
      profileLocation: null,
      row: row(),
    });
    assert.equal(pack.ready, true);
    assert.equal(pack.headline, "I help trade MDs keep more.");
    assert.deepEqual(pack.problems, ["Cash is always tight"]);
    assert.deepEqual(pack.helpWith, ["The weekly number", "A 90-day plan that sticks"]);
    assert.equal(pack.fee, "£1,500 a month");
    assert.equal(pack.scoreUrl, "/score/jo");
    assert.equal(pack.gaps.length, 0);
  });

  it("lists the Blueprint pages still needed when the pack is thin", () => {
    const pack = programmeBrochureFromBlueprint({
      slug: null,
      name: "Jo Bloggs",
      avatarUrl: null,
      profileLocation: null,
      row: null,
    });
    assert.equal(pack.ready, false);
    assert.ok(pack.gaps.some((gap) => gap.href.includes("/blueprint/story")));
    assert.ok(pack.gaps.some((gap) => gap.href.includes("/blueprint/offer")));
  });
});
