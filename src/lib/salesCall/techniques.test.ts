import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OBJECTION_PAGES } from "./objections";
import { PHASES } from "./script";
import { TECHNIQUES } from "./techniques";

describe("skill explainers", () => {
  it("explains confidence looping wherever the script mentions it", () => {
    const script = JSON.stringify([PHASES, OBJECTION_PAGES]);
    const mentions = script.match(/confidence[- ]loop\w*/gi) ?? [];
    assert.ok(mentions.length > 0);
    for (const m of mentions) assert.ok(TECHNIQUES.some((t) => t.match.test(m)), m);
  });

  it("never uses an em dash", () => {
    assert.ok(!JSON.stringify(TECHNIQUES.map((t) => [t.name, t.summary, t.blocks])).includes("—"));
  });
});
