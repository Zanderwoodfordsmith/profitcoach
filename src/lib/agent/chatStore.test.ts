import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { displayItems, type StoredMessage } from "./chatStore";
import type { AgentActionView } from "./types";

const action: AgentActionView = {
  id: "act-1",
  tool: "remove_people_from_campaign",
  title: "Remove 2 people from Connector",
  details: [],
  warning: null,
  coachName: "Zander Demo",
  status: "pending",
  result: null,
  error: null,
};

describe("agent display transcript", () => {
  it("hides working state and system messages, and joins tool results to chips and cards", () => {
    const transcript: StoredMessage[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "<working_state>\nMode: admin\n</working_state>" },
          { type: "text", text: "Remove Sarah and Tom from Connector" },
        ],
      },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Opening campaign people." },
          { type: "tool_use", id: "t1", name: "open_capability", input: { id: "campaign-people" } },
        ],
      },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "# Capability" }] },
      { role: "system", content: [{ type: "tool_addition", tool: { type: "tool_reference", name: "list_campaigns" } }] },
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "t2", name: "remove_people_from_campaign", input: {} }],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "t2",
            content: JSON.stringify({ status: "awaiting_confirmation", action_id: "act-1" }),
          },
        ],
      },
      { role: "assistant", content: [{ type: "text", text: "Confirm the card to remove them." }] },
      {
        role: "user",
        content: [
          { type: "text", text: "<working_state>x</working_state>" },
          { type: "text", text: "<app_event>The person cancelled it.</app_event>" },
        ],
      },
    ];
    const items = displayItems(transcript, "admin", new Map([["act-1", action]]));
    assert.deepEqual(
      items.map((item) => item.type),
      ["user", "assistant", "capability", "tool", "action", "assistant", "app_event"]
    );
    const tool = items.find((item) => item.type === "tool");
    assert.ok(tool && tool.type === "tool" && tool.ok === true && tool.label === "Removing people");
    const appEvent = items.at(-1);
    assert.ok(appEvent?.type === "app_event" && appEvent.text === "The person cancelled it.");
  });

  it("marks failed tools", () => {
    const items = displayItems(
      [
        { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "list_lists", input: {} }] },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "No coach", is_error: true }] },
      ],
      "admin",
      new Map()
    );
    assert.ok(items[0].type === "tool" && items[0].ok === false);
  });
});
