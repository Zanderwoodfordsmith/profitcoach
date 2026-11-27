/**
 * Where a coach is with someone on LinkedIn (jobs 300 and 301). One status per
 * person in Lead Lists: the furthest they have got across every campaign, plus
 * LinkedIn's own connections list. Each status keeps the date it started, so
 * Lead Lists can say "Connected for more than 90 days".
 */

export const POOL_OUTREACH_STATUSES = [
  "none",
  "invited",
  "connected",
  "replied",
  "interested",
  "booked",
] as const;

export type PoolOutreachStatus = (typeof POOL_OUTREACH_STATUSES)[number];

export const POOL_OUTREACH_STATUS_OPTIONS: Array<{
  key: PoolOutreachStatus;
  label: string;
  hint: string;
}> = [
  { key: "none", label: "Not contacted", hint: "No invite or message yet" },
  { key: "invited", label: "Invited", hint: "Invite sent, not accepted yet" },
  { key: "connected", label: "Connected", hint: "Connected on LinkedIn, no reply yet" },
  { key: "replied", label: "Replied", hint: "They wrote back" },
  { key: "interested", label: "Interested", hint: "Marked as interested" },
  { key: "booked", label: "Booked", hint: "Booked a call" },
];

export function isPoolOutreachStatus(value: unknown): value is PoolOutreachStatus {
  return (
    typeof value === "string" &&
    (POOL_OUTREACH_STATUSES as readonly string[]).includes(value)
  );
}

export function poolOutreachStatusLabel(status: PoolOutreachStatus): string {
  return POOL_OUTREACH_STATUS_OPTIONS.find((option) => option.key === status)?.label ?? "Not contacted";
}

const RANK: Record<PoolOutreachStatus, number> = {
  none: 0,
  invited: 1,
  connected: 2,
  replied: 3,
  interested: 4,
  booked: 5,
};

export type OutreachState = {
  status: PoolOutreachStatus;
  /** When this status started. Null when we don't know. */
  at: string | null;
};

export const NO_OUTREACH: OutreachState = { status: "none", at: null };

function earlier(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) <= Date.parse(b) ? a : b;
}

/** The further of two states. Same status: the earlier date. */
export function mergeOutreach(a: OutreachState, b: OutreachState): OutreachState {
  if (RANK[b.status] > RANK[a.status]) return b;
  if (RANK[b.status] < RANK[a.status]) return a;
  return { status: a.status, at: earlier(a.at, b.at) };
}

const INTERESTED_LEAD_STATUSES = new Set([
  "interested",
  "assessment_sent",
  "assessment_done",
  "call_offered",
]);

/** One campaign lead's state from its status and step dates. */
export function outreachFromCampaignLead(lead: {
  status: string | null;
  invited_at?: string | null;
  connected_at?: string | null;
  replied_at?: string | null;
  interest_logged_at?: string | null;
}): OutreachState {
  const status = lead.status ?? "";
  if (INTERESTED_LEAD_STATUSES.has(status)) {
    return {
      status: "interested",
      at: lead.interest_logged_at ?? lead.replied_at ?? null,
    };
  }
  if (status === "replied") return { status: "replied", at: lead.replied_at ?? null };
  // Steps after accepting (in_sequence, completed) overwrite "connected", so
  // the connection date is the lasting sign.
  if (status === "connected" || lead.connected_at) {
    return { status: "connected", at: lead.connected_at ?? null };
  }
  if (status === "invited") return { status: "invited", at: lead.invited_at ?? null };
  return NO_OUTREACH;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days since a status started, or null when the date is unknown. */
export function outreachDaysSince(at: string | null | undefined, now = Date.now()): number | null {
  if (!at) return null;
  const t = Date.parse(at);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / DAY_MS));
}

/** "Connected · 3 months" style age for the table, or "" when unknown. */
export function outreachAgeLabel(at: string | null | undefined, now = Date.now()): string {
  const days = outreachDaysSince(at, now);
  if (days == null) return "";
  if (days < 1) return "today";
  if (days < 14) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 60) return `${Math.floor(days / 7)} weeks`;
  if (days < 730) return `${Math.floor(days / 30)} months`;
  return `${Math.floor(days / 365)} years`;
}

/** LinkedIn profile slug from a normalised /in/ URL, lower case. */
export function linkedInSlugFromUrl(url: string | null | undefined): string | null {
  const match = url?.match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]).trim().toLowerCase() || null;
  } catch {
    return match[1].trim().toLowerCase() || null;
  }
}
