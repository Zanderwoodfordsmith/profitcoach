import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { inToneOrder, type Tone } from "./blocks";

describe("answer order", () => {
  it("puts answers best to worst, keeping the script's order within a colour", () => {
    const answers = (["red", "green", "blue", "orange", "green", "yellow"] as Tone[]).map((tone, i) => ({ tone, i }));
    assert.deepEqual(
      inToneOrder(answers).map((a) => `${a.tone}${a.i}`),
      ["green1", "green4", "yellow5", "blue2", "orange3", "red0"]
    );
  });
});
