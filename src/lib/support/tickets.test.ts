import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapSupportReplyRow } from "./tickets";

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
