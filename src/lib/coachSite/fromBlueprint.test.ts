import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyPracticePayload, foldRetiredAnswers, sourced } from "@/lib/practiceKnowledge/sourced";
import type { BlueprintBlock, PracticeKnowledgeRow } from "@/lib/practiceKnowledge/types";
import { coachSiteFromBlueprint } from "./fromBlueprint";

const AT = "2026-10-10T10:00:00.000Z";

function row(built: Record<string, BlueprintBlock[]>): PracticeKnowledgeRow {
  const payload = emptyPracticePayload();
  payload.identity.phone = sourced("07700 900000", "form");
  payload.identity.whatsapp = sourced("1 Private Road", "form");
  payload.identity.linkedin_url = sourced("https://www.linkedin.com/in/someone", "form");
  payload.proof.client_results = sourced(
    [{ id: "a", title: "Jane Doe, MD (testimonial)", story: "'She found the margin.'" }],
    "admin"
  );
  return {
    coach_id: "c1",
    status: "capturing",
    // As loaded from the database: the old client story is now a client result.
    payload: foldRetiredAnswers(payload),
    linkedin_seeded_at: null,
    form_completed_at: null,
    interview_completed_at: null,
    coach_reviewed_at: null,
    admin_reviewed_at: null,
    completeness_score: 0,
    missing_fields: [],
    report_payload: null,
    report_generated_at: null,
    built_sections: Object.fromEntries(
      Object.entries(built).map(([k, blocks]) => [k, { blocks, generated_at: AT, model: "test" }])
    ),
    created_at: AT,
    updated_at: AT,
  };
}

const BUILT: Record<string, BlueprintBlock[]> = {
  "offer:direction": [
    { type: "lede", text: "I help owners keep more of what they earn — without the graft." },
    { type: "heading", text: "The gap" },
    { type: "table", columns: ["Today", "What they want"], rows: [["Margin leaks", "Margin holds"], ["", "half"]] },
    { type: "heading", text: "The offer" },
    {
      type: "pairs",
      items: [
        { label: "Name", value: "The Programme" },
        { label: "Price options", value: "From £1,450 a month" },
      ],
    },
    { type: "heading", text: "Why you" },
    { type: "bullets", items: ["Ran businesses for 28 years - from age 17.", "Get your time back - without the graft."] },
  ],
  "offer:lines": [
    { type: "heading", text: "Short" },
    { type: "message", label: "Short line", body: "I help trade MDs keep more." },
    { type: "heading", text: "Medium" },
    { type: "message", label: "Medium", body: "Owners turning over £1M - £8M." },
  ],
  "story:onepager": [
    { type: "lede", text: "Jo helps MDs." },
    { type: "heading", text: "The problems I fix" },
    { type: "bullets", items: ["'Where has it gone?'"] },
    { type: "heading", text: "How I work" },
    { type: "steps", items: [{ title: "Scorecard", detail: "Three minutes." }] },
    { type: "heading", text: "Results" },
    { type: "bullets", items: ["Jane Doe, MD: 'She found the margin.'", "Ranked number one."] },
    { type: "pairs", items: [{ label: "Location", value: "Hull, Yorkshire" }] },
  ],
};

describe("coach site from Blueprint", () => {
  it("maps the written sections onto the site", () => {
    const site = coachSiteFromBlueprint({
      slug: "jo",
      name: "Jo Bloggs",
      avatarUrl: null,
      lat: 53.7,
      lng: -0.3,
      profileLocation: null,
      row: row(BUILT),
    });
    assert.equal(site.firstName, "Jo");
    assert.equal(site.positioning, "I help owners keep more of what they earn, without the graft.");
    assert.equal(site.shortLine, "I help trade MDs keep more.");
    assert.equal(site.mediumLine, "Owners turning over £1M - £8M.");
    assert.deepEqual(site.gap, [{ today: "Margin leaks", want: "Margin holds" }]);
    assert.deepEqual(site.ownerWords, ["Where has it gone?"]);
    assert.deepEqual(site.whyMe, [
      "Ran businesses for 28 years, from age 17.",
      "Get your time back, without the graft.",
    ]);
    assert.equal(site.offer?.name, "The Programme");
    assert.deepEqual(site.testimonials, [{ quote: "She found the margin.", cite: "Jane Doe, MD" }]);
    assert.deepEqual(site.results, ["Ranked number one."]);
    assert.equal(site.place?.label, "Hull, Yorkshire");
    assert.equal(site.links.score, "/score/jo");
    assert.ok(site.missing.includes("story:bio"));
    assert.equal(
      site.missing.some((item) => String(item) === "story:onepager"),
      false
    );
  });

  it("fills the site from bio, offer and problems when no one-pager exists", () => {
    const { "story:onepager": _dropped, ...without } = BUILT;
    const r = row({
      ...without,
      "story:bio": [
        { type: "lede", text: "Jo is a profit coach." },
        { type: "heading", text: "Short bio" },
        { type: "paragraph", text: "I help trade MDs keep the margin." },
        { type: "heading", text: "For partners and events" },
        { type: "paragraph", text: "Jo Bloggs helps trade MDs keep the margin." },
        { type: "stats", items: [{ value: "28", label: "Years in business" }] },
      ],
    });
    r.payload.proof.problems_asked = sourced(["Where has the cash gone?"], "interview");
    r.payload.proof.career_results = sourced(
      [
        {
          id: "r1",
          company: "Harlow",
          role: "FD",
          metric_from: "4%",
          metric_to: "11%",
          timeframe: "12 months",
          mechanism: "Weekly number",
          proof_type: "career",
          precise: true,
        },
      ],
      "interview"
    );
    r.payload.practice.delivery_format = sourced("one_to_one", "interview");
    r.payload.practice.offer_timeframe = sourced("A number they trust in 90 days", "interview");
    const site = coachSiteFromBlueprint({
      slug: "jo",
      name: "Jo Bloggs",
      avatarUrl: null,
      lat: null,
      lng: null,
      profileLocation: "Hull, Yorkshire",
      row: r,
    });
    assert.equal(site.intro, "Jo Bloggs helps trade MDs keep the margin.");
    assert.deepEqual(site.ownerWords, ["Where has the cash gone?"]);
    assert.equal(site.method[0]?.title, "Start with the score");
    assert.match(site.results[0] ?? "", /4% to 11%/);
    assert.ok(!site.missing.includes("story:bio"));
  });

  it("never carries private fields or prices", () => {
    const site = coachSiteFromBlueprint({
      slug: "jo",
      name: "Jo Bloggs",
      avatarUrl: null,
      lat: null,
      lng: null,
      profileLocation: null,
      row: row(BUILT),
    });
    const text = JSON.stringify(site);
    assert.ok(!text.includes("07700"));
    assert.ok(!text.includes("Private Road"));
    assert.ok(!text.includes("£1,450"));
  });

  it("uses only signed-off sections for a live site", () => {
    const r = row(BUILT);
    r.payload.review.approved_sections = sourced({ "offer:lines": "2026-10-11T00:00:00.000Z" }, "coach_edit");
    const site = coachSiteFromBlueprint({
      slug: "jo",
      name: "Jo Bloggs",
      avatarUrl: null,
      lat: null,
      lng: null,
      profileLocation: null,
      row: r,
      approvedOnly: true,
    });
    assert.equal(site.shortLine, "I help trade MDs keep more.");
    assert.equal(site.positioning, null);
    assert.ok(site.missing.includes("offer:direction"));
  });
});
