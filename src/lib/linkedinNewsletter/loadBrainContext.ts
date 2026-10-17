import { blueprintContextFromRow } from "@/lib/practiceKnowledge/blueprintContext";
import { foldRetiredAnswers, listValue } from "@/lib/practiceKnowledge/sourced";
import { findPracticeKnowledge } from "@/lib/practiceKnowledge/store";
import { loadCoachLinkedInSummary } from "@/lib/firstCampaign/loadCoachContext";
import { loadCoachAiContextRow } from "@/lib/profitCoachAi/loadCoachPromptContext";
import type { CoachAiContext } from "@/lib/profitCoachAi/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type NewsletterBrainBundle = {
  brain: CoachAiContext;
  brainText: string;
  linkedInSummary: string;
  industryLabel: string | null;
  avatarHooks: string[];
  painLines: string[];
};

function formatBrain(brain: CoachAiContext): string {
  const lines: string[] = [];
  if (brain.ideal_client?.trim())
    lines.push(`Ideal client: ${brain.ideal_client.trim().slice(0, 2500)}`);
  if (brain.pain_language?.trim())
    lines.push(`Pain language: ${brain.pain_language.trim().slice(0, 2500)}`);
  if (brain.messaging_hooks?.trim())
    lines.push(`Messaging hooks: ${brain.messaging_hooks.trim().slice(0, 2500)}`);
  if (brain.industry_vocabulary?.trim())
    lines.push(
      `Industry vocabulary: ${brain.industry_vocabulary.trim().slice(0, 1500)}`
    );
  if (brain.proof_framing?.trim())
    lines.push(`Proof framing: ${brain.proof_framing.trim().slice(0, 1500)}`);
  if (brain.superpowers?.trim())
    lines.push(`Superpowers: ${brain.superpowers.trim().slice(0, 1000)}`);
  const results = brain.client_results ?? [];
  if (results.length) {
    lines.push(
      "Client results:",
      ...results.slice(0, 8).map((r, i) => {
        const t = (r.title ?? "").trim();
        const s = (r.story ?? "").trim().slice(0, 800);
        return `  ${i + 1}. ${t || "Untitled"} — ${s || "…"}`;
      })
    );
  }
  return lines.join("\n") || "(AI brain empty — use general BOSS / profit coaching language)";
}

function extractIndustryLabel(brain: CoachAiContext): string | null {
  const ic = brain.ideal_client?.trim() ?? "";
  if (!ic) return null;
  // First sentence / clause often holds niche
  const first = ic.split(/[.\n]/)[0]?.trim() ?? "";
  return first.slice(0, 120) || null;
}

export async function loadNewsletterBrainBundle(
  userId: string
): Promise<NewsletterBrainBundle> {
  const [brainRow, { summary: linkedInSummary }, setup, blueprintRow] = await Promise.all([
    loadCoachAiContextRow(userId),
    loadCoachLinkedInSummary(userId),
    supabaseAdmin
      .from("coach_campaign_setup")
      .select("selected_avatar_id, selected_icp_id")
      .eq("coach_id", userId)
      .maybeSingle(),
    findPracticeKnowledge(userId).catch(() => null),
  ]);

  const brain = brainRow ?? {};
  // The Practice Blueprint is the source of truth; the brain and avatar fill gaps.
  const blueprint = blueprintRow ? blueprintContextFromRow(blueprintRow) : "";
  const blueprintPayload = blueprintRow ? foldRetiredAnswers(blueprintRow.payload) : null;
  const avatarHooks: string[] = [];
  const painLines: string[] = blueprintPayload ? listValue(blueprintPayload.client.pains_now).slice(0, 8) : [];

  const avatarId = setup.data?.selected_avatar_id as string | null;
  if (avatarId) {
    const { data: avatarRow } = await supabaseAdmin
      .from("coach_avatars")
      .select("edited_payload, generated_payload")
      .eq("id", avatarId)
      .eq("coach_id", userId)
      .maybeSingle();
    const payload = (avatarRow?.edited_payload ??
      avatarRow?.generated_payload) as Record<string, unknown> | null;
    if (payload) {
      const hooks = payload.messagingHooks;
      if (Array.isArray(hooks)) {
        for (const h of hooks) {
          if (typeof h === "string" && h.trim()) avatarHooks.push(h.trim());
        }
      }
      const persona = payload.persona as Record<string, unknown> | undefined;
      const problem = persona?.specificProblem as { text?: string } | undefined;
      if (problem?.text?.trim()) painLines.push(problem.text.trim());
      const frustrations = payload.internalFrustrations;
      if (Array.isArray(frustrations)) {
        for (const f of frustrations.slice(0, 6)) {
          if (typeof f === "string" && f.trim()) painLines.push(f.trim());
        }
      }
    }
  }

  return {
    brain,
    brainText: [formatBrain(brain), blueprint].filter(Boolean).join("\n\n"),
    linkedInSummary: linkedInSummary || "(no LinkedIn scrape)",
    industryLabel:
      (blueprintPayload ? listValue(blueprintPayload.market.industries_credibility)[0]?.slice(0, 120) : null) ||
      extractIndustryLabel(brain),
    avatarHooks,
    painLines,
  };
}
