export const COACH_ACCESS_TIERS = [
  "alumni",
  "core",
  "premium",
  "vip",
  "do_not_contact",
] as const;

export type CoachAccessTier = (typeof COACH_ACCESS_TIERS)[number];

export const COACH_ACCESS_TIER_LABELS: Record<CoachAccessTier, string> = {
  alumni: "Alumni",
  core: "Core",
  premium: "Premium",
  vip: "VIP",
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

const TIER_FEATURES: Record<CoachAccessTier, ReadonlySet<CoachFeature>> = {
  do_not_contact: new Set(),
  alumni: new Set([
    // Classroom nav is visible, but only a few starter courses are unlocked
    // (see ALUMNI_FREE_COURSE_IDS). No live ecosystem access.
    "nav.classroom",
  ]),
  core: new Set([
    "community.feed",
    "nav.classroom",
    "classroom.full",
    "nav.delivery",
    "calendar.momentum_only",
  ]),
  premium: new Set([
    "community.feed",
    "community.feedback_channel",
    "calendar.momentum_only",
    "calendar.all_events",
    "nav.compass",
    "nav.classroom",
    "classroom.full",
    "nav.marketing",
    "nav.delivery",
  ]),
  vip: new Set([
    "community.feed",
    "community.feedback_channel",
    "calendar.momentum_only",
    "calendar.all_events",
    "nav.compass",
    "nav.classroom",
    "classroom.full",
    "nav.marketing",
    "nav.delivery",
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

/** Lowest tier (by rank) that includes the feature, or null if none do. */
export function minimumTierForFeature(
  feature: CoachFeature
): CoachAccessTier | null {
  const ordered = [...COACH_ACCESS_TIERS].sort(
    (a, b) => tierRank(a) - tierRank(b)
  );
  return ordered.find((tier) => TIER_FEATURES[tier].has(feature)) ?? null;
}

export function calendarEventVisibleToTier(
  accessTags: string[] | null | undefined,
  tier: CoachAccessTier
): boolean {
  const tags = accessTags ?? ["core", "premium", "vip"];
  return tags.includes(tier);
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
    alumni: 0,
    core: 1,
    premium: 2,
    vip: 3,
  };
  return order[tier];
}

export function isDoNotContactTier(tier: CoachAccessTier): boolean {
  return tier === "do_not_contact";
}

export function minimumTierForCalendarEvent(
  accessTags: string[] | null | undefined
): CoachAccessTier {
  const tags = accessTags ?? ["core", "premium", "vip"];
  if (tags.includes("core")) return "core";
  if (tags.includes("premium")) return "premium";
  return "vip";
}
