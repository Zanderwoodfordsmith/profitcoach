/**
 * Ava evals and the coach audit share these shapes. One rubric per artifact
 * (content/agent/evals/rubrics); code checks first, then a judge model.
 * Server only. Nothing here sends anything to a prospect.
 */

export const ARTIFACT_KINDS = [
  "linkedin.headline",
  "linkedin.about",
  "linkedin.experience",
  "linkedin.basics",
  "campaign.connection",
  "campaign.followups",
  "campaign.nurture",
  "reply.draft",
  "research.pains",
] as const;

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

/** Rubric files by artifact. linkedin.basics is scored in code only. */
export const RUBRIC_FILES: Record<Exclude<ArtifactKind, "linkedin.basics">, string> = {
  "linkedin.headline": "linkedin-headline.md",
  "linkedin.about": "linkedin-about.md",
  "linkedin.experience": "linkedin-experience.md",
  "campaign.connection": "connection-note.md",
  "campaign.followups": "follow-ups.md",
  "campaign.nurture": "nurture.md",
  "reply.draft": "reply-draft.md",
  "research.pains": "pain-research.md",
};

export const ARTIFACT_LABELS: Record<ArtifactKind, string> = {
  "linkedin.headline": "Headline",
  "linkedin.about": "About",
  "linkedin.experience": "Current role",
  "linkedin.basics": "Profile basics",
  "campaign.connection": "Connection note",
  "campaign.followups": "Follow-ups",
  "campaign.nurture": "Nurture",
  "reply.draft": "Reply",
  "research.pains": "Pain research",
};

/** gate: fails the piece and caps the score. penalty: takes points off. info: shown, no effect. */
export type CheckLevel = "gate" | "penalty" | "info";

export type CheckResult = {
  id: string;
  level: CheckLevel;
  passed: boolean;
  /** Points off when a penalty fails. */
  points?: number;
  message: string;
};

export type Criterion = {
  id: string;
  weight: number;
  label: string;
  /** The 5 / 3 / 1 anchor lines, as written. */
  anchors: string;
};

export type Rubric = {
  id: ArtifactKind;
  title: string;
  pass: number;
  /** The whole file body, which is what the judge reads. */
  text: string;
  criteria: Criterion[];
  examples: { strong: string | null; weak: string | null };
};

export type JudgeCriterionScore = {
  id: string;
  score: number;
  evidence: string;
  fix: string;
};

/** A factual claim about the coach, checked against the facts the writer was given. */
export type JudgeClaim = {
  claim: string;
  supported: boolean;
  /** invented: new facts (a gate for Ava). stretched: a true fact slightly overstated (a penalty). */
  severity: "invented" | "stretched";
  note: string;
};

export type ModelUsage = {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  cost_usd: number;
  stop_reason: string | null;
  ms: number;
};

export type JudgeResult = {
  criteria: JudgeCriterionScore[];
  claims: JudgeClaim[];
  summary: string;
  top_fix: string;
  model: string;
  usage: ModelUsage | null;
};

export type ScoreBand = "strong" | "good" | "needs_work" | "weak";

export type ScoredArtifact = {
  kind: ArtifactKind;
  score: number;
  band: ScoreBand;
  passed: boolean;
  hardFails: string[];
  checks: CheckResult[];
  judge: JudgeResult | null;
  /** The judge's weighted score before code checks, 0 to 100. */
  judgeScore: number | null;
};

/** Who wrote the text decides which checks apply (Ava may not invent; a coach's live campaign may not hold [brackets]). */
export type Authorship = "ava" | "coach";

export const BAND_LABELS: Record<ScoreBand, string> = {
  strong: "Strong",
  good: "Good",
  needs_work: "Needs work",
  weak: "Weak",
};

export function bandFor(score: number): ScoreBand {
  if (score >= 85) return "strong";
  if (score >= 70) return "good";
  if (score >= 50) return "needs_work";
  return "weak";
}
