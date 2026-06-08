/** Boss Pro (50-question) assessment intro screen. */
import { getScorecardLevelDetail } from "./bossScorecardCopy";
import type { BossLevel } from "./bossScorecardScores";
import { BOSS_PRO_RATING_LEGEND } from "./bossProScoringLabels";

function bossLevelKey(level: number): BossLevel {
  const map: Record<number, BossLevel> = {
    1: "Overwhelmed",
    2: "Overworked",
    3: "Organised",
    4: "Overseer",
    5: "Owner",
  };
  return map[Math.min(5, Math.max(1, level))] ?? "Overwhelmed";
}

export function getBossProLevelDetail(level: number): string[] {
  const details = [...getScorecardLevelDetail(bossLevelKey(level))];
  if (level === 5 && details.length >= 3) {
    details[2] =
      "The question now is what you want the business to do for you next, whether that is more profit, more time, a bigger team, or an exit. Your area breakdown below shows where to fine-tune rather than rebuild.";
  }
  return details;
}

export const BOSS_PRO_FOCUS_SECTION_INTRO =
  "Your three priority areas from the full diagnostic. Each area score rolls up every playbook in that part of the business — lower scores need attention first.";

export const BOSS_PRO_INTRO = {
  titleAssessment: "Full diagnostic",
  subtitle:
    "Score how your business runs across 50 questions in the five BOSS levels and get a score out of 100.",
  instruction: "Tap the option that matches how this area is working in your business.",
  ratingLegend: BOSS_PRO_RATING_LEGEND,
  whatYouGetDetailsLabel: "What you'll get",
  whatYouGetBullets: [
    "A score out of 100 across all five BOSS levels.",
    "A clear picture of what's working and where you're stuck.",
    "Level-by-level breakdown to prioritise what to fix first.",
    "A foundation for deeper coaching on your business operating system.",
  ],
  startCta: "Start assessment",
} as const;
