import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { moveSequenceItem } from "./campaignStepReorder";

describe("moveSequenceItem", () => {
  it("moves an item earlier", () => {
    assert.deepEqual(moveSequenceItem(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
  });

  it("moves an item later", () => {
    assert.deepEqual(moveSequenceItem(["a", "b", "c"], 0, 3), ["b", "c", "a"]);
  });

  it("ignores a drop on the item's own trailing gap", () => {
    assert.deepEqual(moveSequenceItem(["a", "b", "c"], 1, 2), ["a", "b", "c"]);
  });
});
