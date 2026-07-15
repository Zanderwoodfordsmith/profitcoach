export const COACH_ACCESS_TIERS = [
  "alumni",
  "programme",
  "core",
  "premium",
  "vip",
  "early_exit",
  "do_not_contact",
] as const;

export type CoachAccessTier = (typeof COACH_ACCESS_TIERS)[number];

export const COACH_ACCESS_TIER_LABELS: Record<CoachAccessTier, string> = {
  alumni: "Alumni",
  programme: "Programme",
  core: "Core",
  premium: "Premium",
  vip: "VIP",
  early_exit: "Early exit",
  do_not_contact: "Do not contact",
};

/** Tiers that can be selected for community calendar event visibility. */
export const CALENDAR_EVENT_ACCESS_TAG_TIERS: CoachAccessTier[] = [
  "alumni",
  "core",
  "premium",
  "vip",
];

export type CoachFeature =
  | "community.feed"
  | "community.feedback_channel"
  | "calendar.momentum_only"
  | "calendar.all_events"
  | "nav.compass"
  | "nav.classroom"
  | "classroom.full"
  | "nav.marketing"
  | "nav.delivery"
  | "directory.featured";

const PREMIUM_FEATURE_SET: ReadonlySet<CoachFeature> = new Set([
  "community.feed",
  "community.feedback_channel",
  "calendar.momentum_only",
  "calendar.all_events",
  "nav.compass",
  "nav.classroom",
  "classroom.full",
  "nav.marketing",
  "nav.delivery",
]);

const TIER_FEATURES: Record<CoachAccessTier, ReadonlySet<CoachFeature>> = {
  do_not_contact: new Set(),
  // Love-it-or-leave-it / guarantee opt-out — no product access; not alumni.
  early_exit: new Set(),
  alumni: new Set([
    // Classroom nav is visible, but only a few starter courses are unlocked
    // (see ALUMNI_FREE_COURSE_IDS). No live ecosystem access.
    "nav.classroom",
  ]),
  programme: PREMIUM_FEATURE_SET,
  core: new Set([
    "community.feed",
    "nav.classroom",
    "classroom.full",
    "nav.delivery",
    "calendar.momentum_only",
  ]),
  premium: PREMIUM_FEATURE_SET,
  vip: new Set([
    ...PREMIUM_FEATURE_SET,
    "directory.featured",
  ]),
};

/** Full Premium access — used when tier enforcement is disabled. */
export const PREMIUM_EQUIVALENT_FEATURES: CoachFeature[] = [
  "community.feed",
  "community.feedback_channel",
  "calendar.momentum_only",
  "calendar.all_events",
  "nav.compass",
  "nav.classroom",
  "classroom.full",
  "nav.marketing",
  "nav.delivery",
];

export function isCoachAccessTier(value: string): value is CoachAccessTier {
  return (COACH_ACCESS_TIERS as readonly string[]).includes(value);
}

const ACCESS_TIER_ALIASES: Record<string, CoachAccessTier> = {
  pro: "premium",
  build: "programme",
  program: "programme",
  earlyexit: "early_exit",
};

/** Normalize legacy/variant access tier strings from the DB or admin UI. */
export function normalizeCoachAccessTier(
  value: unknown
): CoachAccessTier | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/-/g, "_").replace(/\s+/g, "_");
  const mapped = ACCESS_TIER_ALIASES[normalized] ?? normalized;
  return isCoachAccessTier(mapped) ? mapped : null;
}

export function tierHasFeature(
  tier: CoachAccessTier,
  feature: CoachFeature
): boolean {
  return TIER_FEATURES[tier].has(feature);
}

export function featuresForTier(tier: CoachAccessTier): CoachFeature[] {
  return [...TIER_FEATURES[tier]];
}

/** Lowest paid/product tier that includes the feature (skips programme). */
export function minimumTierForFeature(
  feature: CoachFeature
): CoachAccessTier | null {
  const ordered = [...COACH_ACCESS_TIERS]
    .filter(
      (tier) =>
        tier !== "programme" &&
        tier !== "do_not_contact" &&
        tier !== "early_exit"
    )
    .sort((a, b) => tierRank(a) - tierRank(b));
  return ordered.find((tier) => TIER_FEATURES[tier].has(feature)) ?? null;
}

/** Treat programme coaches as Premium for tag-based visibility. */
export function effectiveCalendarAccessTier(
  tier: CoachAccessTier
): CoachAccessTier {
  return tier === "programme" ? "premium" : tier;
}

export function calendarEventVisibleToTier(
  accessTags: string[] | null | undefined,
  tier: CoachAccessTier
): boolean {
  const tags = accessTags ?? ["core", "premium", "vip"];
  return tags.includes(effectiveCalendarAccessTier(tier));
}

export function calendarEventLockedForTier(
  accessTags: string[] | null | undefined,
  tier: CoachAccessTier
): boolean {
  if (tierHasFeature(tier, "calendar.all_events")) return false;
  if (!tierHasFeature(tier, "calendar.momentum_only")) return true;
  return !calendarEventVisibleToTier(accessTags, tier);
}

export const ALL_CALENDAR_ACCESS_TAGS: CoachAccessTier[] = [
  "core",
  "premium",
  "vip",
];

export const FEEDBACK_REQUEST_CATEGORY_SLUG = "requesting-feedback";

export function tierRank(tier: CoachAccessTier): number {
  const order: Record<CoachAccessTier, number> = {
    do_not_contact: -1,
    early_exit: -1,
    alumni: 0,
    core: 1,
    programme: 2,
    premium: 2,
    vip: 3,
  };
  return order[tier];
}

/** First 6 months build phase (not a paid Stripe membership). */
export function isProgrammeTier(tier: CoachAccessTier): boolean {
  return tier === "programme";
}

export function isDoNotContactTier(tier: CoachAccessTier): boolean {
  return tier === "do_not_contact";
}

export function isEarlyExitTier(tier: CoachAccessTier): boolean {
  return tier === "early_exit";
}

/** Manual relationship tiers that auto-refresh / Stripe sync must not overwrite. */
export function isManuallyPreservedAccessTier(tier: CoachAccessTier): boolean {
  return tier === "do_not_contact" || tier === "early_exit";
}

export function minimumTierForCalendarEvent(
  accessTags: string[] | null | undefined
): CoachAccessTier {
  const tags = accessTags ?? ["core", "premium", "vip"];
  if (tags.includes("core")) return "core";
  if (tags.includes("premium")) return "premium";
  return "vip";
}
