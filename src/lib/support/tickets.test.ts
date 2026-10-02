import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  coachSupportListSection,
  mapSupportReplyRow,
  memberSupportStatusPresentation,
  supportTicketListPreview,
  supportUnreadNavLabel,
  unreadStaffReplyCount,
} from "./tickets";

describe("mapSupportReplyRow", () => {
  it("treats missing via_email as false", () => {
    const reply = mapSupportReplyRow({
      id: "1",
      created_at: "2026-09-19T00:00:00.000Z",
      report_id: "t1",
      created_by: "u1",
      body: "Hello",
    });
    assert.equal(reply.via_email, false);
  });

  it("keeps via_email when the reply went over email", () => {
    const reply = mapSupportReplyRow({
      id: "1",
      created_at: "2026-09-19T00:00:00.000Z",
      report_id: "t1",
      created_by: "u1",
      body: "Hello",
      via_email: true,
    });
    assert.equal(reply.via_email, true);
  });
});

describe("unread staff replies", () => {
  const reply = {
    created_by: "staff",
    created_at: "2026-10-02T10:00:00.000Z",
    body: "Here is the fix.",
  };

  it("counts staff replies on a resolved ticket until the member opens it", () => {
    assert.equal(
      unreadStaffReplyCount({ coach_last_read_at: null }, [reply], "member"),
      1
    );
    assert.equal(memberSupportStatusPresentation("resolved").label, "Resolved");
  });

  it("clears once the member has opened the thread", () => {
    assert.equal(
      unreadStaffReplyCount(
        { coach_last_read_at: "2026-10-02T11:00:00.000Z" },
        [reply],
        "member"
      ),
      0
    );
    assert.equal(memberSupportStatusPresentation("open").label, "Open");
    assert.equal(
      memberSupportStatusPresentation("waiting_reply").label,
      "Your reply needed"
    );
  });

  it("previews the latest reply and names unread replies for the member", () => {
    assert.equal(
      supportTicketListPreview(
        { details: "Original question" },
        [{ body: "We replied." }]
      ),
      "We replied."
    );
    assert.equal(supportUnreadNavLabel({ replyCount: 2 }), "2 replies to read");
    assert.equal(
      supportUnreadNavLabel({ replyCount: 1 }),
      "1 reply to read"
    );
    assert.equal(supportUnreadNavLabel({ replyCount: 0 }), null);
  });

  it("keeps an unread reply out of Resolved, even when the ticket is resolved", () => {
    const staff = {
      created_by: "staff",
      created_at: "2026-10-02T10:00:00.000Z",
    };
    assert.equal(
      coachSupportListSection(
        { status: "resolved", coach_last_read_at: null },
        [staff],
        "member"
      ),
      "new"
    );
    assert.equal(
      coachSupportListSection(
        {
          status: "resolved",
          coach_last_read_at: "2026-10-02T11:00:00.000Z",
        },
        [staff],
        "member"
      ),
      "resolved"
    );
    assert.equal(
      coachSupportListSection(
        {
          status: "waiting_reply",
          coach_last_read_at: "2026-10-02T11:00:00.000Z",
        },
        [staff],
        "member"
      ),
      "your_reply"
    );
    assert.equal(
      coachSupportListSection(
        { status: "open", coach_last_read_at: null },
        [],
        "member"
      ),
      "submitted"
    );
    assert.equal(
      coachSupportListSection(
        {
          status: "open",
          coach_last_read_at: "2026-10-02T12:00:00.000Z",
        },
        [
          staff,
          { created_by: "member", created_at: "2026-10-02T12:00:00.000Z" },
        ],
        "member"
      ),
      "submitted"
    );
    assert.equal(
      coachSupportListSection(
        {
          status: "open",
          coach_last_read_at: "2026-10-02T11:00:00.000Z",
        },
        [staff],
        "member"
      ),
      "replied"
    );
  });
});
