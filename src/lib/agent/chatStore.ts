import type Anthropic from "@anthropic-ai/sdk";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { getCapability } from "./context";
import { getAgentTool } from "./tools";
import type { AgentActionView, AgentDisplayItem, AgentMode } from "./types";

/**
 * Agent chats. api_messages is the append-only Messages API transcript
 * (tool calls, results, thinking, tool_addition system messages). The panel's
 * view is derived from it, with confirmation cards joined from ai_agent_actions.
 */

/** Stored transcript entries: API messages plus mid-conversation system messages. */
export type StoredMessage =
  | Anthropic.Beta.Messages.BetaMessageParam
  | { role: "system"; content: unknown };

export type AgentChatRow = {
  id: string;
  actor_user_id: string;
  mode: AgentMode;
  coach_id: string | null;
  title: string;
  api_messages: StoredMessage[];
  opened_capabilities: string[];
  model: string | null;
  updated_at: string;
};

const CHAT_SELECT =
  "id, actor_user_id, mode, coach_id, title, api_messages, opened_capabilities, model, updated_at";

export const WORKING_STATE_TAG = "working_state";
export const APP_EVENT_TAG = "app_event";

export async function createChat(opts: {
  actorUserId: string;
  mode: AgentMode;
  coachId: string | null;
}): Promise<AgentChatRow> {
  const { data, error } = await supabaseAdmin
    .from("ai_agent_chats")
    .insert({ actor_user_id: opts.actorUserId, mode: opts.mode, coach_id: opts.coachId })
    .select(CHAT_SELECT)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create the chat.");
  return data as AgentChatRow;
}

export async function loadChat(chatId: string, actorUserId: string): Promise<AgentChatRow | null> {
  const { data, error } = await supabaseAdmin
    .from("ai_agent_chats")
    .select(CHAT_SELECT)
    .eq("id", chatId)
    .eq("actor_user_id", actorUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AgentChatRow | null) ?? null;
}

export async function saveChat(
  chatId: string,
  patch: Partial<Pick<AgentChatRow, "api_messages" | "opened_capabilities" | "coach_id" | "title" | "model">>
) {
  const { error } = await supabaseAdmin
    .from("ai_agent_chats")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", chatId);
  if (error) throw new Error(error.message);
}

export async function listChats(actorUserId: string, mode: AgentMode, limit = 30) {
  const { data, error } = await supabaseAdmin
    .from("ai_agent_chats")
    .select("id, title, coach_id, updated_at")
    .eq("actor_user_id", actorUserId)
    .eq("mode", mode)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function tagged(text: string, tag: string): string | null {
  const match = text.match(new RegExp(`^<${tag}>([\\s\\S]*)</${tag}>$`));
  return match ? match[1].trim() : null;
}

function resultText(block: { content?: unknown }): string {
  if (typeof block.content === "string") return block.content;
  if (Array.isArray(block.content)) {
    return block.content
      .map((part) => (part && typeof part === "object" && "text" in part ? String(part.text) : ""))
      .join("");
  }
  return "";
}

/** The panel's view of a stored transcript. */
export function displayItems(
  messages: StoredMessage[],
  mode: AgentMode,
  actions: Map<string, AgentActionView>
): AgentDisplayItem[] {
  const items: AgentDisplayItem[] = [];
  const toolIndex = new Map<string, number>();

  for (const message of messages) {
    if (message.role === "system") continue;
    const content = message.content;
    if (typeof content === "string") {
      items.push({ type: message.role === "user" ? "user" : "assistant", text: content });
      continue;
    }
    if (!Array.isArray(content)) continue;

    for (const raw of content as unknown as Array<Record<string, unknown>>) {
      const type = raw.type;
      if (message.role === "user" && type === "text") {
        const text = String(raw.text ?? "");
        if (tagged(text, WORKING_STATE_TAG) != null) continue;
        const appEvent = tagged(text, APP_EVENT_TAG);
        items.push(appEvent != null ? { type: "app_event", text: appEvent } : { type: "user", text });
      } else if (message.role === "assistant" && type === "text") {
        const text = String(raw.text ?? "");
        if (!text.trim()) continue;
        const last = items[items.length - 1];
        if (last?.type === "assistant") last.text += `\n\n${text}`;
        else items.push({ type: "assistant", text });
      } else if (message.role === "assistant" && type === "tool_use") {
        const name = String(raw.name ?? "");
        const id = String(raw.id ?? "");
        if (name === "open_capability") {
          const capId = String((raw.input as Record<string, unknown> | undefined)?.id ?? "");
          const cap = getCapability(capId, mode);
          if (cap) items.push({ type: "capability", id: cap.id, title: cap.title });
          continue;
        }
        toolIndex.set(id, items.length);
        items.push({ type: "tool", id, name, label: getAgentTool(name)?.label ?? name, ok: null });
      } else if (message.role === "user" && type === "tool_result") {
        const index = toolIndex.get(String(raw.tool_use_id ?? ""));
        const item = index != null ? items[index] : null;
        if (!item || item.type !== "tool") continue;
        item.ok = raw.is_error !== true;
        const text = resultText(raw);
        try {
          const parsed = JSON.parse(text) as { action_id?: string; _link?: { href: string; label: string } };
          const action = parsed.action_id ? actions.get(parsed.action_id) : null;
          if (action) items.push({ type: "action", action });
          if (parsed._link?.href) items.push({ type: "link", link: parsed._link });
        } catch {
          // Plain-text results (errors, capability contracts) carry no cards.
        }
      }
    }
  }
  return items;
}
