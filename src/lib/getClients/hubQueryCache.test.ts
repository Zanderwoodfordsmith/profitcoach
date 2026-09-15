import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearHubQueries,
  fetchHubQuery,
  invalidateHubQuery,
  isHubQueryFresh,
  patchHubQuery,
  peekHubQuery,
  writeHubQuery,
} from "./hubQueryCache";

describe("hubQueryCache", () => {
  it("returns cached data instantly and dedupes in-flight fetches", async () => {
    clearHubQueries();
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return { n: calls };
    };

    const [a, b] = await Promise.all([
      fetchHubQuery("t:dup", fetcher),
      fetchHubQuery("t:dup", fetcher),
    ]);
    assert.equal(calls, 1);
    assert.deepEqual(a, { n: 1 });
    assert.deepEqual(b, { n: 1 });
    assert.deepEqual(peekHubQuery("t:dup"), { n: 1 });
    assert.equal(isHubQueryFresh("t:dup"), true);

    const again = await fetchHubQuery("t:dup", fetcher);
    assert.equal(calls, 1);
    assert.deepEqual(again, { n: 1 });
  });

  it("keeps stale data while a forced refresh runs, then patches", async () => {
    clearHubQueries();
    writeHubQuery("t:patch", { items: [1] });
    patchHubQuery<{ items: number[] }>("t:patch", (prev) => ({
      items: [...prev.items, 2],
    }));
    assert.deepEqual(peekHubQuery("t:patch"), { items: [1, 2] });

    invalidateHubQuery("t:patch");
    assert.equal(isHubQueryFresh("t:patch"), false);
    assert.deepEqual(peekHubQuery("t:patch"), { items: [1, 2] });

    const next = await fetchHubQuery("t:patch", async () => ({ items: [9] }), {
      force: true,
    });
    assert.deepEqual(next, { items: [9] });
  });
});
