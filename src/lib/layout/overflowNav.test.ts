import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  planOverflowNav,
  visibleIndicesForCount,
} from "./overflowNav";

const GAP = 16;
const MORE = 36;

describe("visibleIndicesForCount", () => {
  it("keeps the leading tabs when the active one already fits", () => {
    assert.deepEqual(visibleIndicesForCount(3, 6, 1), [0, 1, 2]);
  });

  it("swaps the last slot for the active tab when it would overflow", () => {
    assert.deepEqual(visibleIndicesForCount(3, 6, 4), [0, 1, 4]);
  });
});

describe("planOverflowNav", () => {
  const widths = [90, 110, 70, 90, 80, 60];

  it("shows every tab when they fit", () => {
    const plan = planOverflowNav({
      itemWidths: widths,
      availableWidth: 800,
      moreWidth: MORE,
      gap: GAP,
      activeIndex: 0,
    });
    assert.equal(plan.mode, "all");
    assert.deepEqual(plan.visibleIndices, [0, 1, 2, 3, 4, 5]);
    assert.deepEqual(plan.overflowIndices, []);
  });

  it("keeps a More control for leftover tabs", () => {
    const plan = planOverflowNav({
      itemWidths: widths,
      availableWidth: 90 + 16 + 110 + 16 + 70 + 16 + MORE,
      moreWidth: MORE,
      gap: GAP,
      activeIndex: 0,
    });
    assert.equal(plan.mode, "more");
    assert.deepEqual(plan.visibleIndices, [0, 1, 2]);
    assert.deepEqual(plan.overflowIndices, [3, 4, 5]);
  });

  it("keeps the active tab on the bar when it would otherwise overflow", () => {
    const plan = planOverflowNav({
      itemWidths: widths,
      availableWidth: 90 + 16 + 110 + 16 + 80 + 16 + MORE,
      moreWidth: MORE,
      gap: GAP,
      activeIndex: 4,
    });
    assert.equal(plan.mode, "more");
    assert.ok(plan.visibleIndices.includes(4));
    assert.ok(plan.overflowIndices.includes(2));
  });

  it("keeps a single tab plus More when that is all that fits", () => {
    const plan = planOverflowNav({
      itemWidths: widths,
      availableWidth: 90 + 16 + MORE,
      moreWidth: MORE,
      gap: GAP,
      activeIndex: 0,
    });
    assert.equal(plan.mode, "more");
    assert.deepEqual(plan.visibleIndices, [0]);
    assert.deepEqual(plan.overflowIndices, [1, 2, 3, 4, 5]);
  });

  it("collapses to a hamburger when not even one tab fits with More", () => {
    const plan = planOverflowNav({
      itemWidths: widths,
      availableWidth: 90,
      moreWidth: MORE,
      gap: GAP,
      activeIndex: 0,
    });
    assert.equal(plan.mode, "menu");
    assert.deepEqual(plan.visibleIndices, []);
    assert.deepEqual(plan.overflowIndices, [0, 1, 2, 3, 4, 5]);
  });
});
