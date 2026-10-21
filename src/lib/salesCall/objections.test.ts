import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type Block, OBJECTION_PAGES, pageById } from "./objections";

function walk(blocks: Block[], visit: (b: Block) => void) {
  for (const b of blocks) {
    visit(b);
    if (b.type === "response") walk(b.blocks, visit);
  }
}

describe("objection pages", () => {
  it("has one page per objection, in the call script's order", () => {
    assert.deepEqual(
      OBJECTION_PAGES.map((p) => p.id),
      ["think", "money", "partner", "timing", "fear", "decide", "cheaper", "unclear", "loops", "score", "deposit", "responsibility", "contract", "booknext", "payment", "referrals"]
    );
  });

  it("only links to pages that exist", () => {
    for (const page of OBJECTION_PAGES) {
      walk(page.blocks, (b) => {
        if (b.type === "goto") assert.ok(pageById(b.to), `${page.id} links to missing page ${b.to}`);
      });
    }
  });

  it("gives every response something to say or do", () => {
    for (const page of OBJECTION_PAGES) {
      walk(page.blocks, (b) => {
        if (b.type === "response") assert.ok(b.blocks.length, `${page.id}: "${b.label}" is empty`);
      });
    }
  });

  it("never uses an em dash", () => {
    assert.ok(!JSON.stringify(OBJECTION_PAGES).includes("—"));
  });
});
