export type LandingEventType = "view" | "start" | "opt_in" | "finish";

export type LandingVariant = "a" | "b" | "c" | "d";

export const LANDING_VARIANTS: LandingVariant[] = ["a", "b", "c", "d"];

export const LANDING_VARIANT_LABELS: Record<LandingVariant, string> = {
  a: "A — Static opt-in",
  b: "B — Alt headline (same layout as D)",
  c: "C — Dashboard hero (stacked)",
  d: "D — Main landing (/score)",
};

export const LANDING_VARIANT_PATHS: Record<LandingVariant, string> = {
  a: "/landing/a",
  b: "/landing/b",
  c: "/landing/c",
  d: "/landing/d",
};

/** Analytics bucket for /score and /landing with no ?coach= slug (Profit Coach brand). */
export const LANDING_BRAND_COACH_KEY = "__brand__";

export function landingAnalyticsCoachKey(coachSlug: string | null | undefined): string {
  const slug = coachSlug?.trim();
  return slug ? slug : LANDING_BRAND_COACH_KEY;
}

export function resolveLandingTrackCoachSlug(
  searchParams: URLSearchParams,
  options?: { fromLanding?: boolean; fallbackCoachSlug?: string | null }
): string | null {
  if (searchParams.get("landing_brand") === "1") return null;
  if (searchParams.has("landing_coach_slug")) {
    return searchParams.get("landing_coach_slug")?.trim() || null;
  }
  if (options?.fromLanding && options.fallbackCoachSlug?.trim()) {
    return options.fallbackCoachSlug.trim();
  }
  return null;
}

export type LandingVariantStats = {
  views: number;
  uniqueViews: number;
  started: number;
  opt_in: number;
  finish: number;
};

export type LandingEventRow = {
  variant: string;
  coach_slug: string | null;
  event_type: string;
  session_id: string | null;
};

export type LandingCoachLabel = {
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
};

export type LandingAnalyticsResult = {
  totals: {
    totalViews: number;
    uniqueViews: number;
    started: number;
    optIns: number;
    finished: number;
  };
  byVariant: Record<LandingVariant, LandingVariantStats>;
  byCoach: Record<string, LandingVariantStats>;
  byCoachByVariant: Record<string, Partial<Record<LandingVariant, LandingVariantStats>>>;
};

export function emptyVariantStats(): LandingVariantStats {
  return {
    views: 0,
    uniqueViews: 0,
    started: 0,
    opt_in: 0,
    finish: 0,
  };
}

function isLandingVariant(value: string): value is LandingVariant {
  return LANDING_VARIANTS.includes(value as LandingVariant);
}

function accumulateEvent(
  stats: LandingVariantStats,
  event: LandingEventRow,
  sessionSet: Set<string>
) {
  if (event.event_type === "view") {
    stats.views += 1;
    if (event.session_id) sessionSet.add(event.session_id);
    stats.uniqueViews = sessionSet.size;
    return;
  }
  if (event.event_type === "start") stats.started += 1;
  else if (event.event_type === "opt_in") stats.opt_in += 1;
  else if (event.event_type === "finish") stats.finish += 1;
}

export function computeLandingAnalytics(events: LandingEventRow[]): LandingAnalyticsResult {
  const byVariant = Object.fromEntries(
    LANDING_VARIANTS.map((v) => [v, emptyVariantStats()])
  ) as Record<LandingVariant, LandingVariantStats>;

  const sessionByVariant = Object.fromEntries(
    LANDING_VARIANTS.map((v) => [v, new Set<string>()])
  ) as Record<LandingVariant, Set<string>>;

  const byCoach: Record<string, LandingVariantStats> = {};
  const byCoachByVariant: Record<
    string,
    Partial<Record<LandingVariant, LandingVariantStats>>
  > = {};
  const sessionByCoach = new Map<string, Set<string>>();
  const sessionByCoachVariant = new Map<string, Map<LandingVariant, Set<string>>>();

  for (const event of events) {
    const coachKey = landingAnalyticsCoachKey(event.coach_slug);
    if (!byCoach[coachKey]) byCoach[coachKey] = emptyVariantStats();
    if (!sessionByCoach.has(coachKey)) sessionByCoach.set(coachKey, new Set());
    const coachSessions = sessionByCoach.get(coachKey)!;

    accumulateEvent(byCoach[coachKey], event, coachSessions);

    if (isLandingVariant(event.variant)) {
      accumulateEvent(
        byVariant[event.variant],
        event,
        sessionByVariant[event.variant]
      );

      if (!byCoachByVariant[coachKey]) byCoachByVariant[coachKey] = {};
      if (!byCoachByVariant[coachKey][event.variant]) {
        byCoachByVariant[coachKey][event.variant] = emptyVariantStats();
      }
      if (!sessionByCoachVariant.has(coachKey)) {
        sessionByCoachVariant.set(coachKey, new Map());
      }
      const coachVariantSessions = sessionByCoachVariant.get(coachKey)!;
      if (!coachVariantSessions.has(event.variant)) {
        coachVariantSessions.set(event.variant, new Set());
      }
      accumulateEvent(
        byCoachByVariant[coachKey][event.variant]!,
        event,
        coachVariantSessions.get(event.variant)!
      );
    }
  }

  const totalViews = events.filter((e) => e.event_type === "view").length;
  const uniqueSessions = new Set(
    events
      .filter((e) => e.event_type === "view" && e.session_id)
      .map((e) => e.session_id)
  );

  return {
    totals: {
      totalViews,
      uniqueViews: uniqueSessions.size,
      started: events.filter((e) => e.event_type === "start").length,
      optIns: events.filter((e) => e.event_type === "opt_in").length,
      finished: events.filter((e) => e.event_type === "finish").length,
    },
    byVariant,
    byCoach,
    byCoachByVariant,
  };
}

export function landingConversionRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

export function formatLandingRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function coachDisplayName(
  slug: string,
  labels: Record<string, LandingCoachLabel>
): string {
  if (slug === LANDING_BRAND_COACH_KEY) return "Profit Coach (brand)";
  const row = labels[slug];
  if (!row) return slug;
  return (
    row.full_name?.trim() ||
    row.coach_business_name?.trim() ||
    slug
  );
}

export function variantHasActivity(stats: LandingVariantStats): boolean {
  return (
    stats.views > 0 ||
    stats.uniqueViews > 0 ||
    stats.started > 0 ||
    stats.opt_in > 0 ||
    stats.finish > 0
  );
}

export function activeLandingVariants(
  byVariant: Record<LandingVariant, LandingVariantStats>
): LandingVariant[] {
  return LANDING_VARIANTS.filter((v) => variantHasActivity(byVariant[v]));
}
