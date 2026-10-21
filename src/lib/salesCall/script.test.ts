import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Block } from "./blocks";
import { pageById } from "./objections";
import { PHASES, PITCH_KINDS, PITCH_PHASES } from "./script";

function walk(blocks: Block[], visit: (b: Block) => void) {
  for (const b of blocks) {
    visit(b);
    if (b.type === "response") walk(b.blocks, visit);
  }
}

describe("call steps", () => {
  it("runs in call order", () => {
    assert.deepEqual(
      PHASES.map((p) => p.id),
      ["discovery", "pitch", "investment", "objections", "closes", "next"]
    );
  });

  it("only links to objection pages that exist, and never leaves an answer empty", () => {
    for (const phase of PHASES) {
      walk(phase.blocks, (b) => {
        if (b.type === "goto") assert.ok(pageById(b.to), `${phase.id} links to missing page ${b.to}`);
        if (b.type === "response") assert.ok(b.blocks.length, `${phase.id}: "${b.label}" is empty`);
      });
    }
  });

  it("starts Investment with the temperature check, with a reply for 10, 9, 8 or less and an unconvincing score", () => {
    const labels: string[] = [];
    walk(PHASES.find((p) => p.id === "investment")!.blocks, (b) => b.type === "response" && labels.push(b.label));
    for (const want of ["Convincing 10", "Convincing 9", "Honest 8 or less", "Unconvincing score"]) assert.ok(labels.includes(want), want);
  });

  it("offers two pitches, the second in three phases", () => {
    assert.deepEqual(PITCH_KINDS.map((k) => k.id), ["steps", "phases"]);
    assert.equal(PITCH_PHASES.length, 3);
  });

  it("never uses an em dash", () => {
    assert.ok(!JSON.stringify([PHASES, PITCH_KINDS, PITCH_PHASES]).includes("—"));
  });
});
