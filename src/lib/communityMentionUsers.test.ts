import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { broadcastMentionsForQuery } from "./communityMentionUsers";

describe("broadcastMentionsForQuery", () => {
  it("returns both groups for an empty query", () => {
    const rows = broadcastMentionsForQuery("");
    assert.deepEqual(
      rows.map((row) => row.broadcast),
      ["everyone", "coaches"]
    );
  });

  it("matches everyone from a prefix", () => {
    const rows = broadcastMentionsForQuery("eve");
    assert.deepEqual(
      rows.map((row) => row.broadcast),
      ["everyone"]
    );
  });

  it("matches Profit Coaches from profit or coach", () => {
    assert.deepEqual(
      broadcastMentionsForQuery("profit").map((row) => row.broadcast),
      ["coaches"]
    );
    assert.deepEqual(
      broadcastMentionsForQuery("coach").map((row) => row.broadcast),
      ["coaches"]
    );
  });

  it("does not match unrelated queries", () => {
    assert.deepEqual(broadcastMentionsForQuery("zander"), []);
  });
});
