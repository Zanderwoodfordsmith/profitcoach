/**
 * BOSS scorecard palette — red → orange → yellow → green → blue (scores / levels 1–5).
 *
 * Use BOSS_SCORE_SATURATED for hero, icons, smiley scale, and level labels.
 * Use BOSS_SCORE_PASTEL for compass / venn fills (same hues, softer).
 */

export type BossScoreHue = 1 | 2 | 3 | 4 | 5;

/** Fully saturated — hero dial labels, level icons, assessment smileys. */
export const BOSS_SCORE_SATURATED: Record<BossScoreHue, string> = {
  1: "#EF4444",
  2: "#F97316",
  3: "#EAB308",
  4: "#22C55E",
  5: "#238BF7",
};

/** Darker companions for progress bar gradients and borders. */
export const BOSS_SCORE_SATURATED_DARK: Record<BossScoreHue, string> = {
  1: "#DC2626",
  2: "#EA580C",
  3: "#CA8A04",
  4: "#16A34A",
  5: "#2563EB",
};

/** Deep end of level progress bar gradients (left / darker side). */
export const BOSS_SCORE_SATURATED_DEEP: Record<BossScoreHue, string> = {
  1: "#991B1B",
  2: "#9A3412",
  3: "#854D0E",
  4: "#15803D",
  5: "#1D4ED8",
};

/** Muted companions — BOSS Compass petals and lens fills. */
export const BOSS_SCORE_PASTEL: Record<BossScoreHue, string> = {
  1: "#F0A8AE",
  2: "#FAC896",
  3: "#F5E08A",
  4: "#A8DFBC",
  5: "#A8C8F2",
};

export const BOSS_LEVEL_NUMBERS = {
  Overwhelmed: 1,
  Overworked: 2,
  Organised: 3,
  Overseer: 4,
  Owner: 5,
} as const;

export type BossLevelName = keyof typeof BOSS_LEVEL_NUMBERS;

export function bossLevelSaturated(level: BossLevelName): string {
  return BOSS_SCORE_SATURATED[BOSS_LEVEL_NUMBERS[level] as BossScoreHue];
}

export function bossLevelPastel(level: BossLevelName): string {
  return BOSS_SCORE_PASTEL[BOSS_LEVEL_NUMBERS[level] as BossScoreHue];
}
