export const FUNNEL_STAGE_IDS = [
  "sentToConnected",
  "connectedToReplied",
  "repliedToInterested",
  "interestedToBooked",
  "bookedToShowed",
  "showedToClosed",
] as const;

export type FunnelStageId = (typeof FUNNEL_STAGE_IDS)[number];

export type FunnelCounts = {
  sent: number;
  connected: number;
  replied: number;
  interested: number;
  booked: number;
  showed: number;
  closed: number;
};

/** User-facing labels (internal key remains `sent`). */
export const FUNNEL_COUNT_DISPLAY_LABELS: Record<keyof FunnelCounts, string> = {
  sent: "Connection requests",
  connected: "Connected",
  replied: "Replied",
  interested: "Interested",
  booked: "Booked",
  showed: "Showed",
  closed: "Closed",
};

export type FunnelKpis = Record<FunnelStageId, number>;

export const FUNNEL_KPIS: FunnelKpis = {
  sentToConnected: 0.15,
  connectedToReplied: 0.2,
  repliedToInterested: 0.4,
  interestedToBooked: 0.5,
  bookedToShowed: 0.8,
  showedToClosed: 0.25,
};

/** Product of connection × reply × interest stage KPIs (15% × 20% × 40%). */
export const SENT_TO_INTERESTED_TARGET = 0.012;

/** Interested → client (for every 10 interested, 1 closed). */
export const INTERESTED_TO_CLOSED_TARGET = 0.1;

/** Sent → Closed: one client per 750 sends (750:1). */
export const SENT_TO_CLOSED_TARGET = 1 / 750;

/** End of Sent → Closed dial scale (not the KPI line); dial reads in % of sends. */
export const DIAL_MAX_SENT_TO_CLOSED = 0.005;

/** End of speed-dial scale (not the KPI line). */
export const DIAL_MAX_SENT_TO_INTERESTED = 0.04;

/** End of speed-dial scale for Interested → Closed dial. */
export const DIAL_MAX_INTERESTED_TO_CLOSED = 0.4;

export const FUNNEL_STAGE_LABELS: Record<FunnelStageId, string> = {
  sentToConnected: "Connection requests → Connected",
  connectedToReplied: "Connected → Replied",
  repliedToInterested: "Replied → Interested",
  interestedToBooked: "Interested → Booked calls",
  bookedToShowed: "Booked calls → Showed",
  showedToClosed: "Showed → Closed",
};

export type FunnelStageDefinition = {
  id: FunnelStageId;
  numeratorKey: keyof FunnelCounts;
  denominatorKey: keyof FunnelCounts;
};

export const FUNNEL_STAGES: readonly FunnelStageDefinition[] = [
  { id: "sentToConnected", numeratorKey: "connected", denominatorKey: "sent" },
  {
    id: "connectedToReplied",
    numeratorKey: "replied",
    denominatorKey: "connected",
  },
  {
    id: "repliedToInterested",
    numeratorKey: "interested",
    denominatorKey: "replied",
  },
  {
    id: "interestedToBooked",
    numeratorKey: "booked",
    denominatorKey: "interested",
  },
  { id: "bookedToShowed", numeratorKey: "showed", denominatorKey: "booked" },
  { id: "showedToClosed", numeratorKey: "closed", denominatorKey: "showed" },
];

