import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireSelfOrAdmin(
  request: Request,
  bookingCoachId: string
): Promise<{ error: string | null; userId: string | null }> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!token) return { error: "Missing access token.", userId: null };

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { error: "Invalid access token.", userId: null };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return { error: "Not authorized.", userId: null };
  if (profile.role === "admin") return { error: null, userId: user.id };
  if (profile.role === "coach" && user.id === bookingCoachId) {
    return { error: null, userId: user.id };
  }
  return { error: "Not authorized.", userId: null };
}

const ALLOWED = new Set(["booked", "cancelled", "completed", "noshow"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing booking id." }, { status: 400 });
  }

  const { data: booking, error: loadError } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, coach_id, status, starts_at, ends_at, meeting_join_url, zoom_meeting_id, zoom_recording_url, zoom_transcript_text"
    )
    .eq("id", id.trim())
    .maybeSingle();

  if (loadError || !booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  const auth = await requireSelfOrAdmin(request, booking.coach_id as string);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let recordingUrl =
    typeof booking.zoom_recording_url === "string"
      ? booking.zoom_recording_url.trim()
      : "";
  let transcriptText =
    typeof booking.zoom_transcript_text === "string"
      ? booking.zoom_transcript_text.trim()
      : "";
  const meetingId =
    typeof booking.zoom_meeting_id === "string"
      ? booking.zoom_meeting_id.trim()
      : "";
  const endedAt = booking.ends_at ? Date.parse(String(booking.ends_at)) : NaN;
  const meetingEnded =
    Number.isFinite(endedAt) && endedAt < Date.now() - 2 * 60 * 1000;

  if (meetingId && meetingEnded && (!recordingUrl || !transcriptText)) {
    const { hydrateBookingZoomRecording } = await import(
      "@/lib/booking/zoomBookingRecording"
    );
    const hydrated = await hydrateBookingZoomRecording({
      coachId: booking.coach_id as string,
      meetingId,
      bookingId: booking.id as string,
    });
    if (hydrated.recordingUrl) recordingUrl = hydrated.recordingUrl;
    if (hydrated.transcriptText) transcriptText = hydrated.transcriptText;
  }

  return NextResponse.json({
    booking: {
      id: booking.id,
      meeting_join_url: booking.meeting_join_url,
      zoom_recording_url: recordingUrl || null,
      zoom_transcript_text: transcriptText || null,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing booking id." }, { status: 400 });
  }

  const { data: booking, error: loadError } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, coach_id, status, google_event_id, google_calendar_id, zoom_meeting_id"
    )
    .eq("id", id.trim())
    .maybeSingle();

  if (loadError || !booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  const auth = await requireSelfOrAdmin(request, booking.coach_id as string);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let body: { status?: string };
  try {
    body = (await request.json()) as { status?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const status = body.status?.trim();
  if (!status || !ALLOWED.has(status)) {
    return NextResponse.json(
      { error: "status must be booked, cancelled, completed, or noshow." },
      { status: 400 }
    );
  }

  const { data: updated, error } = await supabaseAdmin
    .from("bookings")
    .update({ status })
    .eq("id", booking.id)
    .select(
      "id, status, starts_at, ends_at, calendar_id, meeting_join_url, prospect_name, prospect_email"
    )
    .maybeSingle();

  if (error) {
    console.error("booking status PATCH:", error);
    return NextResponse.json({ error: "Could not update." }, { status: 500 });
  }

  if (status === "cancelled") {
    if (booking.google_event_id && booking.google_calendar_id) {
      try {
        const { getValidGoogleAccessToken } = await import(
          "@/lib/booking/googleCalendar"
        );
        const token = await getValidGoogleAccessToken(booking.coach_id as string);
        if (token) {
          const cal = encodeURIComponent(String(booking.google_calendar_id));
          const ev = encodeURIComponent(String(booking.google_event_id));
          await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${cal}/events/${ev}?sendUpdates=all`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
              cache: "no-store",
            }
          );
        }
      } catch (e) {
        console.error("google event cancel:", e);
      }
    }
    if (booking.zoom_meeting_id) {
      try {
        const { deleteZoomBookingMeeting } = await import(
          "@/lib/booking/zoomMeetings"
        );
        await deleteZoomBookingMeeting({
          coachId: booking.coach_id as string,
          meetingId: String(booking.zoom_meeting_id),
        });
      } catch (e) {
        console.error("zoom meeting cancel:", e);
      }
    }
  }

  return NextResponse.json({ booking: updated });
}
