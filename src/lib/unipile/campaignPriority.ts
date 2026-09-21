export const CAMPAIGN_PRIORITY_LEVELS = ["low", "medium", "high"] as const;
export type CampaignPriorityLevel = (typeof CAMPAIGN_PRIORITY_LEVELS)[number];

export const CAMPAIGN_PRIORITY = {
  high: { outreach_priority: 1, outreach_weight: 3 },
  medium: { outreach_priority: 50, outreach_weight: 2 },
  low: { outreach_priority: 100, outreach_weight: 1 },
} as const satisfies Record<
  CampaignPriorityLevel,
  { outreach_priority: number; outreach_weight: number }
>;

export function campaignPriorityValues(level: CampaignPriorityLevel) {
  return CAMPAIGN_PRIORITY[level];
}

/**
 * Map stored numeric priority/weight (including legacy independent sliders)
 * onto the three-level control. Lower `outreach_priority` still runs first;
 * `outreach_weight` is the invite-budget share.
 */
export function campaignPriorityLevelFromStored(
  priority: number | null | undefined,
  weight: number | null | undefined
): CampaignPriorityLevel {
  if (priority == null && weight == null) return "medium";
  const p = Number(priority ?? CAMPAIGN_PRIORITY.medium.outreach_priority);
  const w = Number(weight ?? CAMPAIGN_PRIORITY.medium.outreach_weight);

  for (const level of CAMPAIGN_PRIORITY_LEVELS) {
    const stored = CAMPAIGN_PRIORITY[level];
    if (p === stored.outreach_priority && w === stored.outreach_weight) {
      return level;
    }
  }

  if (w >= 3) return "high";
  if (w <= 1 && p >= 67) return "low";
  if (w <= 1 && p <= 33) return "high";
  return "medium";
}
