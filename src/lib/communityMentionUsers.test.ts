import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { broadcastMentionsForQuery, mentionMatchScore } from "./communityMentionUsers";

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

describe("mentionMatchScore with a space", () => {
  const daniel = { id: "1", first_name: "Daniel", last_name: "Mirrorist" };
  const danielOther = { id: "2", first_name: "Daniel", last_name: "Smith" };

  it("narrows by surname initial", () => {
    assert.ok(mentionMatchScore(daniel, null, "Daniel M") > 0);
    assert.equal(mentionMatchScore(danielOther, null, "Daniel M"), 0);
  });

  it("keeps matching with a trailing space", () => {
    assert.ok(mentionMatchScore(danielOther, null, "Daniel ") > 0);
  });

  it("matches a middle name skipped over", () => {
    const row = { id: "3", full_name: "Daniel James Mirrorist" };
    assert.ok(mentionMatchScore(row, null, "dan mir") > 0);
  });

  it("finds no one once the words stop matching", () => {
    assert.equal(mentionMatchScore(daniel, null, "Daniel thanks"), 0);
  });
});
