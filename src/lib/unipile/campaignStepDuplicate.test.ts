import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { duplicateCampaignStep } from "./campaignStepDuplicate";

describe("duplicateCampaignStep", () => {
  it("inserts a copy without an id immediately below", () => {
    const steps = [
      { id: "a", position: 0, body: "Hi" },
      { id: "b", position: 1, body: "Bye" },
    ];
    const next = duplicateCampaignStep(steps, 0);
    assert.equal(next.length, 3);
    assert.equal(next[0]?.id, "a");
    assert.deepEqual(next[1], { position: 1, body: "Hi" });
    assert.equal(next[2]?.id, "b");
    assert.deepEqual(
      next.map((step) => step.position),
      [0, 1, 2]
    );
  });

  it("clones nested config so later edits do not leak", () => {
    const steps = [
      { id: "a", position: 0, config: { note: "original" } },
    ];
    const next = duplicateCampaignStep(steps, 0);
    const clone = next[1];
    assert.ok(clone);
    clone.config.note = "changed";
    assert.equal(steps[0]?.config.note, "original");
    assert.equal(next[0]?.config.note, "original");
  });

  it("returns the same array when the index is missing", () => {
    const steps = [{ id: "a", position: 0 }];
    assert.equal(duplicateCampaignStep(steps, 3), steps);
  });
});
