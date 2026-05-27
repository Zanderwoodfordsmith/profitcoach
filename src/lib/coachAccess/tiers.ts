export const COACH_ACCESS_TIERS = ["alumni", "pro", "premium"] as const;

export type CoachAccessTier = (typeof COACH_ACCESS_TIERS)[number];

export const COACH_ACCESS_TIER_LABELS: Record<CoachAccessTier, string> = {
  alumni: "Alumni",
  pro: "Pro",
  premium: "Premium",
};

export type CoachFeature =
  | "community.feed"
  | "community.feedback_channel"
  | "calendar.all_events"
  | "nav.compass"
  | "nav.classroom"
  | "nav.marketing"
  | "nav.delivery";

const TIER_FEATURES: Record<CoachAccessTier, ReadonlySet<CoachFeature>> = {
  alumni: new Set([
    "community.feed",
    // calendar.all_events off — alumni see only events tagged for their tier via access_tags
  ]),
  pro: new Set([
    "community.feed",
    "community.feedback_channel",
    "calendar.all_events",
    "nav.compass",
    "nav.classroom",
    "nav.marketing",
    "nav.delivery",
  ]),
  premium: new Set([
    "community.feed",
    "community.feedback_channel",
    "calendar.all_events",
    "nav.compass",
    "nav.classroom",
    "nav.marketing",
    "nav.delivery",
  ]),
};

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
  const tags = accessTags ?? ["alumni", "pro", "premium"];
  return tags.includes(tier);
}

export const ALL_CALENDAR_ACCESS_TAGS: CoachAccessTier[] = [
  "alumni",
  "pro",
  "premium",
];

export const FEEDBACK_REQUEST_CATEGORY_SLUG = "requesting-feedback";
