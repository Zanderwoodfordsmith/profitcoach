import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collapseConversationsByContact } from "./collapseConversationsByContact";

describe("collapseConversationsByContact", () => {
  it("keeps a real name when a later email thread is still Unknown", () => {
    const [row] = collapseConversationsByContact([
      {
        id: "email",
        contact_id: "person",
        prospect_name: "Unknown",
        prospect_email: "derekhollingdale@hotmail.com",
        last_message_at: "2026-09-29T09:00:00.000Z",
        last_channel: "email",
        unipile_chat_id: "mail",
        last_preview: "Hi Derek",
      },
      {
        id: "linkedin",
        contact_id: "person",
        prospect_name: "Derek Hollingdale",
        prospect_email: null,
        last_message_at: "2026-09-21T13:16:00.000Z",
        last_channel: "linkedin",
        unipile_chat_id: "li",
        last_preview: "derekhollingdale@hotmail.com",
      },
    ]);
    assert.equal(row.thread_count, 2);
    assert.equal(row.prospect_name, "Derek Hollingdale");
    assert.equal(row.prospect_email, "derekhollingdale@hotmail.com");
  });

  it("does not join threads that share no identity", () => {
    const rows = collapseConversationsByContact([
      {
        id: "email",
        contact_id: "a",
        prospect_name: "Ada Lovelace",
        prospect_email: "ada@example.com",
        last_message_at: "2026-09-29T09:00:00.000Z",
        unipile_chat_id: "mail",
      },
      {
        id: "linkedin",
        contact_id: null,
        prospect_name: "Derek Hollingdale",
        prospect_email: null,
        last_message_at: "2026-09-21T13:16:00.000Z",
        unipile_chat_id: "li",
      },
    ]);
    assert.equal(rows.length, 2);
  });
});
