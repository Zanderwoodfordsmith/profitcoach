import type {
  FunnelCounts,
  FunnelKpis,
  FunnelStageDefinition,
  FunnelStageId,
} from "@/lib/funnelKpis";
import {
  FUNNEL_COUNT_DISPLAY_LABELS,
  FUNNEL_KPIS,
  FUNNEL_STAGES,
} from "@/lib/funnelKpis";

export type FunnelStatus = "green" | "yellow" | "red" | "na";

export type StageResult = {
  id: FunnelStageId;
  denominatorKey: keyof FunnelCounts;
  numeratorKey: keyof FunnelCounts;
  denominator: number;
  numerator: number;
  rate: number | null;
  kpi: number;
  status: FunnelStatus;
  deficit: number | null;
  minGreenNumerator: number | null;
};

export function safeNonNegativeInt(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  return Math.floor(n);
}

export function computeRate(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator <= 0) return null;
  if (numerator < 0) return null;
  return numerator / denominator;
}

export function statusForRate(rate: number | null, kpi: number): FunnelStatus {
  if (rate === null) return "na";
  if (rate >= kpi) return "green";
  if (rate >= kpi * 0.8) return "yellow";
  return "red";
}

/**
 * Fraction of KPI gap: (kpi - rate) / kpi when below target.
 * Used to compare stages with different KPI magnitudes after status tie.
 */
export function relativeDeficit(rate: number | null, kpi: number): number | null {
  if (rate === null || kpi <= 0) return null;
  return Math.max(0, (kpi - rate) / kpi);
}

export function sentToInterestedRate(counts: FunnelCounts): number | null {
  return computeRate(counts.interested, counts.sent);
}

export function interestedToClosedRate(counts: FunnelCounts): number | null {
  return computeRate(counts.closed, counts.interested);
}

/** Full-funnel yield: closed ÷ sent (same window). */
export function sentToClosedRate(counts: FunnelCounts): number | null {
  return computeRate(counts.closed, counts.sent);
}

export function computeMinGreenNumerator(denominator: number, kpi: number): number | null {
  if (!Number.isFinite(denominator) || denominator <= 0) return null;
  return Math.ceil(denominator * kpi);
}

export function computeStageResult(
  counts: FunnelCounts,
  stage: FunnelStageDefinition,
  kpis: FunnelKpis = FUNNEL_KPIS,
): StageResult {
  const denominator = counts[stage.denominatorKey];
  const numerator = counts[stage.numeratorKey];
  const kpi = kpis[stage.id];
  const rate = computeRate(numerator, denominator);
  const status = statusForRate(rate, kpi);
  const deficit = rate === null ? null : Math.max(0, kpi - rate);
  const minGreenNumerator = computeMinGreenNumerator(denominator, kpi);

  return {
    id: stage.id,
    denominatorKey: stage.denominatorKey,
    numeratorKey: stage.numeratorKey,
    denominator,
    numerator,
    rate,
    kpi,
    status,
    deficit,
    minGreenNumerator,
  };
}

export function computeAllStages(
  counts: FunnelCounts,
  stages: readonly FunnelStageDefinition[] = FUNNEL_STAGES,
  kpis: FunnelKpis = FUNNEL_KPIS,
): StageResult[] {
  return stages.map((s) => computeStageResult(counts, s, kpis));
}

export function choosePriorityStage(stages: StageResult[]): StageResult | null {
  if (stages.length === 0) return null;

  const statusRank: Record<FunnelStatus, number> = {
    red: 3,
    yellow: 2,
    green: 1,
    na: 0,
  };

  return [...stages].sort((a, b) => {
    const byStatus = statusRank[b.status] - statusRank[a.status];
    if (byStatus !== 0) return byStatus;

    // Same status: pick the stage with the largest relative gap below KPI (fair across 15% vs 80% targets).
    const ar = relativeDeficit(a.rate, a.kpi) ?? -1;
    const br = relativeDeficit(b.rate, b.kpi) ?? -1;
    if (br !== ar) return br - ar;

    return 0;
  })[0]!;
}

export type FunnelValidationIssue = {
  key: keyof FunnelCounts;
  message: string;
  severity: "warning";
};

export function validateMonotonicCounts(counts: FunnelCounts): FunnelValidationIssue[] {
  const issues: FunnelValidationIssue[] = [];
  const ordered: (keyof FunnelCounts)[] = [
    "sent",
    "connected",
    "replied",
    "interested",
    "booked",
    "showed",
    "closed",
  ];

  for (let i = 1; i < ordered.length; i++) {
    const prevKey = ordered[i - 1]!;
    const key = ordered[i]!;
    if (counts[key] > counts[prevKey]) {
      issues.push({
        key,
        severity: "warning",
        message: `This can’t be higher than ${FUNNEL_COUNT_DISPLAY_LABELS[prevKey]}.`,
      });
    }
  }

  return issues;
}

