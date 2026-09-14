import { formatShortDateTime } from "@/lib/formatShortDate";
import { prospectCreatedActivityTitle } from "@/lib/messaging/prospectCreatedActivityTitle";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ProspectActivityType =
  | "prospect_created"
  | "form_filled"
  | "assessment_started"
  | "boss_score_completed"
  | "boss_pro_completed"
  | "call_booked"
  | "campaign_added"
  | "campaign_left"
  | "linkedin_connected";

export type ProspectActivityEvent = {
  id: string;
  type: ProspectActivityType;
  at: string;
  title: string;
  detail?: string | null;
  href?: string | null;
};

export type ProspectCampaignMembership = {
  id: string;
  campaignId: string;
  name: string;
  leadStatus: string;
  addedAt: string;
};

export type ProspectCall = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  status: string | null;
  meetingJoinUrl: string | null;
};

const CONNECTED_LEAD_STATUSES = new Set([
  "connected",
  "in_sequence",
  "replied",
  "interested",
  "assessment_sent",
  "assessment_done",
  "call_offered",
  "completed",
]);

const LEFT_LEAD_STATUSES = new Set(["skipped", "failed"]);

function calendarLabel(
  slugOrKind: string | null | undefined,
  name?: string | null
): string {
  const raw = (name || slugOrKind || "Call").trim();
  const slug = (slugOrKind || "").toLowerCase();
  if (slug === "discovery" || /discovery/i.test(raw)) return "Discovery call";
  if (slug === "value-session" || /value\s*session/i.test(raw))
    return "Value session";
  if (slug === "follow-up" || /follow[- ]?up/i.test(raw)) return "Follow-up";
  if (slug === "coaching" || /coaching/i.test(raw)) return "Coaching session";
  if (slug === "onboarding" || /onboarding/i.test(raw)) return "Onboarding";
  return raw || "Call";
}

type BookingActivityRow = {
  id: string;
  kind: string | null;
  status?: string | null;
  starts_at: string | null;
  ends_at?: string | null;
  created_at: string;
  calendar_id: string | null;
  meeting_join_url?: string | null;
  coach_calendars?:
    | { name?: string | null; slug?: string | null }
    | { name?: string | null; slug?: string | null }[]
    | null;
};

/**
 * Clear milestone activity for a prospect (not message traffic).
 * Reminders / delivery noise belong in the message thread itself.
 */
export async function loadProspectRecord(
  contactId: string,
  options?: { coachId?: string | null }
): Promise<{
  activity: ProspectActivityEvent[];
  campaigns: ProspectCampaignMembership[];
  calls: ProspectCall[];
}> {
  const id = contactId.trim();
  if (!id) return { activity: [], campaigns: [], calls: [] };

  let contactQuery = supabaseAdmin
    .from("contacts")
    .select("id, created_at, full_name, type, prospect_source")
    .eq("id", id)
    .in("type", ["prospect", "client"])
    .limit(1);
  if (options?.coachId) {
    contactQuery = contactQuery.eq("coach_id", options.coachId);
  }
  const { data: contactRows } = await contactQuery;
  const contact = contactRows?.[0] as
    | {
        id: string;
        created_at: string;
        full_name: string | null;
        type: string | null;
        prospect_source: string | null;
      }
    | undefined;
  if (!contact) return { activity: [], campaigns: [], calls: [] };

  const isClient = contact.type === "client";

  const [assessmentsRes, bookingsRes, ghlRes, landingRes, campaignsRes] =
    await Promise.all([
      supabaseAdmin
        .from("assessments")
        .select(
          "id, assessment_type, total_score, completed_at, boss_level, report_token"
        )
        .eq("contact_id", id)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: true }),
      supabaseAdmin
        .from("bookings")
        .select(
          "id, kind, status, starts_at, ends_at, created_at, calendar_id, meeting_join_url, coach_calendars(name, slug)"
        )
        .eq("contact_id", id)
        .order("starts_at", { ascending: true }),
      supabaseAdmin
        .from("ghl_appointments")
        .select("id, title, calendar_name, start_time, end_time, created_at, status_normalized")
        .eq("contact_id", id)
        .order("start_time", { ascending: true }),
      supabaseAdmin
        .from("landing_events")
        .select("id, event_type, created_at")
        .eq("contact_id", id)
        .in("event_type", ["opt_in", "start"])
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("linkedin_campaign_leads")
        .select(
          "id, campaign_id, status, created_at, updated_at, linkedin_campaigns(id, name)"
        )
        .eq("contact_id", id)
        .order("created_at", { ascending: true }),
    ]);

  if (assessmentsRes.error) {
    console.error("prospect activity assessments:", assessmentsRes.error);
  }
  if (bookingsRes.error) {
    console.error("prospect activity bookings:", bookingsRes.error);
  }
  if (ghlRes.error) {
    console.error("prospect activity ghl:", ghlRes.error);
  }
  if (landingRes.error) {
    console.error("prospect activity landing:", landingRes.error);
  }
  if (campaignsRes.error) {
    console.error("prospect activity campaigns:", campaignsRes.error);
  }

  let bookingRows: BookingActivityRow[] =
    (bookingsRes.data as BookingActivityRow[] | null) ?? [];
  if (bookingsRes.error) {
    const { data: plainBookings } = await supabaseAdmin
      .from("bookings")
      .select("id, kind, status, starts_at, ends_at, created_at, calendar_id")
      .eq("contact_id", id)
      .order("starts_at", { ascending: true });
    bookingRows = (plainBookings as BookingActivityRow[] | null) ?? [];
  }

  const events: ProspectActivityEvent[] = [];
  const calls: ProspectCall[] = [];

  events.push({
    id: `prospect-created-${contact.id}`,
    type: "prospect_created",
    at: contact.created_at,
    title: prospectCreatedActivityTitle({
      isClient,
      prospectSource: contact.prospect_source,
    }),
    detail: null,
  });

  for (const row of landingRes.data ?? []) {
    const eventType = String(row.event_type || "");
    if (eventType === "opt_in") {
      events.push({
        id: `landing-${row.id}`,
        type: "form_filled",
        at: row.created_at as string,
        title: "Filled in lead form",
        detail: null,
      });
    } else if (eventType === "start") {
      events.push({
        id: `landing-${row.id}`,
        type: "assessment_started",
        at: row.created_at as string,
        title: "Started an assessment",
        detail: null,
      });
    }
  }

  for (const row of assessmentsRes.data ?? []) {
    const completedAt = row.completed_at as string | null;
    if (!completedAt) continue;
    const score =
      typeof row.total_score === "number" ? Math.round(row.total_score) : null;
    if (row.assessment_type === "boss_scorecard") {
      events.push({
        id: `assessment-${row.id}`,
        type: "boss_score_completed",
        at: completedAt,
        title: "Completed Boss Score",
        detail:
          score != null
            ? `${score}%${row.boss_level ? ` · ${row.boss_level}` : ""}`
            : row.boss_level || null,
        href: row.report_token
          ? `/scorecard/report/${row.report_token}`
          : null,
      });
    } else if (row.assessment_type === "diagnostic_50") {
      events.push({
        id: `assessment-${row.id}`,
        type: "boss_pro_completed",
        at: completedAt,
        title: "Completed Boss Pro",
        detail: score != null ? `Score ${score}` : null,
      });
    }
  }

  for (const row of bookingRows) {
    const cal = row.coach_calendars;
    const calRow = Array.isArray(cal) ? cal[0] : cal;
    const label = calendarLabel(
      row.kind || calRow?.slug || null,
      calRow?.name
    );
    events.push({
      id: `booking-created-${row.id}`,
      type: "call_booked",
      at: row.created_at,
      title: `Booked ${label}`,
      detail: row.starts_at
        ? `Scheduled ${formatShortDateTime(row.starts_at)}`
        : null,
    });
    if (row.starts_at) {
      calls.push({
        id: row.id,
        title: label,
        startsAt: row.starts_at,
        endsAt: row.ends_at ?? null,
        status: row.status ?? "booked",
        meetingJoinUrl: row.meeting_join_url ?? null,
      });
    }
  }

  for (const row of ghlRes.data ?? []) {
    const label =
      (row.title as string | null)?.trim() ||
      (row.calendar_name as string | null)?.trim() ||
      "Call";
    const start = (row.start_time as string | null) || null;
    events.push({
      id: `ghl-created-${row.id}`,
      type: "call_booked",
      at: (row.created_at as string) || (start as string),
      title: `Booked ${label}`,
      detail: start ? `Scheduled ${formatShortDateTime(start)}` : null,
    });
    if (start) {
      calls.push({
        id: `ghl-${row.id}`,
        title: label,
        startsAt: start,
        endsAt: (row.end_time as string | null) ?? null,
        status: (row.status_normalized as string | null) ?? "booked",
        meetingJoinUrl: null,
      });
    }
  }

  type CampaignLeadRow = {
    id: string;
    campaign_id: string;
    status: string | null;
    created_at: string;
    updated_at: string | null;
    linkedin_campaigns?:
      | { id?: string | null; name?: string | null }
      | { id?: string | null; name?: string | null }[]
      | null;
  };

  const campaignRows = (campaignsRes.data as CampaignLeadRow[] | null) ?? [];
  const campaigns: ProspectCampaignMembership[] = [];

  for (const row of campaignRows) {
    const campaign = Array.isArray(row.linkedin_campaigns)
      ? row.linkedin_campaigns[0]
      : row.linkedin_campaigns;
    const name = campaign?.name?.trim() || "Campaign";
    const campaignId = campaign?.id || row.campaign_id;
    const status = (row.status || "queued").toLowerCase();
    campaigns.push({
      id: row.id,
      campaignId,
      name,
      leadStatus: status,
      addedAt: row.created_at,
    });
    events.push({
      id: `campaign-added-${row.id}`,
      type: "campaign_added",
      at: row.created_at,
      title: `Added to ${name}`,
      detail: null,
    });
    if (CONNECTED_LEAD_STATUSES.has(status)) {
      events.push({
        id: `linkedin-connected-${row.id}`,
        type: "linkedin_connected",
        at: row.updated_at || row.created_at,
        title: "Connected on LinkedIn",
        detail: name,
      });
    }
    if (LEFT_LEAD_STATUSES.has(status)) {
      events.push({
        id: `campaign-left-${row.id}`,
        type: "campaign_left",
        at: row.updated_at || row.created_at,
        title:
          status === "failed" ? `Stopped in ${name}` : `Removed from ${name}`,
        detail: null,
      });
    }
  }

  events.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );
  calls.sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  );

  return { activity: events, campaigns, calls };
}

export async function loadProspectActivity(
  contactId: string,
  options?: { coachId?: string | null }
): Promise<ProspectActivityEvent[]> {
  return (await loadProspectRecord(contactId, options)).activity;
}
