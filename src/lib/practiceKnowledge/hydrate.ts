import { loadCoachLinkedInSummary } from "@/lib/firstCampaign/loadCoachContext";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadDecisionCallBookedAt } from "./decisionCallBooked";
import { payloadFromWelcomeIntake } from "./ingestWelcome";
import { mirrorLinkedInUrlToProfile } from "./linkedinSync";
import { seedPayloadFromLinkedIn } from "./seedFromLinkedIn";
import {
  emptyPracticePayload,
  isFilledSourced,
  mergePracticePayload,
  sourced,
  textValue,
} from "./sourced";
import { ensurePracticeKnowledge, patchPracticeKnowledge } from "./store";
import type { PracticeKnowledgePayload, PracticeKnowledgeRow } from "./types";

type ProgrammeIntake = {
  linkedin_url?: string | null;
  time_commitment?: string | null;
};

/** Fill hours / LinkedIn from welcome + existing snapshot without scraping. */
export async function hydratePracticeFromProfile(
  coachId: string
): Promise<PracticeKnowledgeRow> {
  const knowledge = await ensurePracticeKnowledge(coachId);
  const [profile, coach, linkedin, booked] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("linkedin_url, location, phone")
      .eq("id", coachId)
      .maybeSingle(),
    supabaseAdmin
      .from("coaches")
      .select("programme_intake")
      .eq("id", coachId)
      .maybeSingle(),
    loadCoachLinkedInSummary(coachId),
    loadDecisionCallBookedAt([coachId]).catch(() => new Map<string, string>()),
  ]);

  const intake = (coach.data?.programme_intake ?? {}) as ProgrammeIntake;
  const linkedinUrl =
    (profile.data?.linkedin_url as string | null | undefined)?.trim() ||
    intake.linkedin_url?.trim() ||
    "";
  const welcomePatch = payloadFromWelcomeIntake({
    linkedinUrl,
    timeCommitment: intake.time_commitment,
  });
  const linkedinPatch = seedPayloadFromLinkedIn(linkedin.snapshot, {
    linkedinUrl,
    location: (profile.data?.location as string | null | undefined) ?? null,
  });

  const hoursEmpty = !isFilledSourced(knowledge.payload.working_times.hours_per_week);
  const urlEmpty = !isFilledSourced(knowledge.payload.identity.linkedin_url);
  const shouldWelcome =
    (hoursEmpty && Boolean(welcomePatch.working_times?.hours_per_week)) ||
    (urlEmpty && Boolean(welcomePatch.identity?.linkedin_url));
  // Records seeded before the headline and About were kept get them on the next open.
  const profileMissing =
    Boolean(linkedin.snapshot?.headline?.trim() || linkedin.snapshot?.about?.trim()) &&
    !isFilledSourced(knowledge.payload.identity.linkedin_headline) &&
    !isFilledSourced(knowledge.payload.identity.linkedin_about);
  const seedFull = Boolean(linkedin.snapshot) && !knowledge.linkedin_seeded_at;
  const shouldSeedLi = seedFull || profileMissing;
  // Already seeded: add only the headline and About, never re-import fields the coach may have edited.
  const liPatch: Partial<PracticeKnowledgePayload> =
    !seedFull && profileMissing
      ? {
          identity: {
            ...emptyPracticePayload().identity,
            linkedin_headline: linkedinPatch.identity?.linkedin_headline ?? null,
            linkedin_about: linkedinPatch.identity?.linkedin_about ?? null,
          },
        }
      : linkedinPatch;
  const profilePhone = String((profile.data as { phone?: string | null } | null)?.phone ?? "").trim();
  const shouldPhone = Boolean(profilePhone) && !isFilledSourced(knowledge.payload.identity.phone);
  const bookedAt = booked.get(coachId);
  const shouldBooked =
    Boolean(bookedAt) &&
    !isFilledSourced(knowledge.payload.review.decision_call_booked_at);

  if (!shouldWelcome && !shouldSeedLi && !shouldBooked && !shouldPhone) {
    return copyBlueprintLinkedInWhenProfileEmpty(
      coachId,
      knowledge,
      profile.data?.linkedin_url as string | null | undefined
    );
  }

  const saved = await patchPracticeKnowledge({
    coachId,
    payloadPatch: mergePracticePayload(
      mergePracticePayload(
        mergePracticePayload(emptyPracticePayload(), welcomePatch),
        liPatch
      ),
      {
        ...(shouldBooked && bookedAt
          ? {
              review: {
                ...emptyPracticePayload().review,
                decision_call_booked_at: sourced(bookedAt, "form"),
              },
            }
          : {}),
        ...(shouldPhone
          ? { identity: { ...emptyPracticePayload().identity, phone: sourced(profilePhone, "form") } }
          : {}),
      }
    ),
    linkedinSeeded: shouldSeedLi,
  });
  return copyBlueprintLinkedInWhenProfileEmpty(
    coachId,
    saved,
    profile.data?.linkedin_url as string | null | undefined
  );
}

/** The blueprint already has a LinkedIn URL and the account does not. Keep the one they filled in. */
async function copyBlueprintLinkedInWhenProfileEmpty(
  coachId: string,
  knowledge: PracticeKnowledgeRow,
  profileUrl: string | null | undefined
): Promise<PracticeKnowledgeRow> {
  const blueprintUrl = textValue(knowledge.payload.identity.linkedin_url);
  if (!blueprintUrl || profileUrl?.trim()) return knowledge;
  try {
    await mirrorLinkedInUrlToProfile(coachId, blueprintUrl);
  } catch (err) {
    console.error(
      "practice LinkedIn profile mirror:",
      err instanceof Error ? err.message : "failed"
    );
  }
  return knowledge;
}
