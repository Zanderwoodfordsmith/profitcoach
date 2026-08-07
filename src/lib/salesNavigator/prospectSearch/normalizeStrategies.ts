import type {
  NamingPattern,
  ProspectSearchStrategiesResult,
  ProspectSearchStrategy,
  StrategyKind,
} from "@/lib/salesNavigator/prospectSearch/types";

const NAMING_PATTERNS = new Set<NamingPattern>([
  "name_rich",
  "category_rich",
  "name_poor",
  "mixed",
]);

const KINDS = new Set<StrategyKind>([
  "company_name",
  "category_name",
  "keywords",
  "beyond_linkedin",
]);

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    const s = asString(item);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function asNamingPattern(v: unknown, fallback: NamingPattern): NamingPattern {
  const s = asString(v) as NamingPattern;
  return NAMING_PATTERNS.has(s) ? s : fallback;
}

function asKind(v: unknown): StrategyKind | null {
  const s = asString(v) as StrategyKind;
  return KINDS.has(s) ? s : null;
}

function normalizeStrategy(
  raw: unknown,
  index: number,
  fallbackPattern: NamingPattern
): ProspectSearchStrategy | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind = asKind(o.kind);
  if (!kind) return null;

  const filtersRaw =
    o.filters && typeof o.filters === "object"
      ? (o.filters as Record<string, unknown>)
      : {};

  let companyIncludes = asStringArray(filtersRaw.companyIncludes);
  let keywordsBoolean = asString(filtersRaw.keywordsBoolean) || null;
  const companyExcludesExtra = asStringArray(filtersRaw.companyExcludesExtra);
  const titleIncludesExtra = asStringArray(filtersRaw.titleIncludesExtra);

  if (kind === "keywords") {
    companyIncludes = [];
    if (!keywordsBoolean) return null;
  } else if (kind === "beyond_linkedin") {
    companyIncludes = [];
    keywordsBoolean = null;
  } else {
    // company_name / category_name
    keywordsBoolean = null;
    if (companyIncludes.length === 0) return null;
  }

  const priority =
    typeof o.priority === "number" && Number.isFinite(o.priority)
      ? Math.max(1, Math.round(o.priority))
      : index + 1;

  const id = asString(o.id) || `${kind}-${priority}`;

  return {
    id,
    priority,
    kind,
    label: asString(o.label) || kind.replace(/_/g, " "),
    rationale: asString(o.rationale),
    namingPattern: asNamingPattern(o.namingPattern, fallbackPattern),
    qualityTarget:
      asString(o.qualityTarget) ||
      (kind === "keywords"
        ? "~40–50% keepers"
        : kind === "beyond_linkedin"
          ? "manual / alternate source"
          : "~8/10 spot-check"),
    tryWhen: asString(o.tryWhen),
    nextIf: asString(o.nextIf),
    filters: {
      companyIncludes,
      companyExcludesExtra,
      keywordsBoolean,
      titleIncludesExtra,
    },
    tips: asStringArray(o.tips).slice(0, 6),
  };
}

export function normalizeProspectSearchStrategies(
  raw: unknown,
  fallbackIndustry: string
): ProspectSearchStrategiesResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const namingPattern = asNamingPattern(o.namingPattern, "mixed");
  const strategiesRaw = Array.isArray(o.strategies) ? o.strategies : [];
  const strategies = strategiesRaw
    .map((s, i) => normalizeStrategy(s, i, namingPattern))
    .filter((s): s is ProspectSearchStrategy => s != null)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4);

  if (strategies.length === 0) return null;

  // Re-number priorities after sort/filter
  strategies.forEach((s, i) => {
    s.priority = i + 1;
  });

  return {
    industry: asString(o.industry) || fallbackIndustry.trim(),
    namingPattern,
    namingPatternRationale: asString(o.namingPatternRationale),
    strategies,
    sampleProfilesNeeded: Boolean(o.sampleProfilesNeeded),
    coachFacingSummary: asString(o.coachFacingSummary),
  };
}
