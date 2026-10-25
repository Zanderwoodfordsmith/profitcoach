import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";
import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { ensureCoachLinkedIn, type CoachLinkedIn } from "@/lib/practiceKnowledge/coachLinkedIn";
import { loadBlueprintContext } from "@/lib/practiceKnowledge/blueprintContext";
import { loadCoachAiContextRow } from "@/lib/profitCoachAi/loadCoachPromptContext";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { normalizeOptimizerDraft, parseExperienceVariant, upsertExperienceDraft } from "./draft";
import { loadRewriteSystemPrompt } from "./loadRewriteSystem";
import { buildRewriteUser } from "./prompts";
import {
  FIELD_LIMITS,
  type ProfileOptimizerDraft,
  type ProfileOptimizerVariant,
  type ProfileSectionId,
} from "./types";

/**
 * The LinkedIn profile writer, one part at a time. "Write every part from my
 * Blueprint" on the page and Ava both run this, from the same inputs, so the
 * two never disagree.
 */

const SECTION_TEXT_MAX: Record<ProfileSectionId, number> = {
  headline: FIELD_LIMITS.headline,
  about: FIELD_LIMITS.about,
  experience: FIELD_LIMITS.experienceDescription + FIELD_LIMITS.experienceTitle + 8,
  banner: FIELD_LIMITS.bannerCopy,
  featured: FIELD_LIMITS.featuredNotes,
};

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

function parseVariants(raw: unknown, section: ProfileSectionId): ProfileOptimizerVariant[] {
  if (!raw || typeof raw !== "object") return [];
  const rec = raw as Record<string, unknown>;
  const list = Array.isArray(rec.variants) ? rec.variants : [];
  const recommendedIndex =
    typeof rec.recommendedIndex === "number" && Number.isInteger(rec.recommendedIndex)
      ? rec.recommendedIndex
      : 0;
  const max = SECTION_TEXT_MAX[section];
  const variants: ProfileOptimizerVariant[] = [];
  for (let i = 0; i < Math.min(list.length, 6); i++) {
    const item = list[i];
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const text = typeof row.text === "string" ? clip(row.text.trim(), max) : "";
    if (!text) continue;
    const label =
      typeof row.label === "string" && row.label.trim()
        ? clip(row.label.trim(), 40)
        : `Option ${variants.length + 1}`;
    variants.push({ label, text, recommended: i === recommendedIndex });
  }
  if (variants.length > 0 && !variants.some((v) => v.recommended)) {
    variants[0]!.recommended = true;
  }
  return variants;
}

/** Everything the profile writer reads for one coach. The LinkedIn is imported first when we can find it. */
export type ProfileWriterInputs = {
  linkedin: CoachLinkedIn;
  /** Null when there is still no LinkedIn import to rewrite. */
  snapshot: LinkedInProfileSnapshot | null;
  draft: ProfileOptimizerDraft;
  rewrittenAt: string | null;
  brain: Awaited<ReturnType<typeof loadCoachAiContextRow>>;
  blueprint: string;
};

export async function loadProfileWriterInputs(
  coachId: string,
  opts?: { linkedinUrl?: string | null }
): Promise<ProfileWriterInputs> {
  const linkedin = await ensureCoachLinkedIn(coachId, opts);
  const [{ data: row, error }, brain, blueprint] = await Promise.all([
    supabaseAdmin
      .from("coach_linkedin_profiles")
      .select("optimizer_draft, optimizer_rewritten_at")
      .eq("coach_id", coachId)
      .maybeSingle(),
    loadCoachAiContextRow(coachId),
    loadBlueprintContext(coachId),
  ]);
  if (error) throw new Error("Could not load the LinkedIn profile.");
  return {
    linkedin,
    snapshot: linkedin.snapshot,
    draft: normalizeOptimizerDraft(row?.optimizer_draft),
    rewrittenAt: (row?.optimizer_rewritten_at as string | null | undefined) ?? null,
    brain,
    blueprint,
  };
}

/** Write one part of the profile. Returns the options, recommended one marked; nothing is saved. */
export async function rewriteProfilePart(
  inputs: ProfileWriterInputs & { snapshot: LinkedInProfileSnapshot },
  opts: { section: ProfileSectionId; instruction?: string | null; experienceIndex?: number; draft?: ProfileOptimizerDraft }
): Promise<ProfileOptimizerVariant[]> {
  const system = await loadRewriteSystemPrompt();
  const { data, error } = await generateCampaignJson<{ recommendedIndex?: number; variants?: unknown }>({
    system,
    user: buildRewriteUser({
      section: opts.section,
      snapshot: inputs.snapshot,
      draft: opts.draft ?? inputs.draft,
      brain: inputs.brain,
      linkedInSummary: inputs.linkedin.summary,
      instruction: opts.instruction ? clip(opts.instruction.trim(), FIELD_LIMITS.instruction) : null,
      experienceIndex: opts.experienceIndex ?? 0,
      blueprint: inputs.blueprint,
    }),
    maxTokens: opts.section === "about" ? 3072 : 1536,
  });
  const variants = parseVariants(data, opts.section);
  return error ? [] : variants;
}

/** The parts "Write every part from my Blueprint" writes, top of the profile first. */
export const WRITE_EVERY_PART: ProfileSectionId[] = ["headline", "about", "featured", "experience"];

/** The recommended option for a part, put into the draft the way the page does it. */
export function applyProfileVariant(
  draft: ProfileOptimizerDraft,
  section: ProfileSectionId,
  text: string
): ProfileOptimizerDraft {
  if (section === "headline") return { ...draft, headline: text };
  if (section === "about") return { ...draft, about: text };
  if (section === "featured") return { ...draft, featuredNotes: text };
  if (section === "banner") return { ...draft, bannerCopy: text };
  return upsertExperienceDraft(draft, { index: 0, ...parseExperienceVariant(text) });
}
