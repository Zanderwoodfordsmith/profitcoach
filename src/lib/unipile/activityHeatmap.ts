import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { addDaysYmd, ymdInTimeZone, zonedLocalToUtc } from "@/lib/booking/bookingTime";
import { startOfZonedDay } from "@/lib/unipile/campaignSendWindow";
import { campaignStepHeatmapBucket } from "@/lib/unipile/campaignStepTypes";

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
 * Invites / sequence messages / emails / soft-touch come from
 * linkedin_send_jobs (succeeded). Synced personal Gmail is omitted so
 * dentist appointments and other inbox mail are not counted as outreach.
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
    const bucket = campaignStepHeatmapBucket(stepType);
    if (bucket === "invite") bump(byDay, day, "invite");
    else if (bucket === "message") bump(byDay, day, "message");
    else if (bucket === "email") bump(byDay, day, "email");
    else if (bucket === "engagement") bump(byDay, day, "engagement");
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
    const bucket = campaignStepHeatmapBucket(stepType);
    if (bucket === "invite") bumpDay(day, "invite");
    else if (bucket === "message" || bucket === "email") bumpDay(day, "message");
    else if (bucket === "engagement") bumpDay(day, "engagement");
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

function ymdToZonedStart(ymd: string, timeZone: string): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  return zonedLocalToUtc({
    year: year || 1970,
    month: month || 1,
    day: day || 1,
    hour: 0,
    minute: 0,
    timeZone,
  });
}

function zonedDayKey(iso: string, timeZone: string): string | null {
  const parsed = Date.parse(iso.includes("T") ? iso : `${iso}T12:00:00.000Z`);
  if (Number.isNaN(parsed)) return null;
  return ymdInTimeZone(new Date(parsed), timeZone);
}

function classifyStepType(
  stepType: string | undefined
): "invite" | "message" | "email" | "engagement" | null {
  return campaignStepHeatmapBucket(stepType);
}

/**
 * Distinct people touched in the window (campaign timezone).
 * Prefer contact_id when present so multi-step / multi-channel
 * sends to the same person count once; fall back to lead / conversation.
 */
export async function countPeopleReachedInRange(
  coachId: string,
  startYmd: string,
  endYmd: string,
  timeZone: string
): Promise<number> {
  if (endYmd < startYmd) return 0;

  const sinceIso = ymdToZonedStart(startYmd, timeZone).toISOString();
  const untilIso = ymdToZonedStart(addDaysYmd(endYmd, 1), timeZone).toISOString();
  const keys = new Set<string>();

  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .select("lead_id, updated_at, linkedin_campaign_leads(contact_id)")
    .eq("coach_id", coachId)
    .eq("status", "succeeded")
    .gte("updated_at", sinceIso)
    .lt("updated_at", untilIso);

  if (jobsError) {
    throw new Error(jobsError.message || "Could not load people reached.");
  }

  for (const row of jobs ?? []) {
    const day = zonedDayKey(String(row.updated_at || ""), timeZone);
    if (!day || day < startYmd || day > endYmd) continue;
    const lead = row.linkedin_campaign_leads as
      | { contact_id?: string | null }
      | { contact_id?: string | null }[]
      | null;
    const contactId = Array.isArray(lead)
      ? lead[0]?.contact_id
      : lead?.contact_id;
    if (contactId) keys.add(`c:${contactId}`);
    else if (row.lead_id) keys.add(`l:${row.lead_id}`);
  }

  return keys.size;
}

/** Window-scoped outbound counts in the campaign timezone (not trailing UTC). */
export async function loadActivityInRange(
  coachId: string,
  startYmd: string,
  endYmd: string,
  timeZone: string
): Promise<ActivityDayCounts[]> {
  if (endYmd < startYmd) return [];

  const sinceIso = ymdToZonedStart(startYmd, timeZone).toISOString();
  const untilIso = ymdToZonedStart(addDaysYmd(endYmd, 1), timeZone).toISOString();
  const byDay = new Map<string, Omit<ActivityDayCounts, "date">>();

  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .select("updated_at, linkedin_campaign_steps(step_type)")
    .eq("coach_id", coachId)
    .eq("status", "succeeded")
    .gte("updated_at", sinceIso)
    .lt("updated_at", untilIso);

  if (jobsError) {
    throw new Error(jobsError.message || "Could not load send jobs.");
  }

  for (const row of jobs ?? []) {
    const day = zonedDayKey(String(row.updated_at || ""), timeZone);
    if (!day || day < startYmd || day > endYmd) continue;
    const step = row.linkedin_campaign_steps as
      | { step_type?: string }
      | { step_type?: string }[]
      | null;
    const stepType = Array.isArray(step)
      ? step[0]?.step_type
      : step?.step_type;
    const field = classifyStepType(stepType);
    if (field) bump(byDay, day, field);
  }

  const buckets: ActivityDayCounts[] = [];
  let cur = startYmd;
  while (cur <= endYmd) {
    const counts = byDay.get(cur) ?? emptyCounts();
    buckets.push({ date: cur, ...counts });
    const next = addDaysToKey(cur, 1);
    if (next <= cur) break;
    cur = next;
  }
  return buckets;
}

export async function countSucceededInvitesToday(
  coachId: string,
  timeZone: string
): Promise<number> {
  const start = startOfZonedDay(new Date(), timeZone || "Europe/London");
  const { data: jobs } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .select("id, step_id")
    .eq("coach_id", coachId)
    .eq("status", "succeeded")
    .gte("updated_at", start.toISOString());
  if (!jobs?.length) return 0;
  const stepIds = [...new Set(jobs.map((j) => j.step_id as string))];
  const { data: steps } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .select("id, step_type")
    .in("id", stepIds);
  const inviteIds = new Set(
    (steps ?? [])
      .filter((s) => s.step_type === "invite")
      .map((s) => s.id as string)
  );
  return jobs.filter((j) => inviteIds.has(j.step_id as string)).length;
}
