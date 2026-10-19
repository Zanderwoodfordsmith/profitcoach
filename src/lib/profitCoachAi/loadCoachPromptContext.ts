import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { CoachAiContext } from "./types";

/**
 * Text block for system prompt: ladder goal fields. Compass self-scores are
 * admin-only now, so they stay out of the coach's prompt.
 */
export async function loadLadderSummaryForUser(userId: string): Promise<string> {
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("ladder_goal_level, ladder_goal_target_date")
    .eq("id", userId)
    .maybeSingle();

  const p = prof as {
    ladder_goal_level?: string | null;
    ladder_goal_target_date?: string | null;
  } | null;

  const ladderParts: string[] = [];
  if (p?.ladder_goal_level) ladderParts.push(`goal_level=${p.ladder_goal_level}`);
  if (p?.ladder_goal_target_date)
    ladderParts.push(`goal_target_date=${p.ladder_goal_target_date}`);

  return ladderParts.length > 0
    ? `**Ladder:** ${ladderParts.join(", ")}`
    : "**Ladder:** (not set)";
}

export async function loadCoachAiContextRow(
  userId: string
): Promise<CoachAiContext | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("ai_context")
    .eq("id", userId)
    .maybeSingle();

  if (error?.code === "42703") return null;
  if (error || !data) return null;
  const raw = (data as { ai_context?: unknown }).ai_context;
  if (!raw || typeof raw !== "object") return {};
  return raw as CoachAiContext;
}

export function mergeCoachAiContext(
  prev: CoachAiContext,
  patch: Partial<CoachAiContext>
): CoachAiContext {
  return {
    superpowers:
      patch.superpowers !== undefined ? patch.superpowers : prev.superpowers,
    hobbies_and_recent:
      patch.hobbies_and_recent !== undefined
        ? patch.hobbies_and_recent
        : prev.hobbies_and_recent,
    client_results:
      patch.client_results !== undefined
        ? patch.client_results
        : prev.client_results,
    ideal_client:
      patch.ideal_client !== undefined ? patch.ideal_client : prev.ideal_client,
    industry_vocabulary:
      patch.industry_vocabulary !== undefined
        ? patch.industry_vocabulary
        : prev.industry_vocabulary,
    pain_language:
      patch.pain_language !== undefined
        ? patch.pain_language
        : prev.pain_language,
    messaging_hooks:
      patch.messaging_hooks !== undefined
        ? patch.messaging_hooks
        : prev.messaging_hooks,
    proof_framing:
      patch.proof_framing !== undefined
        ? patch.proof_framing
        : prev.proof_framing,
  };
}
