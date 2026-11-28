import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { whatsAppChatPhone } from "./whatsappIdentity";

// Shapes copied from real Unipile chats (SUP-0710), numbers changed.
describe("whatsAppChatPhone", () => {
  it("reads the other person's number from a one-to-one chat", () => {
    assert.equal(
      whatsAppChatPhone({
        type: 0,
        provider_id: "447700900123@s.whatsapp.net",
        attendee_provider_id: "274113570582619@lid",
        attendee_public_identifier: "447700900123@s.whatsapp.net",
      }),
      "447700900123"
    );
  });

  it("returns nothing for a group", () => {
    assert.equal(
      whatsAppChatPhone({
        type: 1,
        name: "The Family",
        provider_id: "447700900123-1520699903@g.us",
      }),
      null
    );
    assert.equal(
      whatsAppChatPhone({ type: 0, provider_id: "447700900123-1520699903@g.us" }),
      null
    );
  });

  it("returns nothing when the chat has only a linked id", () => {
    assert.equal(
      whatsAppChatPhone({ type: 0, attendee_provider_id: "274113570582619@lid" }),
      null
    );
  });
});
