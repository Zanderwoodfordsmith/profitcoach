import { resolveAnthropicModel } from "@/lib/anthropicModel";
import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import {
  buildLibraryContextText,
  buildVocabularyText,
  findLibraryMatch,
  loadCoachLinkedInSummary,
} from "@/lib/firstCampaign/loadCoachContext";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { sectionByKey } from "./blueprint";
import { sanitizeBlocks } from "./blocks";
import { listOnboardingTranscripts, onboardingTranscriptText } from "./ingestOnboarding";
import { SECTION_SKILLS, skillSystemPrompt, skillUserPrompt } from "./skills";
import { listValue } from "./sourced";
import {
  ensurePracticeKnowledge,
  getLatestDecisionRecord,
  getLatestIntakeSession,
  saveBuiltSection,
} from "./store";
import type { DecisionRecordPayload, PracticeKnowledgeRow } from "./types";

function decisionText(payload: DecisionRecordPayload | null | undefined): string {
  if (!payload) return "";
  return Object.entries(payload)
    .filter(([, v]) => String(v ?? "").trim())
    .map(([k, v]) => `${k.replaceAll("_", " ")}: ${v}`)
    .join("\n");
}

/** The industry to pull library pains and vocabulary for. Locked choices first. */
function focusIndustry(row: PracticeKnowledgeRow, decision: DecisionRecordPayload | null): string {
  return (
    decision?.target_market?.trim() ||
    row.report_payload?.market_hypotheses?.[0]?.industry?.trim() ||
    listValue(row.payload.market.industries_credibility)[0] ||
    listValue(row.payload.market.industries_worked)[0] ||
    ""
  );
}

export function isBuildableSection(key: string): boolean {
  // Sections on hidden pages keep their skill but are not written.
  return Boolean(SECTION_SKILLS[key] && sectionByKey(key));
}

/**
 * Everything one writer is sent for one coach, exactly as the build sends it.
 * The admin flow map shows this so the prompts can be read and improved.
 * Pass `existing` to read without creating a Blueprint row.
 */
export async function sectionPrompt(
  coachId: string,
  key: string,
  existing?: PracticeKnowledgeRow
): Promise<{ row: PracticeKnowledgeRow; system: string; user: string; maxTokens: number }> {
  const system = skillSystemPrompt(key);
  if (!system) throw new Error("That section is not one we write.");

  const [row, linkedin, session, decisionRow, profile, onboarding] = await Promise.all([
    existing ?? ensurePracticeKnowledge(coachId),
    loadCoachLinkedInSummary(coachId),
    getLatestIntakeSession(coachId),
    getLatestDecisionRecord(coachId).catch(() => null),
    supabaseAdmin.from("profiles").select("full_name").eq("id", coachId).maybeSingle(),
    listOnboardingTranscripts(coachId).catch(() => []),
  ]);
  const decision = decisionRow?.payload ?? null;
  const industry = focusIndustry(row, decision);
  const libraryRow = industry ? await findLibraryMatch(industry).catch(() => null) : null;
  const library = [buildLibraryContextText(libraryRow), buildVocabularyText(libraryRow)]
    .filter(Boolean)
    .join("\n\n");

  const user = skillUserPrompt({
    key,
    row,
    coachName: (profile.data?.full_name as string | null) || "the coach",
    linkedinSummary: linkedin.summary,
    turns: session?.turns ?? [],
    decision: decisionText(decision),
    library,
    onboardingTranscript: onboardingTranscriptText(onboarding),
  });
  return { row, system, user, maxTokens: SECTION_SKILLS[key].maxTokens ?? 4096 };
}

/**
 * Write one "We build" section for a coach and save it. Used by the build
 * route and by admin scripts. Throws with a readable message on failure.
 */
export async function buildSection(coachId: string, key: string): Promise<PracticeKnowledgeRow> {
  const { system, user, maxTokens } = await sectionPrompt(coachId, key);
  const { data, error } = await generateCampaignJson<{ blocks?: unknown }>({ system, user, maxTokens });

  const blocks = sanitizeBlocks(data?.blocks);
  if (!blocks.length) throw new Error(error || "The section came back empty. Try again.");

  return saveBuiltSection({
    coachId,
    key,
    section: {
      blocks,
      generated_at: new Date().toISOString(),
      model: resolveAnthropicModel(),
      edited_at: null,
    },
  });
}
