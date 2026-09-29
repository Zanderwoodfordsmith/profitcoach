import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { blocksToMarkdown, sanitizeBlocks, sanitizeBuiltSections } from "./blocks";
import { BLUEPRINT_SECTIONS, buildOrder, openQuestions, sectionByKey, sectionState, stillNeeded } from "./blueprint";
import { campaignStepsFromSection, toCampaignTokens } from "./campaignHandoff";
import { blueprintMarkdown } from "./exportMarkdown";
import { SECTION_SKILLS } from "./skills";
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
    assert.deepEqual(Object.keys(SECTION_SKILLS).sort(), build);
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
});

describe("exports and handoff", () => {
  it("writes the whole blueprint as markdown in document order", () => {
    const md = blueprintMarkdown(
      row({ built_sections: { "market:avatar": { blocks: [{ type: "lede", text: "Site-Tied Steve" }], generated_at: "", model: "" } } }),
      { coachName: "Pam Woodford" }
    );
    assert.match(md, /^# The Practice Blueprint: Pam Woodford/);
    assert.ok(md.indexOf("# Foundation") < md.indexOf("# Get calls"));
    assert.match(md, /Site-Tied Steve/);
    assert.match(md, /_Not written yet._/);
  });

  it("converts tokens and builds connector steps with waits", () => {
    assert.equal(toCampaignTokens("Hi {first_name} at {company}"), "Hi {{first_name}} at {{company}}");
    const plan = campaignStepsFromSection(
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
      },
      "connector"
    )!;
    assert.deepEqual(plan.steps.map((s) => s.step_type), ["invite", "wait", "message"]);
    assert.equal(plan.steps[0].body, "Hi {{first_name}}, I see you run...");
    assert.equal(plan.steps[2].send_mode, "remind");
  });
});
