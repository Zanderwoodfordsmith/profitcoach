import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ClientSessionSource = "manual" | "booking" | "ghl";

export type ClientSessionRow = {
  id: string | null;
  bookingId: string | null;
  ghlAppointmentId: string | null;
  title: string;
  sessionType: string;
  startsAt: string;
  endsAt: string | null;
  source: ClientSessionSource;
  notes: string;
  status: string | null;
  hasNotesRow: boolean;
};

type SessionNoteRow = {
  id: string;
  booking_id: string | null;
  ghl_appointment_id: string | null;
  title: string;
  session_type: string;
  starts_at: string;
  ends_at: string | null;
  source: ClientSessionSource;
  notes: string;
};

function calendarLabel(slugOrKind: string | null | undefined, name?: string | null): string {
  const raw = (name || slugOrKind || "Coaching session").trim();
  const slug = (slugOrKind || "").toLowerCase();
  if (slug === "discovery" || /discovery/i.test(raw)) return "Discovery call";
  if (slug === "value-session" || /value\s*session/i.test(raw)) return "Value session";
  if (slug === "follow-up" || /follow[- ]?up/i.test(raw)) return "Follow-up";
  if (slug === "coaching" || /coaching/i.test(raw)) return "Coaching session";
  if (slug === "onboarding" || /onboarding/i.test(raw)) return "Onboarding";
  return raw || "Coaching session";
}

/**
 * Merge booked calls (native + GHL) with manually logged coaching sessions
 * and any attached notes rows for a client contact.
 */
export async function loadClientSessions(
  contactId: string,
  coachId: string
): Promise<ClientSessionRow[]> {
  const [notesRes, bookingsRes, ghlRes] = await Promise.all([
    supabaseAdmin
      .from("client_coaching_sessions")
      .select(
        "id, booking_id, ghl_appointment_id, title, session_type, starts_at, ends_at, source, notes"
      )
      .eq("contact_id", contactId)
      .eq("coach_id", coachId)
      .order("starts_at", { ascending: false }),
    supabaseAdmin
      .from("bookings")
      .select(
        "id, kind, status, starts_at, ends_at, notes, calendar_id, coach_calendars(name, slug)"
      )
      .eq("contact_id", contactId)
      .eq("coach_id", coachId)
      .order("starts_at", { ascending: false }),
    supabaseAdmin
      .from("ghl_appointments")
      .select("id, title, calendar_name, status_normalized, start_time, end_time")
      .eq("contact_id", contactId)
      .eq("coach_id", coachId)
      .order("start_time", { ascending: false }),
  ]);

  const noteRows = (notesRes.data ?? []) as SessionNoteRow[];
  const notesByBooking = new Map<string, SessionNoteRow>();
  const notesByGhl = new Map<string, SessionNoteRow>();
  const manual: ClientSessionRow[] = [];

  for (const row of noteRows) {
    if (row.source === "booking" && row.booking_id) {
      notesByBooking.set(row.booking_id, row);
    } else if (row.source === "ghl" && row.ghl_appointment_id) {
      notesByGhl.set(row.ghl_appointment_id, row);
    } else if (row.source === "manual") {
      manual.push({
        id: row.id,
        bookingId: null,
        ghlAppointmentId: null,
        title: row.title || "Coaching session",
        sessionType: row.session_type || "coaching",
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        source: "manual",
        notes: row.notes ?? "",
        status: null,
        hasNotesRow: true,
      });
    }
  }

  type BookingRow = {
    id: string;
    kind: string | null;
    status: string | null;
    starts_at: string;
    ends_at: string | null;
    notes: string | null;
    coach_calendars?:
      | { name?: string | null; slug?: string | null }
      | { name?: string | null; slug?: string | null }[]
      | null;
  };

  let bookingRows: BookingRow[] = (bookingsRes.data as BookingRow[] | null) ?? [];
  if (bookingsRes.error) {
    const { data: plain } = await supabaseAdmin
      .from("bookings")
      .select("id, kind, status, starts_at, ends_at, notes")
      .eq("contact_id", contactId)
      .eq("coach_id", coachId)
      .order("starts_at", { ascending: false });
    bookingRows = (plain as BookingRow[] | null) ?? [];
  }

  const fromBookings: ClientSessionRow[] = bookingRows.map((row) => {
    const cal = row.coach_calendars;
    const calRow = Array.isArray(cal) ? cal[0] : cal;
    const note = notesByBooking.get(row.id);
    const title = note?.title || calendarLabel(row.kind || calRow?.slug, calRow?.name);
    return {
      id: note?.id ?? null,
      bookingId: row.id,
      ghlAppointmentId: null,
      title,
      sessionType: note?.session_type || row.kind || "coaching",
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      source: "booking" as const,
      notes: note?.notes ?? row.notes ?? "",
      status: row.status,
      hasNotesRow: Boolean(note),
    };
  });

  const fromGhl: ClientSessionRow[] = (ghlRes.data ?? [])
    .filter((row) => row.start_time)
    .map((row) => {
      const note = notesByGhl.get(row.id as string);
      const title =
        note?.title ||
        (row.title as string | null)?.trim() ||
        (row.calendar_name as string | null)?.trim() ||
        "Coaching session";
      return {
        id: note?.id ?? null,
        bookingId: null,
        ghlAppointmentId: row.id as string,
        title,
        sessionType: note?.session_type || "coaching",
        startsAt: row.start_time as string,
        endsAt: (row.end_time as string | null) ?? null,
        source: "ghl" as const,
        notes: note?.notes ?? "",
        status: (row.status_normalized as string | null) ?? null,
        hasNotesRow: Boolean(note),
      };
    });

  const merged = [...manual, ...fromBookings, ...fromGhl];
  merged.sort(
    (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
  );
  return merged;
}
