export const COACH_ACCESS_TIERS = ["alumni", "core", "premium", "vip"] as const;

export type CoachAccessTier = (typeof COACH_ACCESS_TIERS)[number];

export const COACH_ACCESS_TIER_LABELS: Record<CoachAccessTier, string> = {
  alumni: "Alumni",
  core: "Core",
  premium: "Premium",
  vip: "VIP",
};

export type CoachFeature =
  | "community.feed"
  | "community.feedback_channel"
  | "calendar.momentum_only"
  | "calendar.all_events"
  | "nav.compass"
  | "nav.classroom"
  | "nav.marketing"
  | "nav.delivery"
  | "directory.featured";

const TIER_FEATURES: Record<CoachAccessTier, ReadonlySet<CoachFeature>> = {
  alumni: new Set([
    // Certification / reference training only — no live ecosystem access.
    "nav.classroom",
  ]),
  core: new Set([
    "community.feed",
    "nav.classroom",
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
  "nav.marketing",
  "nav.delivery",
];

export function isCoachAccessTier(value: string): value is CoachAccessTier {
  return (COACH_ACCESS_TIERS as readonly string[]).includes(value);
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
    alumni: 0,
    core: 1,
    premium: 2,
    vip: 3,
  };
  return order[tier];
}

export function minimumTierForCalendarEvent(
  accessTags: string[] | null | undefined
): CoachAccessTier {
  const tags = accessTags ?? ["core", "premium", "vip"];
  if (tags.includes("core")) return "core";
  if (tags.includes("premium")) return "premium";
  return "vip";
}
