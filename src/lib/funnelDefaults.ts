import type { FunnelCounts } from "@/lib/funnelKpis";

/** Baseline counts: 750 sent, then 125…1 so downstream steps match KPIs (see README / funnelKpis). */
export const DEFAULT_FUNNEL_COUNTS: FunnelCounts = {
  sent: 750,
  connected: 125,
  replied: 25,
  interested: 10,
  booked: 5,
  showed: 4,
  closed: 1,
};

export const DEFAULT_FUNNEL_INPUTS: Record<keyof FunnelCounts, string> = {
  sent: String(DEFAULT_FUNNEL_COUNTS.sent),
  connected: String(DEFAULT_FUNNEL_COUNTS.connected),
  replied: String(DEFAULT_FUNNEL_COUNTS.replied),
  interested: String(DEFAULT_FUNNEL_COUNTS.interested),
  booked: String(DEFAULT_FUNNEL_COUNTS.booked),
  showed: String(DEFAULT_FUNNEL_COUNTS.showed),
  closed: String(DEFAULT_FUNNEL_COUNTS.closed),
};
