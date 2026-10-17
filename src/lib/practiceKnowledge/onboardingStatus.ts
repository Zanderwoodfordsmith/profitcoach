import { BLUEPRINT_OUTPUTS } from "./outputs";
import { computeCompleteness, labelMissingField } from "./completeness";
import { listOnboardingTranscripts } from "./ingestOnboarding";
import { ensurePracticeKnowledge } from "./store";

export type PracticeStage = "signed" | "facts" | "written" | "ready";

export type OnboardingStatus = {
  stage: PracticeStage;
  linkedin_seeded: boolean;
  transcripts: { count: number; titles: string[] };
  missing_facts: string[];
  written_sections: number;
  outputs_ready: { id: string; title: string }[];
  outputs_still_open: { id: string; title: string }[];
};

export async function loadOnboardingStatus(coachId: string): Promise<OnboardingStatus> {
  const [row, transcripts] = await Promise.all([
    ensurePracticeKnowledge(coachId),
    listOnboardingTranscripts(coachId).catch(() => []),
  ]);
  const completeness = computeCompleteness(row.payload);
  const built = row.built_sections ?? {};
  const written = Object.keys(built).length;
  const outputs_ready = BLUEPRINT_OUTPUTS.filter((output) =>
    output.section ? Boolean(built[output.section]) : false
  ).map((output) => ({ id: output.id, title: output.title }));
  const outputs_still_open = BLUEPRINT_OUTPUTS.filter(
    (output) => output.section && !built[output.section]
  ).map((output) => ({ id: output.id, title: output.title }));

  let stage: PracticeStage = "signed";
  if (outputs_ready.length >= 4) stage = "ready";
  else if (written > 0) stage = "written";
  else if (
    row.linkedin_seeded_at ||
    transcripts.length ||
    completeness.missing_fields.length < 6
  ) {
    stage = "facts";
  }

  return {
    stage,
    linkedin_seeded: Boolean(row.linkedin_seeded_at),
    transcripts: {
      count: transcripts.length,
      titles: transcripts.slice(0, 6).map((row) => row.title),
    },
    missing_facts: completeness.missing_fields.map(labelMissingField),
    written_sections: written,
    outputs_ready,
    outputs_still_open: outputs_still_open.slice(0, 8),
  };
}
