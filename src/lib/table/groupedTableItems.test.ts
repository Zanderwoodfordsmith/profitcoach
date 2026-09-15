import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGroupedTableItems,
  toggleCollapsedGroupKey,
} from "./groupedTableItems";

describe("grouped table items", () => {
  const sections = [
    { key: "a", rows: [1, 2] },
    { key: "b", rows: [3] },
  ];

  it("includes headers and rows when expanded", () => {
    const items = buildGroupedTableItems(sections, new Set(), (s) => s.rows);
    assert.deepEqual(
      items.map((item) =>
        item.type === "header" ? item.section.key : item.row
      ),
      ["a", 1, 2, "b", 3]
    );
  });

  it("keeps a collapsed header and hides its rows", () => {
    const items = buildGroupedTableItems(
      sections,
      new Set(["a"]),
      (s) => s.rows
    );
    assert.deepEqual(
      items.map((item) =>
        item.type === "header" ? item.section.key : item.row
      ),
      ["a", "b", 3]
    );
  });

  it("toggles a collapsed key on and off", () => {
    const collapsed = toggleCollapsedGroupKey(new Set(), "a");
    assert.equal(collapsed.has("a"), true);
    assert.equal(toggleCollapsedGroupKey(collapsed, "a").has("a"), false);
  });
});
