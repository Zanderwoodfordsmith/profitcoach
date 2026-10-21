import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ANGLES } from "./angles";

const FILL_INS = new Set(["name", "problem", "result"]);

describe("ready-made pitches", () => {
  it("has the standard pitch first, then Pam's five angles", () => {
    assert.deepEqual(
      ANGLES.map((a) => a.id),
      ["standard", "customers", "off-tools", "profit", "systems", "team"]
    );
  });

  for (const angle of ANGLES) {
    it(`${angle.title}: nine steps, three phases, and only known fill-ins`, () => {
      assert.equal(angle.steps.length, 9);
      assert.equal(angle.phases.length, 3);
      // After the pitch asks it, so Bringing it together must not ask it too.
      assert.ok(!/How do you feel/i.test(angle.together), "the closing question is asked once, in After the pitch");
      const all = [...angle.steps, angle.together, angle.bridge, ...angle.phases.flatMap((p) => [p.text, p.check]), angle.recap];
      for (const text of all) {
        assert.ok(text.trim(), "no empty paragraphs");
        assert.ok(!text.includes("—"), `em dash in: ${text.slice(0, 60)}`);
        assert.ok(!/because you told me/i.test(text), `"because you told me" in: ${text.slice(0, 60)}`);
        for (const [, key] of text.matchAll(/\{(\w+)\}/g)) assert.ok(FILL_INS.has(key), `unknown fill-in {${key}}`);
      }
    });
  }
});
