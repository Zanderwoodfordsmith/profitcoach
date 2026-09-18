import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DRAG_AUTO_SCROLL_EDGE_BOTTOM_PX,
  DRAG_AUTO_SCROLL_EDGE_TOP_PX,
  DRAG_AUTO_SCROLL_MAX_PX,
  dragAutoScrollDelta,
} from "./dragAutoScroll";

describe("dragAutoScrollDelta", () => {
  it("scrolls up as the pointer approaches the top edge", () => {
    const delta = dragAutoScrollDelta(40, 0, 800);
    assert.ok(delta < 0);
    assert.ok(Math.abs(delta) <= DRAG_AUTO_SCROLL_MAX_PX);
  });

  it("scrolls faster closer to the top than further into the edge zone", () => {
    const near = dragAutoScrollDelta(0, 0, 800);
    const far = dragAutoScrollDelta(DRAG_AUTO_SCROLL_EDGE_TOP_PX - 10, 0, 800);
    assert.ok(near < far);
    assert.equal(near, -DRAG_AUTO_SCROLL_MAX_PX);
  });

  it("scrolls down as the pointer approaches the bottom edge", () => {
    const delta = dragAutoScrollDelta(800 - 20, 0, 800);
    assert.ok(delta > 0);
    assert.ok(delta <= DRAG_AUTO_SCROLL_MAX_PX);
  });

  it("does nothing in the middle of the viewport", () => {
    assert.equal(dragAutoScrollDelta(400, 0, 800), 0);
  });

  it("starts scrolling at the top edge boundary", () => {
    assert.equal(dragAutoScrollDelta(DRAG_AUTO_SCROLL_EDGE_TOP_PX, 0, 800), 0);
    assert.ok(dragAutoScrollDelta(DRAG_AUTO_SCROLL_EDGE_TOP_PX - 1, 0, 800) < 0);
  });

  it("starts scrolling at the bottom edge boundary", () => {
    assert.equal(
      dragAutoScrollDelta(800 - DRAG_AUTO_SCROLL_EDGE_BOTTOM_PX, 0, 800),
      0
    );
    assert.ok(
      dragAutoScrollDelta(800 - DRAG_AUTO_SCROLL_EDGE_BOTTOM_PX + 1, 0, 800) > 0
    );
  });

  it("ignores invalid coordinates", () => {
    assert.equal(dragAutoScrollDelta(Number.NaN, 0, 800), 0);
    assert.equal(dragAutoScrollDelta(40, 800, 800), 0);
  });
});
