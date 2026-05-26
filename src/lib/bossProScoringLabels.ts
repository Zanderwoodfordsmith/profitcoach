/** BOSS Pro assessment answer labels (methodology v2 — aligned with Boss Score middle tier). */

export const BOSS_PRO_SCORE_LABELS = {
  0: "Needs Work",
  1: "It's ok",
  2: "Really Good",
} as const;

export const BOSS_PRO_SCORE_HINTS = {
  0: "Not working well enough yet",
  1: "Partly working",
  2: "Working well",
} as const;

export const BOSS_PRO_RATING_LEGEND = [
  { label: BOSS_PRO_SCORE_LABELS[0], hint: BOSS_PRO_SCORE_HINTS[0] },
  { label: BOSS_PRO_SCORE_LABELS[1], hint: BOSS_PRO_SCORE_HINTS[1] },
  { label: BOSS_PRO_SCORE_LABELS[2], hint: BOSS_PRO_SCORE_HINTS[2] },
] as const;

export function bossProScoreAriaLabel(score: 0 | 1 | 2): string {
  return `${BOSS_PRO_SCORE_LABELS[score]}. ${BOSS_PRO_SCORE_HINTS[score]}.`;
}

export function bossProGridScoreDescription(
  score: 0 | 1 | 2 | undefined
): string {
  if (score === 0) return BOSS_PRO_SCORE_LABELS[0];
  if (score === 1) return BOSS_PRO_SCORE_LABELS[1];
  if (score === 2) return BOSS_PRO_SCORE_LABELS[2];
  return "Not scored";
}
