import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const ACTIVITY_DAY_RANGES = [90, 180, 365] as const;
export type ActivityDayRange = (typeof ACTIVITY_DAY_RANGES)[number];

export const ACTIVITY_LAYERS = [
  "all",
  "invite",
  "message",
  "email",
  "engagement",
] as const;
export type ActivityLayer = (typeof ACTIVITY_LAYERS)[number];

export type ActivityDayCounts = {
  date: string;
  invite: number;
  message: number;
  email: number;
  engagement: number;
  total: number;
};

export type ActivityHeatmapPayload = {
  days: ActivityDayRange;
  timezone: "UTC";
  buckets: ActivityDayCounts[];
  totals: Omit<ActivityDayCounts, "date">;
};

function utcDayKey(iso: string): string | null {
  const parsed = Date.parse(iso.includes("T") ? iso : `${iso}T12:00:00.000Z`);
  if (Number.isNaN(parsed)) return null;
  const d = new Date(parsed);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function todayUtcDayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function addDaysToKey(key: string, delta: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const d = new Date(Date.UTC(year!, month! - 1, day! + delta));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function emptyCounts(): Omit<ActivityDayCounts, "date"> {
  return { invite: 0, message: 0, email: 0, engagement: 0, total: 0 };
}

function bump(
  map: Map<string, Omit<ActivityDayCounts, "date">>,
  day: string,
  field: "invite" | "message" | "email" | "engagement",
  n = 1
) {
  const row = map.get(day) ?? emptyCounts();
  row[field] += n;
  row.total = row.invite + row.message + row.email + row.engagement;
  map.set(day, row);
}

export function parseActivityDays(raw: string | null): ActivityDayRange {
  const n = Number(raw);
  if (n === 180 || n === 365) return n;
  return 90;
}

/**
 * Daily outbound effort for the campaigns activity heatmap.
 *
 * - invites / sequence messages / soft-touch: linkedin_send_jobs (succeeded)
 * - emails: messaging_messages outbound email
 *
 * LinkedIn DMs from messaging_messages are omitted so synced campaign
 * messages are not double-counted with send_jobs.
 */
export async function loadActivityHeatmap(
  coachId: string,
  days: ActivityDayRange
): Promise<ActivityHeatmapPayload> {
  const end = todayUtcDayKey();
  const start = addDaysToKey(end, -(days - 1));
  const sinceIso = `${start}T00:00:00.000Z`;

  const byDay = new Map<string, Omit<ActivityDayCounts, "date">>();

  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .select("updated_at, linkedin_campaign_steps(step_type)")
    .eq("coach_id", coachId)
    .eq("status", "succeeded")
    .gte("updated_at", sinceIso);

  if (jobsError) {
    throw new Error(jobsError.message || "Could not load send jobs.");
  }

  for (const row of jobs ?? []) {
    const day = utcDayKey(String(row.updated_at || ""));
    if (!day || day < start || day > end) continue;
    const step = row.linkedin_campaign_steps as
      | { step_type?: string }
      | { step_type?: string }[]
      | null;
    const stepType = Array.isArray(step)
      ? step[0]?.step_type
      : step?.step_type;
    if (stepType === "invite") bump(byDay, day, "invite");
    else if (stepType === "message") bump(byDay, day, "message");
    else if (stepType === "comment" || stepType === "react") {
      bump(byDay, day, "engagement");
    }
  }

  const { data: emails, error: emailError } = await supabaseAdmin
    .from("messaging_messages")
    .select("created_at")
    .eq("coach_id", coachId)
    .eq("direction", "outbound")
    .eq("channel", "email")
    .gte("created_at", sinceIso);

  if (emailError) {
    throw new Error(emailError.message || "Could not load emails.");
  }

  for (const row of emails ?? []) {
    const day = utcDayKey(String(row.created_at || ""));
    if (!day || day < start || day > end) continue;
    bump(byDay, day, "email");
  }

  const buckets: ActivityDayCounts[] = [];
  const totals = emptyCounts();
  let cur = start;
  while (cur <= end) {
    const counts = byDay.get(cur) ?? emptyCounts();
    buckets.push({ date: cur, ...counts });
    totals.invite += counts.invite;
    totals.message += counts.message;
    totals.email += counts.email;
    totals.engagement += counts.engagement;
    totals.total += counts.total;
    const next = addDaysToKey(cur, 1);
    if (next <= cur) break;
    cur = next;
  }

  return { days, timezone: "UTC", buckets, totals };
}

/**
 * Daily outbound activity for one campaign.
 * Invites / messages / engagement from succeeded send jobs.
 * Accepts from leads that progressed past invite (bucketed by updated_at).
 */
export async function loadCampaignActivity(
  coachId: string,
  campaignId: string,
  days = 14
): Promise<{
  days: number;
  timezone: "UTC";
  buckets: Array<{
    date: string;
    invite: number;
    accepted: number;
    message: number;
    engagement: number;
    total: number;
  }>;
  totals: {
    invite: number;
    accepted: number;
    message: number;
    engagement: number;
    total: number;
  };
}> {
  const clamped = Math.min(90, Math.max(7, Math.floor(days)));
  const end = todayUtcDayKey();
  const start = addDaysToKey(end, -(clamped - 1));
  const sinceIso = `${start}T00:00:00.000Z`;

  type DayRow = {
    invite: number;
    accepted: number;
    message: number;
    engagement: number;
    total: number;
  };
  const empty = (): DayRow => ({
    invite: 0,
    accepted: 0,
    message: 0,
    engagement: 0,
    total: 0,
  });
  const byDay = new Map<string, DayRow>();
  const bumpDay = (
    day: string,
    field: "invite" | "accepted" | "message" | "engagement",
    n = 1
  ) => {
    const row = byDay.get(day) ?? empty();
    row[field] += n;
    row.total = row.invite + row.accepted + row.message + row.engagement;
    byDay.set(day, row);
  };

  const [{ data: jobs, error: jobsError }, { data: steps }, { data: acceptJobs }] =
    await Promise.all([
      supabaseAdmin
        .from("linkedin_send_jobs")
        .select("updated_at, step_id")
        .eq("campaign_id", campaignId)
        .eq("status", "succeeded")
        .gte("updated_at", sinceIso),
      supabaseAdmin
        .from("linkedin_campaign_steps")
        .select("id, step_type")
        .eq("campaign_id", campaignId),
      // First post-invite job is created when the connection is accepted.
      supabaseAdmin
        .from("linkedin_send_jobs")
        .select("lead_id, created_at, step_id")
        .eq("campaign_id", campaignId)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: true }),
    ]);

  if (jobsError) {
    throw new Error(jobsError.message || "Could not load campaign activity.");
  }

  // coachId kept for auth scoping at call site; jobs are campaign-scoped.
  void coachId;

  const stepTypeById = new Map(
    (steps ?? []).map((s) => [s.id as string, String(s.step_type || "")])
  );

  for (const row of jobs ?? []) {
    const day = utcDayKey(String(row.updated_at || ""));
    if (!day || day < start || day > end) continue;
    const stepType = stepTypeById.get(String(row.step_id || "")) || "";
    if (stepType === "invite") bumpDay(day, "invite");
    else if (stepType === "message") bumpDay(day, "message");
    else if (stepType === "comment" || stepType === "react") {
      bumpDay(day, "engagement");
    }
  }

  const acceptedLeadDays = new Map<string, string>();
  for (const row of acceptJobs ?? []) {
    const leadId = String(row.lead_id || "");
    if (!leadId || acceptedLeadDays.has(leadId)) continue;
    const stepType = stepTypeById.get(String(row.step_id || "")) || "";
    if (stepType === "invite" || stepType === "wait") continue;
    const day = utcDayKey(String(row.created_at || ""));
    if (!day || day < start || day > end) continue;
    acceptedLeadDays.set(leadId, day);
  }
  for (const day of acceptedLeadDays.values()) {
    bumpDay(day, "accepted");
  }

  // Fallback: connected+ leads with no follow-up job yet (still on wait / stuck).
  const { data: connectedLeads } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select("id, status, updated_at")
    .eq("campaign_id", campaignId)
    .in("status", [
      "connected",
      "in_sequence",
      "replied",
      "interested",
      "assessment_sent",
      "assessment_done",
      "call_offered",
      "completed",
    ]);

  for (const lead of connectedLeads ?? []) {
    const leadId = String(lead.id || "");
    if (!leadId || acceptedLeadDays.has(leadId)) continue;
    const day = utcDayKey(String(lead.updated_at || ""));
    if (!day || day < start || day > end) continue;
    bumpDay(day, "accepted");
    acceptedLeadDays.set(leadId, day);
  }

  const buckets: Array<DayRow & { date: string }> = [];
  const totals = empty();
  let cur = start;
  while (cur <= end) {
    const counts = byDay.get(cur) ?? empty();
    buckets.push({ date: cur, ...counts });
    totals.invite += counts.invite;
    totals.accepted += counts.accepted;
    totals.message += counts.message;
    totals.engagement += counts.engagement;
    totals.total += counts.total;
    const next = addDaysToKey(cur, 1);
    if (next <= cur) break;
    cur = next;
  }

  return {
    days: clamped,
    timezone: "UTC",
    buckets,
    totals,
  };
}
