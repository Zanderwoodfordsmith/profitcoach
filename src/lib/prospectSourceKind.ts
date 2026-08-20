export type ProspectSourceKind =
  | "boss_score"
  | "boss_pro"
  | "linkedin"
  | "manual";

export const PROSPECT_SOURCE_CHART_STACK_ORDER: ProspectSourceKind[] = [
  "manual",
  "linkedin",
  "boss_score",
  "boss_pro",
];

export const PROSPECT_SOURCE_ACCENT: Record<ProspectSourceKind, string> = {
  boss_score: "#10b981",
  boss_pro: "#8b5cf6",
  linkedin: "#0ea5e9",
  manual: "#94a3b8",
};

export function prospectSourceKindLabel(kind: ProspectSourceKind): string {
  switch (kind) {
    case "boss_score":
      return "BOSS Score";
    case "boss_pro":
      return "BOSS Pro";
    case "linkedin":
      return "LinkedIn";
    case "manual":
      return "Manual";
  }
}

export function prospectSourceKindChartClass(kind: ProspectSourceKind): string {
  switch (kind) {
    case "boss_score":
      return "bg-emerald-500";
    case "boss_pro":
      return "bg-violet-500";
    case "linkedin":
      return "bg-sky-500";
    case "manual":
      return "bg-slate-400";
  }
}

export function resolveProspectSourceKind(prospect: {
  prospect_funnel?: string | null;
  linkedin_url?: string | null;
}): ProspectSourceKind {
  const funnel = prospect.prospect_funnel?.trim();
  if (funnel === "boss_scorecard") return "boss_score";
  if (funnel === "diagnostic_50") return "boss_pro";
  if (prospect.linkedin_url?.trim()) return "linkedin";
  return "manual";
}

export function emptyProspectSourceTotals(): Record<
  ProspectSourceKind,
  { count: number }
> {
  return {
    manual: { count: 0 },
    linkedin: { count: 0 },
    boss_score: { count: 0 },
    boss_pro: { count: 0 },
  };
}
