import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampConversationListLimit,
  clampThreadMessageLimit,
  mergeMessagesChronological,
  parseBeforeCursor,
  prioritizeUnipileChats,
  shouldAutoloadOlder,
  sliceNewestPage,
  THREAD_AUTO_FILL_MAX,
  THREAD_LIST_MAX,
  THREAD_MESSAGE_MAX_LIMIT,
  THREAD_MESSAGE_PAGE_SIZE,
  THREAD_RECENT_MS,
  toChronological,
} from "./threadWindow";

describe("clampThreadMessageLimit", () => {
  it("defaults to the page size and caps the max", () => {
    assert.equal(clampThreadMessageLimit(null), THREAD_MESSAGE_PAGE_SIZE);
    assert.equal(clampThreadMessageLimit("0"), 1);
    assert.equal(clampThreadMessageLimit("999"), THREAD_MESSAGE_MAX_LIMIT);
    assert.equal(clampThreadMessageLimit("10"), 10);
  });
});

describe("clampConversationListLimit", () => {
  it("keeps the existing inbox cap", () => {
    assert.equal(clampConversationListLimit(null), THREAD_LIST_MAX);
    assert.equal(clampConversationListLimit("40"), 40);
    assert.equal(clampConversationListLimit("9999"), THREAD_LIST_MAX);
  });
});

describe("parseBeforeCursor", () => {
  it("accepts ISO timestamps and rejects junk", () => {
    assert.equal(parseBeforeCursor("2026-09-12T12:00:00.000Z"), "2026-09-12T12:00:00.000Z");
    assert.equal(parseBeforeCursor("nope"), null);
    assert.equal(parseBeforeCursor(""), null);
  });
});

describe("sliceNewestPage / toChronological", () => {
  it("uses the extra row as hasOlder", () => {
    const newestFirst = [{ id: "c" }, { id: "b" }, { id: "a" }];
    const page = sliceNewestPage(newestFirst, 2);
    assert.equal(page.hasOlder, true);
    assert.deepEqual(
      toChronological(page.rows).map((row) => row.id),
      ["b", "c"]
    );
  });
});

describe("mergeMessagesChronological", () => {
  it("dedupes by id and sorts oldest first", () => {
    const merged = mergeMessagesChronological(
      [
        { id: "a", created_at: "2026-09-01T00:00:00.000Z" },
        { id: "b", created_at: "2026-09-02T00:00:00.000Z" },
      ],
      [
        { id: "b", created_at: "2026-09-02T00:00:00.000Z" },
        { id: "c", created_at: "2026-09-03T00:00:00.000Z" },
      ]
    );
    assert.deepEqual(
      merged.map((row) => row.id),
      ["a", "b", "c"]
    );
  });
});

describe("shouldAutoloadOlder", () => {
  it("fills backward inside two weeks until the cap", () => {
    const now = Date.parse("2026-09-12T12:00:00.000Z");
    assert.equal(
      shouldAutoloadOlder(
        [{ id: "a", created_at: "2026-09-11T12:00:00.000Z" }],
        true,
        now
      ),
      true
    );
    assert.equal(
      shouldAutoloadOlder(
        [{ id: "a", created_at: "2026-08-01T12:00:00.000Z" }],
        true,
        now
      ),
      false
    );
    const many = Array.from({ length: THREAD_AUTO_FILL_MAX }, (_, i) => ({
      id: `m${i}`,
      created_at: new Date(now - 60_000).toISOString(),
    }));
    assert.equal(shouldAutoloadOlder(many, true, now), false);
    assert.ok(THREAD_RECENT_MS > 0);
  });
});

describe("prioritizeUnipileChats", () => {
  it("moves the open chat to the front and keeps the rest in order", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const ordered = prioritizeUnipileChats(items, (row) => row.id, ["c", "a"]);
    assert.deepEqual(
      ordered.map((row) => row.id),
      ["c", "a", "b", "d"]
    );
  });
});
