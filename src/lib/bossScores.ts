/**
 * BOSS score calculations - total, area, pillar, focus, breakdown.
 * Ported from BOSS Dashboard thank-you.js.
 */

import { PLAYBOOKS, PLAYBOOK_COUNT } from "./bossData";

export type AnswersMap = Record<string, 0 | 1 | 2>;

export type PillarScores = {
  vision: number;
  velocity: number;
  value: number;
};

export type LevelScore = { level: number; sum: number; percent: number };
export type PillarScoresWithFoundation = {
  foundation: number;
  vision: number;
  velocity: number;
  value: number;
};

export type ScoreBreakdown = {
  green: number;
  amber: number;
  red: number;
  unanswered: number;
};

export type FocusItem = {
  ref: string;
  name: string;
  level: number;
  area: number;
  status: 0 | 1;
  priority: number;
};

const FOCUS_LEVEL_WEIGHTS: Record<number, number> = {
  1: 3.0,
  2: 2.0,
  3: 1.2,
  4: 0.8,
  5: 0.5,
};

const FOCUS_AREA_WEIGHTS = [1.3, 1.0, 1.0, 1.0, 1.2, 1.2, 1.2, 1.0, 1.0, 1.0];
const FOCUS_AREA_TIEBREAKERS = [0.1, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03, 0.02, 0.01];

export function getTotalScore(scores: AnswersMap | null | undefined): number {
  if (!scores) return 0;
  return Object.values(scores).reduce<number>((sum, v) => {
    return sum + (v === 0 || v === 1 || v === 2 ? v : 0);
  }, 0);
}

export function computeAreaScores(scores: AnswersMap | null | undefined): number[] {
  const areaScores = new Array<number>(10).fill(0);
  if (!scores) return areaScores;
  for (const p of PLAYBOOKS) {
    const v = scores[p.ref];
    if (v === 0 || v === 1 || v === 2) {
      areaScores[p.area] += v;
    }
  }
  return areaScores;
}

export function computePillarScores(
  scores: AnswersMap | null | undefined
): PillarScores {
  let vision = 0;
  let velocity = 0;
  let value = 0;
  if (!scores) return { vision, velocity, value };
  for (const p of PLAYBOOKS) {
    const v = scores[p.ref];
    if (v !== 0 && v !== 1 && v !== 2) continue;
    if (p.area >= 1 && p.area <= 3) vision += v;
    else if (p.area >= 4 && p.area <= 6) velocity += v;
    else if (p.area >= 7 && p.area <= 9) value += v;
  }
  return { vision, velocity, value };
}

/** Per-level scores: level 1–5, each has 10 playbooks (max 20). Order: 1 = Overwhelm … 5 = Owner. */
export function computeLevelScores(
  scores: AnswersMap | null | undefined
): LevelScore[] {
  const result: LevelScore[] = [];
  for (let level = 1; level <= 5; level++) {
    let sum = 0;
    for (const p of PLAYBOOKS) {
      if (p.level !== level) continue;
      const v = scores?.[p.ref];
      if (v === 0 || v === 1 || v === 2) sum += v;
    }
    result.push({ level, sum, percent: Math.round((sum / 20) * 100) });
  }
  return result;
}

/** Pillar scores including Foundation (area 0 only, max 10). */
export function computePillarScoresWithFoundation(
  scores: AnswersMap | null | undefined
): PillarScoresWithFoundation {
  const pillars = computePillarScores(scores);
  let foundation = 0;
  if (scores) {
    for (const p of PLAYBOOKS) {
      if (p.area !== 0) continue;
      const v = scores[p.ref];
      if (v === 0 || v === 1 || v === 2) foundation += v;
    }
  }
  return { foundation, ...pillars };
}

export function computeScoreBreakdown(
  scores: AnswersMap | null | undefined
): ScoreBreakdown {
  let green = 0;
  let amber = 0;
  let red = 0;
  if (!scores) {
    return { green, amber, red, unanswered: PLAYBOOK_COUNT };
  }
  for (const p of PLAYBOOKS) {
    const v = scores[p.ref];
    if (v === 2) green++;
    else if (v === 1) amber++;
    else if (v === 0) red++;
  }
  const unanswered = PLAYBOOK_COUNT - green - amber - red;
  return { green, amber, red, unanswered };
}

export function computeFocusAreas(scores: AnswersMap | null | undefined): FocusItem[] {
  const items: FocusItem[] = [];
  if (!scores) return items;
  for (const p of PLAYBOOKS) {
    const status = scores[p.ref];
    if (status !== 0 && status !== 1) continue;
    const statusWeight = status === 0 ? 3 : 2;
    const levelWeight = FOCUS_LEVEL_WEIGHTS[p.level] ?? 1.0;
    const areaWeight = FOCUS_AREA_WEIGHTS[p.area] ?? 1.0;
    const tiebreaker = FOCUS_AREA_TIEBREAKERS[p.area] ?? 0;
    const priority = statusWeight * levelWeight * areaWeight + tiebreaker;
    items.push({
      ref: p.ref,
      name: p.name,
      level: p.level,
      area: p.area,
      status,
      priority,
    });
  }
  items.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.area !== b.area) return a.area - b.area;
    return a.level - b.level;
  });
  return items;
}

/**
 * Build fake scores for preview/demo. Seeds some reds/ambers for top-3 substance.
 * Optionally adjusts to match targetTotal.
 */
export function buildFakeScores(targetTotal?: number): AnswersMap {
  const scores: AnswersMap = {};
  for (const p of PLAYBOOKS) {
    scores[p.ref] = 2;
  }
  const seedRefs = ["1.4", "2.5", "3.7", "2.4", "3.5"];
  seedRefs.forEach((ref, idx) => {
    if (ref in scores) {
      scores[ref] = idx < 3 ? 0 : 1;
    }
  });
  if (typeof targetTotal === "number" && Number.isFinite(targetTotal)) {
    const currentTotal = getTotalScore(scores);
    if (targetTotal < currentTotal) {
      const extraRefs = PLAYBOOKS.map((p) => p.ref).filter(
        (ref) => scores[ref] === 2 && !seedRefs.includes(ref)
      );
      let i = 0;
      while (i < extraRefs.length && getTotalScore(scores) > targetTotal) {
        scores[extraRefs[i]] = 1;
        i++;
      }
    }
  }
  return scores;
}
