export type ProspectSourceKind =
  | "boss_score"
  | "boss_pro"
  | "sales_navigator"
  | "linkedin"
  | "bca"
  | "manual";

/** Stored on `contacts.prospect_source`. */
export type ProspectSourceValue = ProspectSourceKind | "ghl";

export const PROSPECT_SOURCE_CHART_STACK_ORDER: ProspectSourceKind[] = [
  "manual",
  "bca",
  "linkedin",
  "sales_navigator",
  "boss_score",
  "boss_pro",
];

export const PROSPECT_SOURCE_ACCENT: Record<ProspectSourceKind, string> = {
  boss_score: "#10b981",
  boss_pro: "#8b5cf6",
  sales_navigator: "#0284c7",
  linkedin: "#0ea5e9",
  bca: "#64748b",
  manual: "#94a3b8",
};

export function prospectSourceKindLabel(kind: ProspectSourceKind): string {
  switch (kind) {
    case "boss_score":
      return "BOSS Score";
    case "boss_pro":
      return "BOSS Pro";
    case "sales_navigator":
      return "Sales Navigator";
    case "linkedin":
      return "LinkedIn";
    case "bca":
      return "BCA";
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
    case "sales_navigator":
      return "bg-sky-600";
    case "linkedin":
      return "bg-sky-500";
    case "bca":
      return "bg-slate-500";
    case "manual":
      return "bg-slate-400";
  }
}

const SOURCE_VALUE_LABELS: Record<ProspectSourceValue, string> = {
  sales_navigator: "Sales Navigator",
  linkedin: "LinkedIn",
  manual: "Manual",
  boss_score: "BOSS Score",
  boss_pro: "BOSS Pro",
  bca: "BCA",
  ghl: "GoHighLevel",
};

function sourceValueToKind(value: string): ProspectSourceKind | null {
  if (value in SOURCE_VALUE_LABELS && value !== "ghl") {
    return value as ProspectSourceKind;
  }
  if (value === "ghl") return "manual";
  return null;
}

export function prospectSourceLabel(
  source: string | null | undefined
): string | null {
  const trimmed = source?.trim();
  if (!trimmed) return null;
  return SOURCE_VALUE_LABELS[trimmed as ProspectSourceValue] ?? trimmed;
}

export function resolveProspectSourceKind(prospect: {
  prospect_source?: string | null;
  prospect_funnel?: string | null;
  linkedin_url?: string | null;
}): ProspectSourceKind {
  const explicit = prospect.prospect_source?.trim();
  if (explicit) {
    const kind = sourceValueToKind(explicit);
    if (kind) return kind;
  }

  const funnel = prospect.prospect_funnel?.trim();
  if (funnel === "boss_scorecard") return "boss_score";
  if (funnel === "diagnostic_50") return "boss_pro";
  if (prospect.linkedin_url?.trim()) return "linkedin";
  return "manual";
}

/** Coach-facing label: explicit source when set, otherwise inferred kind. */
export function resolveProspectSourceLabel(prospect: {
  prospect_source?: string | null;
  prospect_funnel?: string | null;
  linkedin_url?: string | null;
}): string {
  const explicit = prospectSourceLabel(prospect.prospect_source);
  if (explicit) return explicit;
  return prospectSourceKindLabel(resolveProspectSourceKind(prospect));
}

export function emptyProspectSourceTotals(): Record<
  ProspectSourceKind,
  { count: number }
> {
  return {
    manual: { count: 0 },
    bca: { count: 0 },
    linkedin: { count: 0 },
    sales_navigator: { count: 0 },
    boss_score: { count: 0 },
    boss_pro: { count: 0 },
  };
}
