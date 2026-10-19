import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sanitizeBuiltSections } from "./blocks";

const para = (text: string) => [{ type: "paragraph", text }];

describe("built sections", () => {
  it("keeps the version before Ava's change, so she can put it back", () => {
    const out = sanitizeBuiltSections({
      "story:bio": {
        blocks: para("New bio"),
        generated_at: "2026-10-01T09:00:00.000Z",
        model: "ava",
        edited_at: "2026-10-19T10:00:00.000Z",
        previous: {
          blocks: para("Old bio"),
          generated_at: "2026-10-01T09:00:00.000Z",
          model: "claude",
          edited_at: null,
          replaced_at: "2026-10-19T10:00:00.000Z",
          previous: { blocks: para("Older still") },
        },
      },
    });
    const previous = out["story:bio"].previous;
    assert.deepEqual(previous?.blocks, para("Old bio"));
    assert.equal(previous?.replaced_at, "2026-10-19T10:00:00.000Z");
    assert.ok(!("previous" in (previous ?? {})), "only one step back is kept");
  });

  it("drops an earlier version that is empty or has no change time", () => {
    const out = sanitizeBuiltSections({
      "story:bio": { blocks: para("Bio"), generated_at: "x", model: "ava", previous: { blocks: para("Old") } },
      "offer:lines": { blocks: para("Lines"), generated_at: "x", model: "ava", previous: { blocks: [], replaced_at: "y" } },
    });
    assert.equal(out["story:bio"].previous, undefined);
    assert.equal(out["offer:lines"].previous, undefined);
  });
});
