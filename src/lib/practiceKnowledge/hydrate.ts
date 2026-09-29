import { loadCoachLinkedInSummary } from "@/lib/firstCampaign/loadCoachContext";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadDecisionCallBookedAt } from "./decisionCallBooked";
import { payloadFromWelcomeIntake } from "./ingestWelcome";
import { seedPayloadFromLinkedIn } from "./seedFromLinkedIn";
import {
  emptyPracticePayload,
  isFilledSourced,
  mergePracticePayload,
  sourced,
} from "./sourced";
import { ensurePracticeKnowledge, patchPracticeKnowledge } from "./store";
import type { PracticeKnowledgeRow } from "./types";

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
      .select("linkedin_url, location")
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
  const shouldSeedLi = Boolean(linkedin.snapshot) && !knowledge.linkedin_seeded_at;
  const bookedAt = booked.get(coachId);
  const shouldBooked =
    Boolean(bookedAt) &&
    !isFilledSourced(knowledge.payload.review.decision_call_booked_at);

  if (!shouldWelcome && !shouldSeedLi && !shouldBooked) return knowledge;

  return patchPracticeKnowledge({
    coachId,
    payloadPatch: mergePracticePayload(
      mergePracticePayload(
        mergePracticePayload(emptyPracticePayload(), welcomePatch),
        linkedinPatch
      ),
      shouldBooked && bookedAt
        ? {
            review: {
              ...emptyPracticePayload().review,
              decision_call_booked_at: sourced(bookedAt, "form"),
            },
          }
        : {}
    ),
    linkedinSeeded: shouldSeedLi,
  });
}
