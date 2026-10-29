import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";
import { copyCheckPrompt } from "@/lib/copywritingMethod";
import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { ensureCoachLinkedIn, type CoachLinkedIn } from "@/lib/practiceKnowledge/coachLinkedIn";
import { loadBlueprintContext } from "@/lib/practiceKnowledge/blueprintContext";
import { loadCoachAiContextRow } from "@/lib/profitCoachAi/loadCoachPromptContext";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { normalizeOptimizerDraft, parseExperienceVariant, upsertExperienceDraft } from "./draft";
import { linkedInText } from "./linkedInText";
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

/** Over the limit, cut at the last full line rather than mid-word. */
function clipAtLine(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastLine = cut.lastIndexOf("\n");
  return (lastLine > max / 2 ? cut.slice(0, lastLine) : cut).trimEnd();
}

/** The About's own target; LinkedIn's hard limit is a little higher. */
const ABOUT_TARGET = 2_300;

/** A note for the check pass naming any option that is too long, with its length. */
function lengthNote(raw: unknown, section: ProfileSectionId): string {
  const list = (raw as { variants?: unknown } | null)?.variants;
  if (!Array.isArray(list)) return "";
  const target = section === "about" ? ABOUT_TARGET : SECTION_TEXT_MAX[section];
  const over = list
    .map((item, i) => {
      const text = (item as { text?: unknown } | null)?.text;
      const length = typeof text === "string" ? linkedInText(text.trim()).length : 0;
      return length > target ? `option ${i + 1} is ${length}` : "";
    })
    .filter(Boolean);
  if (!over.length) return "";
  return `\n\nToo long: ${over.join(", ")} characters. Cut each to under ${target - 100} characters (each Unicode bold letter counts as two). Cut from the pains, results or the way you work. Keep the 📥 call to action as the last line.`;
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
    const text = typeof row.text === "string" ? clipAtLine(linkedInText(row.text.trim()), max) : "";
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
  const system = await loadRewriteSystemPrompt(opts.section);
  const user = buildRewriteUser({
    section: opts.section,
    snapshot: inputs.snapshot,
    draft: opts.draft ?? inputs.draft,
    brain: inputs.brain,
    linkedInSummary: inputs.linkedin.summary,
    instruction: opts.instruction ? clip(opts.instruction.trim(), FIELD_LIMITS.instruction) : null,
    experienceIndex: opts.experienceIndex ?? 0,
    blueprint: inputs.blueprint,
  });
  const maxTokens = opts.section === "about" ? 3072 : 1536;
  const { data, error } = await generateCampaignJson<{ recommendedIndex?: number; variants?: unknown }>({ system, user, maxTokens });
  const variants = parseVariants(data, opts.section);
  if (error || !variants.length) return [];
  // The check pass: the writer edits its own options against the method's checks. A failed check keeps the first draft.
  const checked = await generateCampaignJson<{ recommendedIndex?: number; variants?: unknown }>({
    system,
    user: copyCheckPrompt(user, JSON.stringify(data, null, 2)) + lengthNote(data, opts.section),
    maxTokens,
  });
  const fixed = parseVariants(checked.data, opts.section);
  return fixed.length ? fixed : variants;
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
