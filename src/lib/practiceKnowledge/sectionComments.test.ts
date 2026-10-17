import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { gridCounts, gridPageCounts } from "./blueprintGrid";
import { commentCapabilities, isUnread, summariseThreads } from "./sectionCommentTypes";

const at = (minute: number) => new Date(Date.UTC(2026, 9, 17, 9, minute)).toISOString();

describe("section comment unread", () => {
  it("counts the other side's comments, and Ava's for both sides", () => {
    assert.equal(isUnread({ author_side: "coach", created_at: at(1) }, "bca", null), true);
    assert.equal(isUnread({ author_side: "bca", created_at: at(1) }, "bca", null), false);
    assert.equal(isUnread({ author_side: "ava", created_at: at(1) }, "bca", null), true);
    assert.equal(isUnread({ author_side: "ava", created_at: at(1) }, "coach", null), true);
    assert.equal(isUnread({ author_side: "bca", created_at: at(1) }, "coach", null), true);
  });

  it("stops counting once the thread was opened after the comment", () => {
    assert.equal(isUnread({ author_side: "coach", created_at: at(1) }, "bca", at(2)), false);
    assert.equal(isUnread({ author_side: "coach", created_at: at(3) }, "bca", at(2)), true);
  });

  it("summarises each thread", () => {
    const threads = summariseThreads(
      [
        { section_key: "offer:fee", author_side: "coach", created_at: at(1) },
        { section_key: "offer:fee", author_side: "bca", created_at: at(2) },
        { section_key: "offer:fee", author_side: "coach", created_at: at(4) },
        { section_key: "story:results", author_side: "coach", created_at: at(5) },
      ],
      "bca",
      { "offer:fee": at(3) }
    );
    assert.deepEqual(threads["offer:fee"], { total: 3, unread: 1, last_at: at(4) });
    assert.deepEqual(threads["story:results"], { total: 1, unread: 1, last_at: at(5) });
  });
});

describe("comment capabilities", () => {
  it("lets the author edit and delete, and anyone signed in assign", () => {
    const comment = { author_id: "coach-1", author_side: "coach" as const };
    assert.deepEqual(commentCapabilities(comment, "coach-1"), { edit: true, delete: true, assign: true });
    assert.deepEqual(commentCapabilities(comment, "admin-2"), { edit: false, delete: false, assign: true });
    assert.deepEqual(commentCapabilities(comment, null), { edit: false, delete: false, assign: false });
  });

  it("leaves Ava's notes uneditable", () => {
    assert.deepEqual(commentCapabilities({ author_id: null, author_side: "ava" }, "admin-2"), {
      edit: false,
      delete: false,
      assign: true,
    });
  });
});

describe("blueprint grid counts", () => {
  it("counts tracked sections by status and what waits on BCA", () => {
    const n = gridCounts({
      cells: {
        a: { status: "done", owner: null, tracked: true, revision: null },
        b: { status: "todo", owner: "bca", tracked: true, revision: null },
        c: { status: "review", owner: "bca", tracked: true, revision: null },
        d: { status: "todo", owner: "coach", tracked: true, revision: null },
        e: { status: "done", owner: null, tracked: false, revision: null },
      },
      threads: { a: { total: 2, unread: 1, last_at: null }, b: { total: 1, unread: 2, last_at: null } },
    });
    assert.deepEqual(n, { done: 1, review: 1, todo: 2, tracked: 4, bca: 2, unread: 3 });
  });

  it("rolls a page up from its own sections only", () => {
    const coach = {
      cells: {
        a: { status: "todo" as const, owner: "bca" as const, tracked: true, revision: null },
        b: { status: "done" as const, owner: null, tracked: true, revision: null },
      },
      threads: { a: { total: 1, unread: 2, last_at: null }, b: { total: 1, unread: 1, last_at: null } },
    };
    assert.deepEqual(gridPageCounts(coach, ["a"]), { done: 0, review: 0, todo: 1, tracked: 1, bca: 1, unread: 2 });
  });
});
