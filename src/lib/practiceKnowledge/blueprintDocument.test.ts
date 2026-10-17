import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { blocksToMarkdown, sanitizeBlocks, sanitizeBuiltSections } from "./blocks";
import { BLUEPRINT_SECTIONS, buildOrder, openQuestions, sectionByKey, sectionState, stillNeeded } from "./blueprint";
import { CAMPAIGN_HANDOFFS, campaignPlan, handoffById, toCampaignTokens } from "./campaignHandoff";
import { proposedDecision } from "./decisionDefaults";
import { blueprintMarkdown } from "./exportMarkdown";
import { SECTION_SKILLS, skillUserPrompt } from "./skills";
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

describe("blueprint blocks", () => {
  it("drops unknown and empty blocks and strips em dashes", () => {
    const blocks = sanitizeBlocks([
      { type: "lede", text: "Grew profit — fast" },
      { type: "mystery", text: "x" },
      { type: "bullets", items: ["", "  "] },
      { type: "table", columns: ["A", "B"], rows: [["1"]] },
    ]);
    assert.equal(blocks.length, 2);
    assert.deepEqual(blocks[0], { type: "lede", text: "Grew profit - fast" });
    assert.deepEqual(blocks[1], { type: "table", columns: ["A", "B"], rows: [["1", ""]] });
  });

  it("renders tables and messages as markdown", () => {
    const md = blocksToMarkdown([
      { type: "table", columns: ["Pain", "Lever"], rows: [["Margin | leak", "Profit"]] },
      { type: "message", label: "Connection request", body: "Hi {first_name}" },
    ]);
    assert.match(md, /\| Pain \| Lever \|/);
    assert.match(md, /Margin \\\| leak/);
    assert.match(md, /```text\nHi \{first_name\}\n```/);
  });

  it("keeps only valid section keys", () => {
    const out = sanitizeBuiltSections({
      "market:avatar": { blocks: [{ type: "lede", text: "Steve" }], generated_at: "t", model: "m" },
      "bad key": { blocks: [{ type: "lede", text: "x" }] },
    });
    assert.deepEqual(Object.keys(out), ["market:avatar"]);
  });
});

describe("blueprint map", () => {
  it("has a skill for every We build section, and no stray skills", () => {
    const build = BLUEPRINT_SECTIONS.filter((r) => r.section.source === "we_build").map((r) => r.key).sort();
    // Skills for hidden pages (90 days) are kept for later.
    const visible = Object.keys(SECTION_SKILLS).filter((key) => sectionByKey(key));
    assert.deepEqual(visible.sort(), build);
  });

  it("orders builds after what they need", () => {
    const order = buildOrder();
    for (const key of order) {
      for (const need of sectionByKey(key)?.section.needs ?? []) {
        assert.ok(order.indexOf(need) < order.indexOf(key), `${need} before ${key}`);
      }
    }
  });

  it("asks for proof before practical setup", () => {
    const qs = openQuestions(row());
    const firstSetup = qs.findIndex((q) => q.path.startsWith("identity.phone"));
    const firstProof = qs.findIndex((q) => q.path === "proof.career_results");
    assert.ok(firstProof >= 0 && firstProof < firstSetup);
  });

  it("marks a from-you section ready once its required fields are filled", () => {
    const ref = sectionByKey("story:problems")!;
    const payload = emptyPracticePayload();
    assert.equal(sectionState(ref, row({ payload })), "open");
    payload.proof.problems_asked = sourced(["Margin leaks"], "interview");
    assert.equal(sectionState(ref, row({ payload })), "ready");
    assert.ok(!stillNeeded(row({ payload })).some((r) => r.key === "story:problems"));
  });

  it("puts marketing authenticity on Your Voice, and the voice writer reads it", () => {
    const paths = ["voice:known", "voice:stand", "voice:colour"].flatMap(
      (key) => sectionByKey(key)?.section.fields?.map((f) => f.path) ?? []
    );
    for (const path of [
      "practice.voice_known_for",
      "practice.voice_coaching_style",
      "practice.voice_pet_peeves",
      "practice.voice_like_in_people",
      "practice.voice_values",
      "practice.voice_favourite_book",
      "practice.voice_favourite_film",
      "practice.voice_hobbies",
      "practice.voice_stories",
    ]) {
      assert.ok(paths.some((p) => p === path), path);
    }
    const uses = sectionByKey("voice:sound")?.section.uses?.fields ?? [];
    assert.ok(uses.some((p) => p === "practice.voice_known_for"));
    assert.ok(uses.some((p) => p === "practice.voice_hobbies"));
  });
});

describe("exports and handoff", () => {
  it("writes the whole blueprint as markdown in document order", () => {
    const md = blueprintMarkdown(
      row({ built_sections: { "market:avatar": { blocks: [{ type: "lede", text: "Site-Tied Steve" }], generated_at: "", model: "" } } }),
      { coachName: "Pam Woodford" }
    );
    assert.match(md, /^# The Practice Blueprint: Pam Woodford/);
    assert.ok(md.indexOf("# About You") > -1 && md.indexOf("# About You") < md.indexOf("# Get Calls"));
    assert.match(md, /Site-Tied Steve/);
    assert.match(md, /_Not written yet._/);
  });

  it("converts tokens and builds connection steps with waits, from a section written before the split", () => {
    assert.equal(toCampaignTokens("Hi {first_name} at {company}"), "Hi {{first_name}} at {{company}}");
    const plan = campaignPlan(
      handoffById("connection")!,
      {
        blocks: [
          { type: "heading", text: "Campaign A: Connector" },
          { type: "message", label: "Connection request", body: "Hi {first_name}, I see you run..." },
          { type: "message", label: "Message 1", body: "Great to connect" },
          { type: "heading", text: "Campaign B: Conversation into the BOSS Scorecard" },
          { type: "message", label: "After connecting", body: "Growing or protecting?" },
        ],
        generated_at: "",
        model: "",
      }
    )!;
    assert.deepEqual(plan.steps.map((step) => step.step_type), ["invite", "wait", "message"]);
    assert.equal(plan.steps[0].body, "Hi {{first_name}}, I see you run...");
    assert.equal(plan.steps[2].send_mode, "remind");
  });
});

describe("campaigns and contracts", () => {
  it("builds message-only campaigns for people already connected", () => {
    const plan = campaignPlan(handoffById("reactivation")!, {
      blocks: [
        { type: "heading", text: "Who gets it" },
        { type: "heading", text: "The sequence" },
        { type: "message", label: "Reconnect", body: "Hi {first_name}, [shared history]" },
        { type: "message", label: "What I do now", body: "These days I help..." },
      ],
      generated_at: "",
      model: "",
    })!;
    assert.deepEqual(plan.steps.map((step) => step.step_type), ["message", "wait", "message"]);
    assert.equal(plan.steps[0].body, "Hi {{first_name}}, [shared history]");
    assert.equal(plan.steps[1].wait_hours, 120);
  });

  it("keeps the old agent names working", () => {
    assert.equal(handoffById("connector")?.id, "connection");
    assert.equal(handoffById("conversation")?.id, "messaging");
  });

  it("sends every campaign from a written section that exists", () => {
    for (const handoff of CAMPAIGN_HANDOFFS) {
      assert.ok(sectionByKey(handoff.section), handoff.section);
      assert.ok(SECTION_SKILLS[handoff.section], `${handoff.section} has a writer`);
    }
  });

  it("only lists answers that exist in a writer's contract", () => {
    const paths = new Set(BLUEPRINT_SECTIONS.flatMap((ref) => (ref.section.fields ?? []).map((f) => f.path)));
    for (const ref of BLUEPRINT_SECTIONS) {
      for (const path of ref.section.uses?.fields ?? []) assert.ok(paths.has(path), `${ref.key} reads ${path}`);
      if (ref.section.source === "we_build") assert.ok(ref.section.uses, `${ref.key} has a contract`);
    }
  });

  it("gives a writer only the answers its contract lists", () => {
    const payload = emptyPracticePayload();
    payload.practice.min_fee = sourced("£1,500 a month", "interview");
    payload.client.pains_now = sourced(["Cash is always tight"], "interview");
    const user = skillUserPrompt({
      key: "offer:payment",
      row: row({ payload }),
      coachName: "Pam",
      linkedinSummary: "",
      turns: [{ role: "user", content: "secret transcript line", at: "" }],
      decision: "",
      library: "",
    });
    assert.match(user, /£1,500 a month/);
    assert.doesNotMatch(user, /Cash is always tight/);
    assert.doesNotMatch(user, /secret transcript line/);
  });
});

describe("decisions", () => {
  it("proposes the record from the pre-read and the coach's own terms", () => {
    const payload = emptyPracticePayload();
    payload.practice.min_fee = sourced("£1,500 a month", "interview");
    payload.practice.payment_terms = sourced("six-month minimum", "interview");
    payload.practice.guarantee = sourced("none", "interview");
    const proposal = proposedDecision(
      row({
        payload,
        report_payload: {
          experience_summary: "",
          proof_inventory: "",
          market_hypotheses: [{ industry: "Building services", buyer: "Owner-MD", problem: "Cash is tight", score_notes: "" }],
          offer_direction: "",
          positioning: "Profit coaching for building services owners",
          campaign_angle: "Find the cash you are owed",
          missing_info: [],
          decision_questions: [],
        },
      })
    );
    assert.equal(proposal.target_market, "Building services");
    assert.equal(proposal.price, "From £1,500 a month, six-month minimum");
    assert.equal(proposal.guarantee, "No guarantee");
    assert.equal(proposal.campaign_angle, "Find the cash you are owed");
  });

  it("puts the locked decisions first in the export", () => {
    const decision = {
      id: "d1",
      coach_id: "c1",
      payload: { ...proposedDecision(row()), target_market: "Dental practices" },
      locked_at: "2026-10-14T10:00:00Z",
      locked_by: null,
      created_at: "",
      updated_at: "",
    };
    const md = blueprintMarkdown(row(), { coachName: "Pam Woodford", decision });
    assert.match(md, /Agreed on the Decision Call/);
    assert.match(md, /\*\*Market:\*\* Dental practices/);
    assert.ok(md.indexOf("# Your Decisions") < md.indexOf("# About You"));
  });
});
