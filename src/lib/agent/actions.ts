import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { actorMayActOn, type AgentActor } from "./auth";
import { loadAgentCoach } from "./coaches";
import { getAgentTool, toolAllowedInMode } from "./tools";
import { AgentToolError } from "./tools/util";
import type {
  ActionDetail,
  AgentActionStatus,
  AgentActionView,
  AgentToolContext,
  AgentToolInput,
} from "./types";

/**
 * Pending actions: what a gated tool call becomes. The input is frozen when
 * the card is made; confirming runs exactly that input, after re-checking the
 * gate, under the same permissions.
 */

type ActionRow = {
  id: string;
  chat_id: string | null;
  actor_user_id: string;
  coach_id: string;
  tool: string;
  input: AgentToolInput;
  title: string;
  details: { rows?: ActionDetail[]; warning?: string | null; coach_name?: string | null } | null;
  status: AgentActionStatus;
  result: unknown;
  error: string | null;
};

const ACTION_SELECT =
  "id, chat_id, actor_user_id, coach_id, tool, input, title, details, status, result, error";

/** Keep stored results small; the model only needs the gist. */
function compactJson(value: unknown, max = 6_000): unknown {
  const text = JSON.stringify(value ?? null);
  if (text.length <= max) return value ?? null;
  return { truncated: true, preview: text.slice(0, max) };
}

export function actionView(row: ActionRow): AgentActionView {
  return {
    id: row.id,
    tool: row.tool,
    title: row.title,
    details: row.details?.rows ?? [],
    warning: row.details?.warning ?? null,
    coachName: row.details?.coach_name ?? null,
    status: row.status,
    result: row.result,
    error: row.error,
  };
}

export async function createPendingAction(opts: {
  chatId: string;
  actorUserId: string;
  coachId: string;
  coachName: string;
  tool: string;
  input: AgentToolInput;
  title: string;
  details: ActionDetail[];
  warning?: string;
}): Promise<AgentActionView> {
  const { data, error } = await supabaseAdmin
    .from("ai_agent_actions")
    .insert({
      chat_id: opts.chatId,
      actor_user_id: opts.actorUserId,
      coach_id: opts.coachId,
      tool: opts.tool,
      input: opts.input,
      title: opts.title.slice(0, 300),
      details: { rows: opts.details, warning: opts.warning ?? null, coach_name: opts.coachName },
    })
    .select(ACTION_SELECT)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save the action.");
  return actionView(data as ActionRow);
}

export async function loadChatActions(chatId: string): Promise<Map<string, AgentActionView>> {
  const { data, error } = await supabaseAdmin
    .from("ai_agent_actions")
    .select(ACTION_SELECT)
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((row) => [row.id as string, actionView(row as ActionRow)]));
}

async function finish(id: string, patch: Partial<ActionRow> & { decided_at?: string }) {
  const { data, error } = await supabaseAdmin
    .from("ai_agent_actions")
    .update(patch)
    .eq("id", id)
    .select(ACTION_SELECT)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not update the action.");
  return actionView(data as ActionRow);
}

export class ActionDecisionError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409
  ) {
    super(message);
  }
}

/** Confirm (run) or cancel a pending action the actor proposed. */
export async function decideAction(opts: {
  actionId: string;
  actor: AgentActor;
  decision: "confirm" | "cancel";
}): Promise<{ action: AgentActionView; chatId: string | null }> {
  const { data: found, error } = await supabaseAdmin
    .from("ai_agent_actions")
    .select(ACTION_SELECT)
    .eq("id", opts.actionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = found as ActionRow | null;
  if (!row || row.actor_user_id !== opts.actor.actorUserId) {
    throw new ActionDecisionError("Action not found.", 404);
  }
  if (!actorMayActOn(opts.actor, row.coach_id)) {
    throw new ActionDecisionError("Not allowed.", 403);
  }
  if (row.status !== "pending") {
    return { action: actionView(row), chatId: row.chat_id };
  }

  const now = new Date().toISOString();
  if (opts.decision === "cancel") {
    const { data } = await supabaseAdmin
      .from("ai_agent_actions")
      .update({ status: "cancelled", decided_at: now })
      .eq("id", row.id)
      .eq("status", "pending")
      .select(ACTION_SELECT)
      .maybeSingle();
    return { action: actionView((data ?? row) as ActionRow), chatId: row.chat_id };
  }

  // Claim it: only one confirm can move pending → running.
  const { data: claimed } = await supabaseAdmin
    .from("ai_agent_actions")
    .update({ status: "running", decided_at: now })
    .eq("id", row.id)
    .eq("status", "pending")
    .select(ACTION_SELECT)
    .maybeSingle();
  if (!claimed) {
    const { data: current } = await supabaseAdmin
      .from("ai_agent_actions")
      .select(ACTION_SELECT)
      .eq("id", row.id)
      .maybeSingle();
    return { action: actionView((current ?? row) as ActionRow), chatId: row.chat_id };
  }

  const tool = getAgentTool(row.tool);
  const coach = await loadAgentCoach(row.coach_id);
  if (!tool || !tool.gate || !toolAllowedInMode(tool, opts.actor.mode) || !coach) {
    return {
      action: await finish(row.id, { status: "failed", error: "This action can no longer run." }),
      chatId: row.chat_id,
    };
  }

  const ctx: AgentToolContext = {
    mode: opts.actor.mode,
    actorUserId: opts.actor.actorUserId,
    chatId: row.chat_id ?? "",
    coach,
    setCoach: () => undefined,
    screenPath: null,
  };

  try {
    // Things may have changed since the card was made (a campaign got
    // emptied, an import started). Re-check before running.
    const recheck = await tool.gate(row.input, ctx);
    if ("error" in recheck) {
      return { action: await finish(row.id, { status: "failed", error: recheck.error }), chatId: row.chat_id };
    }
    const result = await tool.run(row.input, ctx);
    return {
      action: await finish(row.id, { status: "done", result: compactJson(result) }),
      chatId: row.chat_id,
    };
  } catch (err) {
    const message =
      err instanceof AgentToolError || err instanceof Error ? err.message : "The action failed.";
    console.error("agent action failed:", row.tool, message);
    return { action: await finish(row.id, { status: "failed", error: message }), chatId: row.chat_id };
  }
}
