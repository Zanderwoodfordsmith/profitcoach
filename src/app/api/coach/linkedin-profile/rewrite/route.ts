import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { loadCoachLinkedInSummary } from "@/lib/firstCampaign/loadCoachContext";
import { loadCoachAiContextRow } from "@/lib/profitCoachAi/loadCoachPromptContext";
import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";
import { normalizeOptimizerDraft } from "@/lib/linkedinProfileOptimizer/draft";
import { loadRewriteSystemPrompt } from "@/lib/linkedinProfileOptimizer/loadRewriteSystem";
import { buildRewriteUser } from "@/lib/linkedinProfileOptimizer/prompts";
import {
  FIELD_LIMITS,
  PROFILE_SECTIONS,
  REWRITE_COOLDOWN_MS,
  type ProfileOptimizerVariant,
  type ProfileSectionId,
} from "@/lib/linkedinProfileOptimizer/types";

export const runtime = "nodejs";

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

function parseSection(value: unknown): ProfileSectionId | null {
  if (typeof value !== "string") return null;
  return (PROFILE_SECTIONS as readonly string[]).includes(value)
    ? (value as ProfileSectionId)
    : null;
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
    const text =
      typeof row.text === "string" ? clip(row.text.trim(), max) : "";
    if (!text) continue;
    const label =
      typeof row.label === "string" && row.label.trim()
        ? clip(row.label.trim(), 40)
        : `Option ${variants.length + 1}`;
    variants.push({
      label,
      text,
      recommended: i === recommendedIndex,
    });
  }
  if (variants.length > 0 && !variants.some((v) => v.recommended)) {
    variants[0]!.recommended = true;
  }
  return variants;
}

export async function POST(request: Request) {
  const authCheck = await requireCoachRequest(request, {
    allowAdminSelf: true,
  });
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const coachId = authCheck.userId;
  const body = (await request.json().catch(() => null)) as {
    section?: unknown;
    instruction?: unknown;
    experienceIndex?: unknown;
  } | null;

  const section = parseSection(body?.section);
  if (!section) {
    return NextResponse.json({ error: "Choose a profile section." }, { status: 400 });
  }

  const instruction =
    typeof body?.instruction === "string"
      ? clip(body.instruction.trim(), FIELD_LIMITS.instruction)
      : "";

  const experienceIndex =
    typeof body?.experienceIndex === "number" &&
    Number.isInteger(body.experienceIndex) &&
    body.experienceIndex >= 0
      ? Math.min(body.experienceIndex, 30)
      : 0;

  const [{ data: row, error: loadError }, { summary }, brain] = await Promise.all([
    supabaseAdmin
      .from("coach_linkedin_profiles")
      .select("snapshot, optimizer_draft, optimizer_rewritten_at")
      .eq("coach_id", coachId)
      .maybeSingle(),
    loadCoachLinkedInSummary(coachId),
    loadCoachAiContextRow(coachId),
  ]);

  if (loadError) {
    return NextResponse.json(
      { error: "Could not load your LinkedIn profile." },
      { status: 500 }
    );
  }
  if (!row?.snapshot) {
    return NextResponse.json(
      { error: "Import your LinkedIn profile first." },
      { status: 404 }
    );
  }

  const draft = normalizeOptimizerDraft(row.optimizer_draft);
  const rewrittenAt = (row as { optimizer_rewritten_at?: string | null })
    .optimizer_rewritten_at;
  if (rewrittenAt) {
    const elapsed = Date.now() - Date.parse(rewrittenAt);
    if (Number.isFinite(elapsed) && elapsed < REWRITE_COOLDOWN_MS) {
      const retryAfterSec = Math.ceil((REWRITE_COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json(
        {
          error: "Give the rewrite a moment, then try again.",
          retryAfterSec,
        },
        { status: 429 }
      );
    }
  }

  const snapshot = row.snapshot as LinkedInProfileSnapshot;
  const system = await loadRewriteSystemPrompt();
  const { data, error } = await generateCampaignJson<{
    recommendedIndex?: number;
    variants?: unknown;
  }>({
    system,
    user: buildRewriteUser({
      section,
      snapshot,
      draft,
      brain,
      linkedInSummary: summary,
      instruction: instruction || null,
      experienceIndex,
    }),
    maxTokens: section === "about" ? 3072 : 1536,
  });

  const variants = parseVariants(data, section);
  if (error || variants.length === 0) {
    return NextResponse.json(
      { error: "Could not rewrite that section. Try again." },
      { status: 502 }
    );
  }

  const now = new Date().toISOString();
  const { error: stampError } = await supabaseAdmin
    .from("coach_linkedin_profiles")
    .update({ optimizer_rewritten_at: now })
    .eq("coach_id", coachId);

  if (stampError) {
    console.error("linkedin-profile rewrite stamp failed");
  }

  return NextResponse.json({ variants });
}
