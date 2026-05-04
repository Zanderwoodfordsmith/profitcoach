import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  normalizeScores,
  SIGNATURE_MODULE_IDS,
  type SignatureModuleId,
  type SignatureScore,
} from "@/lib/signatureModelV2";

import type { CoachAiContext } from "./types";

function formatScoresCompact(
  scores: Record<SignatureModuleId, SignatureScore>
): string {
  const parts: string[] = [];
  for (const id of SIGNATURE_MODULE_IDS) {
    const v = scores[id];
    if (v == null) continue;
    parts.push(`${id}:${v}`);
  }
  if (parts.length === 0) return "No signature module scores recorded yet.";
  return parts.join(", ");
}

/**
 * Text block for system prompt: compass scores + ladder goal fields.
 */
export async function loadCompassSummaryForUser(userId: string): Promise<string> {
  const [{ data: scoreRow }, { data: prof }] = await Promise.all([
    supabaseAdmin
      .from("coach_signature_scores")
      .select("scores")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("ladder_goal_level, ladder_goal_target_date")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const scores = normalizeScores((scoreRow?.scores as object) ?? {});
  const scoreLine = formatScoresCompact(scores);

  const p = prof as {
    ladder_goal_level?: string | null;
    ladder_goal_target_date?: string | null;
  } | null;

  const ladderParts: string[] = [];
  if (p?.ladder_goal_level) ladderParts.push(`goal_level=${p.ladder_goal_level}`);
  if (p?.ladder_goal_target_date)
    ladderParts.push(`goal_target_date=${p.ladder_goal_target_date}`);

  return [
    "**Signature (module: R/Y/G)**",
    scoreLine,
    ladderParts.length > 0 ? `**Ladder:** ${ladderParts.join(", ")}` : "**Ladder:** (not set)",
  ].join("\n");
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
  };
}
