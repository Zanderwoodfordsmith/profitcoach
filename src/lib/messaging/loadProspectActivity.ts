import { formatShortDateTime } from "@/lib/formatShortDate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ProspectActivityType =
  | "prospect_created"
  | "form_filled"
  | "assessment_started"
  | "boss_score_completed"
  | "boss_pro_completed"
  | "call_booked";

export type ProspectActivityEvent = {
  id: string;
  type: ProspectActivityType;
  at: string;
  title: string;
  detail?: string | null;
  href?: string | null;
};

function calendarLabel(slugOrKind: string | null | undefined, name?: string | null): string {
  const raw = (name || slugOrKind || "Call").trim();
  const slug = (slugOrKind || "").toLowerCase();
  if (slug === "discovery" || /discovery/i.test(raw)) return "Discovery call";
  if (slug === "value-session" || /value\s*session/i.test(raw)) return "Value session";
  if (slug === "follow-up" || /follow[- ]?up/i.test(raw)) return "Follow-up";
  if (slug === "coaching" || /coaching/i.test(raw)) return "Coaching session";
  if (slug === "onboarding" || /onboarding/i.test(raw)) return "Onboarding";
  return raw || "Call";
}

/**
 * Clear milestone activity for a prospect (not message traffic).
 * Reminders / delivery noise belong in the message thread itself.
 */
export async function loadProspectActivity(
  contactId: string,
  options?: { coachId?: string | null }
): Promise<ProspectActivityEvent[]> {
  const id = contactId.trim();
  if (!id) return [];

  let contactQuery = supabaseAdmin
    .from("contacts")
    .select("id, created_at, full_name, type")
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
      }
    | undefined;
  if (!contact) return [];

  const isClient = contact.type === "client";

  const [assessmentsRes, bookingsRes, ghlRes, landingRes] = await Promise.all([
    supabaseAdmin
      .from("assessments")
      .select("id, assessment_type, total_score, completed_at, boss_level, report_token")
      .eq("contact_id", id)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: true }),
    supabaseAdmin
      .from("bookings")
      .select(
        "id, kind, starts_at, created_at, calendar_id, coach_calendars(name, slug)"
      )
      .eq("contact_id", id)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("ghl_appointments")
      .select("id, title, calendar_name, start_time, created_at")
      .eq("contact_id", id)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("landing_events")
      .select("id, event_type, created_at")
      .eq("contact_id", id)
      .in("event_type", ["opt_in", "start"])
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

  type BookingActivityRow = {
    id: string;
    kind: string | null;
    starts_at: string | null;
    created_at: string;
    calendar_id: string | null;
    coach_calendars?:
      | { name?: string | null; slug?: string | null }
      | { name?: string | null; slug?: string | null }[]
      | null;
  };
  let bookingRows: BookingActivityRow[] =
    (bookingsRes.data as BookingActivityRow[] | null) ?? [];
  if (bookingsRes.error) {
    const { data: plainBookings } = await supabaseAdmin
      .from("bookings")
      .select("id, kind, starts_at, created_at, calendar_id")
      .eq("contact_id", id)
      .order("created_at", { ascending: true });
    bookingRows = (plainBookings as BookingActivityRow[] | null) ?? [];
  }

  const events: ProspectActivityEvent[] = [];

  events.push({
    id: `prospect-created-${contact.id}`,
    type: "prospect_created",
    at: contact.created_at,
    title: isClient ? "Client added" : "Prospect created",
    detail: contact.full_name || null,
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
        title: "Completed Boss Pro assessment",
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
  }

  for (const row of ghlRes.data ?? []) {
    const label =
      (row.title as string | null)?.trim() ||
      (row.calendar_name as string | null)?.trim() ||
      "Call";
    events.push({
      id: `ghl-created-${row.id}`,
      type: "call_booked",
      at: (row.created_at as string) || (row.start_time as string),
      title: `Booked ${label}`,
      detail: row.start_time
        ? `Scheduled ${formatShortDateTime(row.start_time as string)}`
        : null,
    });
  }

  events.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );

  return events;
}
