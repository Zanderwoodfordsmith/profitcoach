import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { editedByHand } from "@/lib/practiceKnowledge/blocks";
import type { BuiltSection } from "@/lib/practiceKnowledge/types";

import { cutShort, mergeEntries, sanitizedAnswer } from "./blueprintAva";

const blocks = [{ type: "paragraph" as const, text: "Hi" }];

describe("Ava Blueprint saves (job 233)", () => {
  it("adds one result and updates another by id, keeping the rest and blank values", () => {
    const current = [
      { id: "r1", company: "Jolly Foods", role: "Managing Director", metric_from: "£1.25m" },
      { id: "r2", company: "KMS Litho", role: "", metric_from: "£2m" },
    ];
    const merged = mergeEntries(current, [
      { id: "r1", role: "", metric_to: "£1.6m" },
      { company: "Polythene UK", metric_from: "£720k", metric_to: "£6.4m" },
    ]) as Record<string, string>[];
    assert.equal(merged.length, 3);
    assert.equal(merged[0].role, "Managing Director", "a blank value keeps what was there");
    assert.equal(merged[0].metric_to, "£1.6m");
    assert.equal(merged[1].company, "KMS Litho", "untouched entries stay");
    assert.equal(merged[2].company, "Polythene UK");
  });

  it("refuses to cut a long result summary or text box", () => {
    const long = "x".repeat(400);
    const cuts: string[] = [];
    const sent = [{ id: "r2", company: "Jolly Foods", summary: long }];
    cutShort(sent, sanitizedAnswer("proof", "career_results", sent).saved?.value, "Results", cuts);
    assert.equal(cuts.length, 1);
    assert.match(cuts[0], /summary \(at most 240 characters, this was 400\)/);

    const ok: string[] = [];
    const short = [{ id: "r2", company: "Jolly Foods", summary: "Turnover up 28%" }];
    cutShort(short, sanitizedAnswer("proof", "career_results", short).saved?.value, "Results", ok);
    assert.deepEqual(ok, []);
  });

  it("only counts a person's edits as hand edits, not Ava's own saves", () => {
    const written: BuiltSection = { blocks, generated_at: "2026-10-01", model: "claude", edited_at: null };
    assert.equal(editedByHand(written), false);
    assert.equal(editedByHand({ ...written, edited_at: "2026-10-02" }), true, "coach edited BCA's copy");
    const avaSaved: BuiltSection = {
      ...written,
      model: "ava",
      edited_at: "2026-10-03",
      previous: { ...written, replaced_at: "2026-10-03" },
    };
    assert.equal(editedByHand(avaSaved), false, "Ava's save is not a hand edit");
    assert.equal(editedByHand({ ...avaSaved, edited_at: "2026-10-04" }), true, "coach edited after Ava");
    assert.equal(editedByHand({ blocks, generated_at: "2026-10-05", model: "ava", edited_at: "2026-10-05" }), false);
  });
});
