import { bandFor, type ArtifactKind, type CheckResult, type JudgeResult, type Rubric, type ScoredArtifact } from "./types";

/** A gate caps the score here, so a piece with a broken rule can never read as Good. */
export const GATE_CAP = 40;

/** Weighted judge score, 0 to 100 (all 1s is 0, all 5s is 100). */
export function judgeScore(rubric: Rubric, judge: JudgeResult): number {
  let total = 0;
  let weights = 0;
  for (const c of rubric.criteria) {
    const s = judge.criteria.find((j) => j.id === c.id)?.score ?? 1;
    total += c.weight * ((s - 1) / 4);
    weights += c.weight;
  }
  return weights ? (total / weights) * 100 : 0;
}

/**
 * Code checks plus the judge. Unsupported claims about the coach count as a
 * gate for Ava's copy: she may only use facts she was given.
 */
export function combine(opts: {
  kind: ArtifactKind;
  rubric: Rubric | null;
  checks: CheckResult[];
  judge: JudgeResult | null;
  /** Fail on unsupported claims (Ava's copy, when facts were given). */
  claimsGate?: boolean;
}): ScoredArtifact {
  const checks = [...opts.checks];
  if (opts.claimsGate && opts.judge) {
    const invented = opts.judge.claims.filter((c) => !c.supported && c.severity !== "stretched");
    const stretched = opts.judge.claims.filter((c) => !c.supported && c.severity === "stretched");
    checks.push(
      invented.length
        ? {
            id: "invented_claims",
            level: "gate",
            passed: false,
            message: `Claims about the coach that the facts do not support: ${invented.map((c) => `"${c.claim}"`).join("; ")}.`,
          }
        : { id: "invented_claims", level: "gate", passed: true, message: `No invented claims about the coach (${opts.judge.claims.length} checked).` }
    );
    if (stretched.length) {
      checks.push({
        id: "stretched_claims",
        level: "penalty",
        passed: false,
        points: Math.min(12, stretched.length * 4),
        message: `Overstates true facts: ${stretched.map((c) => `"${c.claim}" (${c.note})`).join("; ")}.`,
      });
    }
  }
  const base = opts.judge && opts.rubric ? judgeScore(opts.rubric, opts.judge) : opts.rubric ? 0 : 100;
  const penalties = checks.filter((c) => c.level === "penalty" && !c.passed).reduce((sum, c) => sum + (c.points ?? 0), 0);
  const hardFails = checks.filter((c) => c.level === "gate" && !c.passed).map((c) => c.id);
  let score = Math.max(0, Math.min(100, base - penalties));
  if (hardFails.length) score = Math.min(score, GATE_CAP);
  score = Math.round(score * 10) / 10;
  const pass = opts.rubric?.pass ?? 70;
  return {
    kind: opts.kind,
    score,
    band: bandFor(score),
    passed: !hardFails.length && score >= pass,
    hardFails,
    checks,
    judge: opts.judge,
    judgeScore: opts.judge && opts.rubric ? Math.round(base * 10) / 10 : null,
  };
}

/** The most useful single fix: a failed gate first, then the judge's top fix, then the biggest penalty. */
export function topFix(scored: ScoredArtifact): string {
  const gate = scored.checks.find((c) => c.level === "gate" && !c.passed);
  if (gate) return gate.message;
  if (scored.judge?.top_fix) return scored.judge.top_fix;
  const penalty = [...scored.checks].filter((c) => c.level === "penalty" && !c.passed).sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0];
  return penalty?.message ?? "";
}
