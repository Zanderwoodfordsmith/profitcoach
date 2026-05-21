import {
  BOSS_SCORE_SATURATED,
} from "./bossScorecardColors";
import {
  BEST_PRACTICE_QUESTIONS,
  DESIRED_OUTCOME_OTHER_VALUE,
  QUALIFYING_JOURNEY_FIELDS,
  QUALIFYING_SUPPORT_FIELDS,
  SCORECARD_QUESTIONS,
  SCORED_QUESTION_IDS,
  SCORE_PASTEL_COLORS,
  type QualifyingData,
  type QualifyingFieldDef,
  type ScorecardPillar,
} from "./bossScorecardQuestions";

export type ScorecardScore = 1 | 2 | 3 | 4 | 5;
export type ScorecardAnswers = Partial<Record<string, ScorecardScore>>;

export type BossLevel =
  | "Overwhelmed"
  | "Overworked"
  | "Organised"
  | "Overseer"
  | "Owner";

export type ScoreRag = "red" | "amber" | "green";

export function scoreToRag(score: ScorecardScore): ScoreRag {
  if (score <= 2) return "red";
  if (score === 3) return "amber";
  return "green";
}

export function scoreToPastelColor(score: ScorecardScore): string {
  return SCORE_PASTEL_COLORS[score];
}

export function scoreToPastelLensColor(score: ScorecardScore | null): string {
  if (score == null) return "#1f3a66";
  return SCORE_PASTEL_COLORS[score];
}

/** @deprecated Use scoreToPastelColor — kept for insight card RAG badges */
export function scoreToRagPastelColor(score: ScorecardScore): string {
  return scoreToPastelColor(score);
}

export function computeScorecardTotal(answers: ScorecardAnswers): number {
  let sum = 0;
  let count = 0;
  for (const id of SCORED_QUESTION_IDS) {
    const v = answers[id];
    if (v != null && v >= 1 && v <= 5) {
      sum += v;
      count += 1;
    }
  }
  if (count === 0) return 0;
  return Math.round((sum / 65) * 100);
}

export function getBossLevel(scorePercent: number): BossLevel {
  if (scorePercent <= 20) return "Overwhelmed";
  if (scorePercent <= 40) return "Overworked";
  if (scorePercent <= 60) return "Organised";
  if (scorePercent <= 80) return "Overseer";
  return "Owner";
}

export function avgScores(ids: string[], answers: ScorecardAnswers): number | null {
  const vals = ids
    .map((id) => answers[id])
    .filter((v): v is ScorecardScore => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export type PillarScores = {
  vision: number | null;
  velocity: number | null;
  value: number | null;
  owner: number | null;
};

export function computePillarAverages(
  answers: ScorecardAnswers
): PillarScores {
  return {
    vision: avgScores(["q2", "q3", "q4"], answers),
    velocity: avgScores(["q5", "q6", "q7", "q8"], answers),
    value: avgScores(["q9", "q10"], answers),
    owner: answers.q1 ?? null,
  };
}

export type OutcomeScores = {
  money: ScorecardScore | null;
  time: ScorecardScore | null;
  team: ScorecardScore | null;
};

export function computeOutcomeScores(
  answers: ScorecardAnswers
): OutcomeScores {
  return {
    money: answers.q11a ?? null,
    time: answers.q11b ?? null,
    team: answers.q11c ?? null,
  };
}

export type AreaBreakdownItem = {
  id: string;
  areaName: string;
  pillar: string;
  score: ScorecardScore;
  rag: ScoreRag;
};

export function computeAreaBreakdown(
  answers: ScorecardAnswers
): AreaBreakdownItem[] {
  return BEST_PRACTICE_QUESTIONS.map((q) => {
    const score = answers[q.id] ?? 3;
    return {
      id: q.id,
      areaName: q.areaName,
      pillar: q.pillar,
      score,
      rag: scoreToRag(score),
    };
  });
}

/** Ten area scores on 0–10 scale for BossWheel (scorecard rating × 2). */
export function computeScorecardWheelAreaScores(
  answers: ScorecardAnswers
): number[] {
  return BEST_PRACTICE_QUESTIONS.map((q) => {
    const score = answers[q.id];
    if (score == null || score < 1 || score > 5) return 0;
    return score * 2;
  });
}

export function findLowestArea(
  answers: ScorecardAnswers
): AreaBreakdownItem | null {
  const breakdown = computeAreaBreakdown(answers);
  if (breakdown.length === 0) return null;
  return breakdown.reduce((min, item) =>
    item.score < min.score ? item : min
  );
}

export function isScorecardComplete(answers: ScorecardAnswers): boolean {
  return SCORED_QUESTION_IDS.every(
    (id) => answers[id] != null && answers[id]! >= 1 && answers[id]! <= 5
  );
}

export function isQualifyingFieldComplete(
  field: QualifyingFieldDef,
  data: QualifyingData
): boolean {
  const val = data[field.id];
  if (field.multi) {
    return Array.isArray(val) && val.length > 0;
  }
  if (
    field.other &&
    val === DESIRED_OUTCOME_OTHER_VALUE
  ) {
    const detail = data[field.other.detailKey];
    return typeof detail === "string" && detail.trim().length >= 3;
  }
  return typeof val === "string" && val.trim().length > 0;
}

export function isQualifyingFieldsComplete(
  fields: QualifyingFieldDef[],
  data: QualifyingData
): boolean {
  return fields.every(
    (field) => !field.required || isQualifyingFieldComplete(field, data)
  );
}

export function isJourneyQualifyingComplete(data: QualifyingData): boolean {
  return isQualifyingFieldsComplete(QUALIFYING_JOURNEY_FIELDS, data);
}

export function isSupportQualifyingComplete(data: QualifyingData): boolean {
  return isQualifyingFieldsComplete(QUALIFYING_SUPPORT_FIELDS, data);
}

export function isQualifyingComplete(data: QualifyingData): boolean {
  return (
    isJourneyQualifyingComplete(data) && isSupportQualifyingComplete(data)
  );
}

export function qualifyingToWebhookFields(data: QualifyingData) {
  const obstacles = data.obstacles;
  return {
    annual_revenue: typeof data.annual_revenue === "string" ? data.annual_revenue : null,
    team_size: typeof data.team_size === "string" ? data.team_size : null,
    time_in_business:
      typeof data.time_in_business === "string" ? data.time_in_business : null,
    desired_outcome:
      typeof data.desired_outcome === "string" ? data.desired_outcome : null,
    desired_outcome_other:
      data.desired_outcome === DESIRED_OUTCOME_OTHER_VALUE &&
      typeof data.desired_outcome_other === "string"
        ? data.desired_outcome_other.trim()
        : null,
    obstacles: Array.isArray(obstacles)
      ? obstacles.join(", ")
      : typeof obstacles === "string"
      ? obstacles
      : null,
    preferred_solution:
      typeof data.preferred_solution === "string"
        ? data.preferred_solution
        : null,
  };
}

export function buildFakeScorecardAnswers(
  targetPercent = 64
): ScorecardAnswers {
  const varied = buildNaturalPreviewAnswers();
  if (targetPercent === 64) return varied;

  const targetSum = Math.round((targetPercent / 100) * 65);
  const currentSum = Object.values(varied).reduce((a, b) => a + (b ?? 0), 0);
  const diff = targetSum - currentSum;
  const answers = { ...varied };
  const ids = [...SCORED_QUESTION_IDS];
  let remaining = diff;
  let i = 0;
  while (remaining !== 0 && i < 200) {
    const id = ids[i % ids.length];
    const cur = answers[id] ?? 3;
    const delta = remaining > 0 ? 1 : -1;
    const next = Math.max(1, Math.min(5, cur + delta));
    if (next !== cur) {
      answers[id] = next as ScorecardScore;
      remaining -= next - cur;
    }
    i += 1;
  }
  return answers;
}

/** Natural-looking preview answers (not a 1–5 repeating pattern). */
export function buildNaturalPreviewAnswers(): ScorecardAnswers {
  return {
    q1: 3,
    q2: 1,
    q3: 4,
    q4: 2,
    q5: 5,
    q6: 2,
    q7: 4,
    q8: 1,
    q9: 3,
    q10: 4,
    q11a: 2,
    q11b: 4,
    q11c: 3,
  };
}

/** @deprecated Use buildNaturalPreviewAnswers */
export function buildFiveColorPreviewAnswers(): ScorecardAnswers {
  return buildNaturalPreviewAnswers();
}

/** Preview/demo answers with mixed scores across the venn. */
export function buildVariedScorecardAnswers(): ScorecardAnswers {
  return buildNaturalPreviewAnswers();
}

export const PREVIEW_LEVEL_OPTIONS: {
  level: BossLevel;
  targetScore: number;
  label: string;
  color: string;
}[] = [
  { level: "Overwhelmed", targetScore: 15, label: "Level 1 · Overwhelmed", color: BOSS_SCORE_SATURATED[1] },
  { level: "Overworked", targetScore: 32, label: "Level 2 · Overworked", color: BOSS_SCORE_SATURATED[2] },
  { level: "Organised", targetScore: 52, label: "Level 3 · Organised", color: BOSS_SCORE_SATURATED[3] },
  { level: "Overseer", targetScore: 72, label: "Level 4 · Overseer", color: BOSS_SCORE_SATURATED[4] },
  { level: "Owner", targetScore: 88, label: "Level 5 · Owner", color: BOSS_SCORE_SATURATED[5] },
];

export type ScorecardFocusItem = {
  id: string;
  areaName: string;
  score: ScorecardScore;
  rag: ScoreRag;
};

/** Lower = higher priority when scores tie. Velocity > Value > Vision > Foundation. */
const PILLAR_FOCUS_PRIORITY: Record<ScorecardPillar, number> = {
  velocity: 0,
  value: 1,
  vision: 2,
  foundation: 3,
  outcome: 99,
};

const AREA_FOCUS_ORDER = new Map(
  BEST_PRACTICE_QUESTIONS.map((q, index) => [q.id, index])
);

function compareScorecardFocusAreas(
  a: AreaBreakdownItem,
  b: AreaBreakdownItem
): number {
  if (a.score !== b.score) return a.score - b.score;
  const pillarA =
    PILLAR_FOCUS_PRIORITY[a.pillar as ScorecardPillar] ?? 99;
  const pillarB =
    PILLAR_FOCUS_PRIORITY[b.pillar as ScorecardPillar] ?? 99;
  if (pillarA !== pillarB) return pillarA - pillarB;
  return (
    (AREA_FOCUS_ORDER.get(a.id) ?? 99) - (AREA_FOCUS_ORDER.get(b.id) ?? 99)
  );
}

export function computeScorecardFocusAreas(
  answers: ScorecardAnswers,
  limit = 3
): ScorecardFocusItem[] {
  return computeAreaBreakdown(answers)
    .sort(compareScorecardFocusAreas)
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      areaName: item.areaName,
      score: item.score,
      rag: item.rag,
    }));
}

export function getQuestionById(id: string) {
  return SCORECARD_QUESTIONS.find((q) => q.id === id) ?? null;
}

export type CtaTier = "high" | "mid" | "low";

export function getCtaTier(scorePercent: number): CtaTier {
  if (scorePercent >= 61) return "high";
  if (scorePercent >= 41) return "mid";
  return "low";
}

export type ScorecardResultPayload = {
  answers: ScorecardAnswers;
  qualifying: QualifyingData;
  openText: string | null;
  prospectFirstName?: string | null;
  totalScore: number;
  bossLevel: BossLevel;
  pillarScores: PillarScores;
  outcomeScores: OutcomeScores;
  areaBreakdown: AreaBreakdownItem[];
  lowestArea: AreaBreakdownItem | null;
};

export function buildScorecardResult(
  answers: ScorecardAnswers,
  qualifying: QualifyingData,
  openText: string | null,
  prospectFirstName?: string | null
): ScorecardResultPayload {
  const totalScore = computeScorecardTotal(answers);
  return {
    answers,
    qualifying,
    openText,
    prospectFirstName: prospectFirstName ?? null,
    totalScore,
    bossLevel: getBossLevel(totalScore),
    pillarScores: computePillarAverages(answers),
    outcomeScores: computeOutcomeScores(answers),
    areaBreakdown: computeAreaBreakdown(answers),
    lowestArea: findLowestArea(answers),
  };
}
