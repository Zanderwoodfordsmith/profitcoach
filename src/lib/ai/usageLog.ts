import { priceFor } from "@/lib/evals/usage";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * What each AI chat turn cost (card 177). Callers add every model call's usage
 * to one tally, then save one row per turn in ai_usage.
 */

type ApiUsage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
} | null | undefined;

export type UsageTally = {
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
};

export function emptyTally(): UsageTally {
  return { modelCalls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 };
}

/** Add one model call. Cache reads cost 0.1x input, cache writes 1.25x (same as the evals). */
export function addUsage(tally: UsageTally, model: string, usage: ApiUsage): void {
  if (!usage) return;
  const [inPrice, outPrice] = priceFor(model);
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  tally.modelCalls += 1;
  tally.inputTokens += input;
  tally.outputTokens += output;
  tally.cacheReadTokens += cacheRead;
  tally.cacheWriteTokens += cacheWrite;
  tally.costUsd += (input * inPrice + output * outPrice + cacheRead * inPrice * 0.1 + cacheWrite * inPrice * 1.25) / 1e6;
}

/** Save one turn. Never throws: a missed usage row must not break the chat. */
export async function logAiUsage(row: {
  surface: "ava" | "create_hub";
  mode: "coach" | "admin";
  actorUserId?: string | null;
  coachId: string | null;
  chatId: string | null;
  skills: string[];
  model: string;
  tally: UsageTally;
}): Promise<void> {
  if (row.tally.modelCalls === 0) return;
  const { error } = await supabaseAdmin.from("ai_usage").insert({
    surface: row.surface,
    mode: row.mode,
    actor_user_id: row.actorUserId ?? null,
    coach_id: row.coachId,
    chat_id: row.chatId,
    skills: row.skills,
    model: row.model,
    model_calls: row.tally.modelCalls,
    input_tokens: row.tally.inputTokens,
    output_tokens: row.tally.outputTokens,
    cache_read_tokens: row.tally.cacheReadTokens,
    cache_write_tokens: row.tally.cacheWriteTokens,
    cost_usd: Number(row.tally.costUsd.toFixed(6)),
  });
  if (error) console.error("ai usage log failed:", error.message);
}

export type CoachUsage = {
  /** The coach's own use: distinct chats, turns and cost. */
  chats: number;
  turns: number;
  costUsd: number;
  /** BCA's admin work on this coach. */
  adminCostUsd: number;
};

/** Each coach's AI use since the first of this month (UK time is close enough for a monthly total). */
export async function aiUsageThisMonth(): Promise<Record<string, CoachUsage>> {
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const out: Record<string, CoachUsage> = {};
  const chats: Record<string, Set<string>> = {};
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("ai_usage")
      .select("coach_id, chat_id, mode, cost_usd")
      .gte("created_at", since)
      .not("coach_id", "is", null)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const id = r.coach_id as string;
      const u = (out[id] ??= { chats: 0, turns: 0, costUsd: 0, adminCostUsd: 0 });
      const cost = Number(r.cost_usd) || 0;
      if (r.mode === "admin") {
        u.adminCostUsd += cost;
        continue;
      }
      u.turns += 1;
      u.costUsd += cost;
      if (r.chat_id) (chats[id] ??= new Set()).add(r.chat_id as string);
    }
    if (!data || data.length < pageSize) break;
  }
  for (const [id, set] of Object.entries(chats)) out[id]!.chats = set.size;
  return out;
}
