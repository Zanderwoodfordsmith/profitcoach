import { NextResponse } from "next/server";
import { loadClientSessions } from "@/lib/clientCoaching/loadClientSessions";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = { params: Promise<{ id: string }> };

async function assertClientContact(contactId: string, coachId: string) {
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select("id, coach_id, type, full_name")
    .eq("id", contactId)
    .maybeSingle();
  if (error || !data || data.coach_id !== coachId) {
    return { error: "Client not found.", status: 404 as const, contact: null };
  }
  if (data.type !== "client") {
    return {
      error: "Sessions are available for clients only.",
      status: 400 as const,
      contact: null,
    };
  }
  return { error: null, status: 200 as const, contact: data };
}

/** GET — merged coaching sessions (booked + GHL + manual) for a client. */
export async function GET(request: Request, context: RouteContext) {
  const authCheck = await requireCoachRequest(request, { allowAdminSelf: true });
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const { id: contactId } = await context.params;
  if (!contactId?.trim()) {
    return NextResponse.json({ error: "Missing contact id." }, { status: 400 });
  }

  const gate = await assertClientContact(contactId, authCheck.userId);
  if (gate.error || !gate.contact) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const sessions = await loadClientSessions(contactId, authCheck.userId);
  return NextResponse.json({ sessions });
}

type PostBody = {
  title?: string;
  sessionType?: string;
  startsAt?: string;
  endsAt?: string | null;
  notes?: string;
  /** Attach notes to an existing booking instead of creating a manual session. */
  bookingId?: string | null;
  ghlAppointmentId?: string | null;
};

/** POST — log a manual session, or upsert notes for a booked/GHL call. */
export async function POST(request: Request, context: RouteContext) {
  const authCheck = await requireCoachRequest(request, { allowAdminSelf: true });
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const { id: contactId } = await context.params;
  if (!contactId?.trim()) {
    return NextResponse.json({ error: "Missing contact id." }, { status: 400 });
  }

  const gate = await assertClientContact(contactId, authCheck.userId);
  if (gate.error || !gate.contact) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const notes = typeof body.notes === "string" ? body.notes : "";
  const title = (body.title?.trim() || "Coaching session").slice(0, 200);
  const sessionType = (body.sessionType?.trim() || "coaching").slice(0, 80);
  const bookingId = body.bookingId?.trim() || null;
  const ghlAppointmentId = body.ghlAppointmentId?.trim() || null;

  if (bookingId || ghlAppointmentId) {
    const source = bookingId ? "booking" : "ghl";
    let startsAt = body.startsAt?.trim() || null;
    let endsAt = body.endsAt?.trim() || null;

    if (bookingId) {
      const { data: booking } = await supabaseAdmin
        .from("bookings")
        .select("id, starts_at, ends_at")
        .eq("id", bookingId)
        .eq("coach_id", authCheck.userId)
        .eq("contact_id", contactId)
        .maybeSingle();
      if (!booking) {
        return NextResponse.json({ error: "Booking not found." }, { status: 404 });
      }
      startsAt = startsAt || (booking.starts_at as string);
      endsAt = endsAt || (booking.ends_at as string | null);
    } else if (ghlAppointmentId) {
      const { data: ghl } = await supabaseAdmin
        .from("ghl_appointments")
        .select("id, start_time, end_time")
        .eq("id", ghlAppointmentId)
        .eq("coach_id", authCheck.userId)
        .eq("contact_id", contactId)
        .maybeSingle();
      if (!ghl) {
        return NextResponse.json(
          { error: "Appointment not found." },
          { status: 404 }
        );
      }
      startsAt = startsAt || (ghl.start_time as string);
      endsAt = endsAt || (ghl.end_time as string | null);
    }

    if (!startsAt) {
      return NextResponse.json(
        { error: "Session start time is required." },
        { status: 400 }
      );
    }

    let existingId: string | null = null;
    if (bookingId) {
      const { data: existing } = await supabaseAdmin
        .from("client_coaching_sessions")
        .select("id")
        .eq("booking_id", bookingId)
        .maybeSingle();
      existingId = (existing?.id as string | undefined) ?? null;
    } else if (ghlAppointmentId) {
      const { data: existing } = await supabaseAdmin
        .from("client_coaching_sessions")
        .select("id")
        .eq("ghl_appointment_id", ghlAppointmentId)
        .maybeSingle();
      existingId = (existing?.id as string | undefined) ?? null;
    }

    const payload = {
      coach_id: authCheck.userId,
      contact_id: contactId,
      booking_id: bookingId,
      ghl_appointment_id: ghlAppointmentId,
      title,
      session_type: sessionType,
      starts_at: startsAt,
      ends_at: endsAt,
      source,
      notes,
    };

    const write = existingId
      ? supabaseAdmin
          .from("client_coaching_sessions")
          .update(payload)
          .eq("id", existingId)
          .select("id, notes, title, starts_at, ends_at, source")
          .single()
      : supabaseAdmin
          .from("client_coaching_sessions")
          .insert(payload)
          .select("id, notes, title, starts_at, ends_at, source")
          .single();

    const { data, error } = await write;

    if (error) {
      console.error("client sessions upsert:", error);
      return NextResponse.json(
        { error: "Unable to save session notes." },
        { status: 500 }
      );
    }

    return NextResponse.json({ session: data }, { status: existingId ? 200 : 201 });
  }

  const startsAt = body.startsAt?.trim();
  if (!startsAt || Number.isNaN(Date.parse(startsAt))) {
    return NextResponse.json(
      { error: "Provide a valid session date and time." },
      { status: 400 }
    );
  }
  const endsAt = body.endsAt?.trim() || null;
  if (endsAt && Number.isNaN(Date.parse(endsAt))) {
    return NextResponse.json({ error: "Invalid end time." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("client_coaching_sessions")
    .insert({
      coach_id: authCheck.userId,
      contact_id: contactId,
      title,
      session_type: sessionType,
      starts_at: startsAt,
      ends_at: endsAt,
      source: "manual",
      notes,
    })
    .select("id, notes, title, starts_at, ends_at, source")
    .single();

  if (error) {
    console.error("client sessions insert:", error);
    return NextResponse.json(
      { error: "Unable to log coaching session." },
      { status: 500 }
    );
  }

  return NextResponse.json({ session: data }, { status: 201 });
}
