import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Block } from "../blocks";
import { PHASES } from "../script";
import { SCRIPTS, scriptById } from "./index";

function walk(blocks: Block[], visit: (b: Block) => void) {
  for (const b of blocks) {
    visit(b);
    if (b.type === "response") walk(b.blocks, visit);
  }
}

const everyBlock = (visit: (b: Block) => void) => SCRIPTS.forEach((s) => s.parts?.forEach((p) => walk(p.blocks, visit)));

describe("scripts library", () => {
  it("has six scripts in funnel order, each part with a unique id", () => {
    assert.deepEqual(
      SCRIPTS.map((s) => s.id),
      ["reach-out", "new-lead", "objections", "review", "roadmap", "no-shows"],
    );
    for (const s of SCRIPTS) {
      const ids = (s.parts ?? []).map((p) => p.id);
      assert.equal(new Set(ids).size, ids.length, s.id);
      for (const p of s.parts ?? []) assert.ok(p.blocks.length, `${s.id}/${p.id} is empty`);
    }
  });

  it("only links to scripts and parts that exist", () => {
    everyBlock((b) => {
      if (b.type !== "see") return;
      const target = scriptById(b.script);
      assert.ok(target, `no script ${b.script}`);
      if (!b.part) return;
      const parts = target.parts ? target.parts.map((p) => p.id) : PHASES.map((p) => p.id);
      assert.ok(parts.includes(b.part), `no part ${b.script}/${b.part}`);
    });
  });

  it("never uses an em dash", () => {
    everyBlock((b) => assert.ok(!JSON.stringify(b).includes("—"), JSON.stringify(b).slice(0, 80)));
    for (const s of SCRIPTS) assert.ok(!`${s.title}${s.summary}`.includes("—"));
  });
});
