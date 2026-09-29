import {
  LinkedInProfileError,
  normalizeLinkedInProfileUrl,
  scrapeLinkedInProfile,
} from "@/lib/apify/linkedinProfile";
import { applyLinkedInPhotoAsAvatarIfMissing } from "@/lib/apify/applyLinkedInAvatar";
import { loadCoachLinkedInSummary } from "@/lib/firstCampaign/loadCoachContext";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { seedPayloadFromLinkedIn } from "./seedFromLinkedIn";
import { ensurePracticeKnowledge, patchPracticeKnowledge } from "./store";
import type { PracticeKnowledgeRow } from "./types";

export async function seedPracticeFromLinkedIn(
  coachId: string,
  opts?: { scrape?: boolean; linkedinUrl?: string | null }
): Promise<{ knowledge: PracticeKnowledgeRow; scraped: boolean }> {
  const profile = await supabaseAdmin
    .from("profiles")
    .select("linkedin_url, location")
    .eq("id", coachId)
    .maybeSingle();

  let scraped = false;
  const urlInput =
    opts?.linkedinUrl?.trim() ||
    (profile.data?.linkedin_url as string | null | undefined)?.trim() ||
    "";

  if (opts?.scrape && urlInput) {
    const normalized = normalizeLinkedInProfileUrl(urlInput);
    if (normalized) {
      const existing = await supabaseAdmin
        .from("coach_linkedin_profiles")
        .select("snapshot")
        .eq("coach_id", coachId)
        .maybeSingle();
      const hasSnapshot =
        existing.data?.snapshot &&
        typeof existing.data.snapshot === "object" &&
        Object.keys(existing.data.snapshot as object).length > 0;
      if (!hasSnapshot) {
        try {
          const result = await scrapeLinkedInProfile(normalized);
          const scrapedAt = new Date().toISOString();
          await supabaseAdmin.from("coach_linkedin_profiles").upsert(
            {
              coach_id: coachId,
              linkedin_url: result.linkedinUrl,
              scraped_at: scrapedAt,
              snapshot: result.snapshot,
              raw: result.raw,
              updated_at: scrapedAt,
            },
            { onConflict: "coach_id" }
          );
          await supabaseAdmin
            .from("profiles")
            .update({ linkedin_url: result.linkedinUrl })
            .eq("id", coachId);
          await applyLinkedInPhotoAsAvatarIfMissing(
            coachId,
            result.snapshot.photoUrl
          );
          scraped = true;
        } catch (err) {
          if (!(err instanceof LinkedInProfileError)) {
            console.error(
              "practice LinkedIn scrape:",
              err instanceof Error ? err.message : "failed"
            );
          }
        }
      }
    }
  }

  const { snapshot } = await loadCoachLinkedInSummary(coachId);
  await ensurePracticeKnowledge(coachId);
  const knowledge = await patchPracticeKnowledge({
    coachId,
    payloadPatch: seedPayloadFromLinkedIn(snapshot, {
      linkedinUrl:
        (profile.data?.linkedin_url as string | null | undefined) || urlInput,
      location: (profile.data?.location as string | null | undefined) ?? null,
    }),
    linkedinSeeded: Boolean(snapshot) || scraped,
  });
  return { knowledge, scraped };
}
