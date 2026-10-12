import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IN_FILTER_MAX_CHARS,
  IN_FILTER_MAX_COUNT,
  chunkForInFilter,
} from "./inFilterChunks";

describe("chunkForInFilter", () => {
  it("splits a 250-person LinkedIn URL batch under the header cap", () => {
    const urls = Array.from(
      { length: 250 },
      (_, index) => `https://www.linkedin.com/in/person-${index}-slug`
    );
    const chunks = chunkForInFilter(urls);
    assert.ok(chunks.length > 1);
    assert.equal(chunks.flat().length, 250);
    for (const chunk of chunks) {
      assert.ok(chunk.length <= IN_FILTER_MAX_COUNT);
      const chars = chunk.reduce((sum, value) => sum + value.length + 3, 0);
      assert.ok(chars <= IN_FILTER_MAX_CHARS);
    }
  });

  it("keeps a single very long value instead of dropping it", () => {
    const huge = "x".repeat(IN_FILTER_MAX_CHARS + 50);
    assert.deepEqual(chunkForInFilter([huge]), [[huge]]);
  });
});
