import { NextResponse } from "next/server";
import { computeBookingSlots } from "@/lib/booking/computeBookingSlots";
import { calendarToBookingSettings } from "@/lib/booking/coachCalendars";
import { isValidIanaTimeZone } from "@/lib/booking/bookingTime";
import {
  findOrCreateProspectContact,
  loadBookingSettingsForCoach,
  loadCoachBySlug,
  loadCoachCalendarBySlug,
  loadExistingBookedIntervals,
} from "@/lib/booking/bookingService";
import { formatInTimeZone, ymdInTimeZone } from "@/lib/booking/bookingTime";
import {
  createGoogleBookingEvent,
  fetchGoogleBusyIntervals,
} from "@/lib/booking/googleCalendar";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; calendarSlug: string }> }
) {
  const { slug, calendarSlug } = await params;
  const coach = await loadCoachBySlug(slug ?? "");
  if (!coach) {
    return NextResponse.json({ error: "Coach not found." }, { status: 404 });
  }

  const calendar = await loadCoachCalendarBySlug(coach.id, calendarSlug ?? "");
  if (!calendar) {
    return NextResponse.json({ error: "Calendar not found." }, { status: 404 });
  }

  const { settings: coachSettings } = await loadBookingSettingsForCoach(coach.id);

  return NextResponse.json({
    slug: coach.slug,
    calendar_slug: calendar.slug,
    calendar_id: calendar.id,
    display_name: coach.displayName,
    is_enabled: calendar.is_enabled && calendar.is_public,
    title: calendar.name,
    timezone: coachSettings.timezone,
    meeting_duration_minutes: calendar.meeting_duration_minutes,
    location_mode: calendar.location_mode,
  });
}

type BookBody = {
  starts_at?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  prospect_timezone?: string;
  notes?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; calendarSlug: string }> }
) {
  const { slug, calendarSlug } = await params;
  const coach = await loadCoachBySlug(slug ?? "");
  if (!coach) {
    return NextResponse.json({ error: "Coach not found." }, { status: 404 });
  }

  const calendar = await loadCoachCalendarBySlug(coach.id, calendarSlug ?? "");
  if (!calendar || !calendar.is_enabled || !calendar.is_public) {
    return NextResponse.json(
      { error: "Booking is not enabled for this calendar." },
      { status: 400 }
    );
  }

  const { settings: coachSettings, rules } = await loadBookingSettingsForCoach(
    coach.id
  );
  if (rules.length === 0) {
    return NextResponse.json(
      { error: "No availability configured." },
      { status: 400 }
    );
  }

  const settings = calendarToBookingSettings(calendar, coachSettings.timezone);

  let body: BookBody;
  try {
    body = (await request.json()) as BookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const startsAt = body.starts_at?.trim();
  const firstName = body.first_name?.trim() ?? "";
  const lastName = body.last_name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const phone = body.phone?.trim() || null;
  const prospectTz = body.prospect_timezone?.trim() || "UTC";

  if (!startsAt || Number.isNaN(Date.parse(startsAt))) {
    return NextResponse.json({ error: "Invalid starts_at." }, { status: 400 });
  }
  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "First and last name are required." },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }
  if (!isValidIanaTimeZone(prospectTz)) {
    return NextResponse.json(
      { error: "Invalid prospect_timezone." },
      { status: 400 }
    );
  }

  const windowStart = new Date();
  const windowEnd = new Date(
    windowStart.getTime() +
      (settings.booking_window_days + 2) * 24 * 60 * 60 * 1000
  );

  const [existing, googleBusy] = await Promise.all([
    loadExistingBookedIntervals(
      coach.id,
      windowStart.toISOString(),
      windowEnd.toISOString()
    ),
    fetchGoogleBusyIntervals({
      coachId: coach.id,
      timeMin: windowStart.toISOString(),
      timeMax: windowEnd.toISOString(),
    }),
  ]);

  const slots = computeBookingSlots({
    settings,
    rules,
    existing: [...existing, ...googleBusy],
  });
  const match = slots.find((s) => s.startsAt === new Date(startsAt).toISOString());
  const alt = slots.find(
    (s) => new Date(s.startsAt).getTime() === new Date(startsAt).getTime()
  );
  const chosen = match ?? alt;
  if (!chosen) {
    return NextResponse.json(
      { error: "That time is no longer available." },
      { status: 409 }
    );
  }

  const contactId = await findOrCreateProspectContact({
    coachId: coach.id,
    email,
    firstName,
    lastName,
    phone,
  });

  const guestName = `${firstName} ${lastName}`.trim();

  let meetingJoinUrl: string | null = null;
  let meetingPhone: string | null =
    calendar.location_mode === "phone" ? calendar.location_phone : null;
  let meetingInstructions: string | null =
    calendar.location_mode === "custom" ? calendar.location_custom : null;
  let googleEventId: string | null = null;
  let googleCalendarId: string | null = null;

  const descriptionParts = [
    `${calendar.name} with ${coach.displayName}.`,
    `Guest: ${guestName} (${email})`,
    phone ? `Phone: ${phone}` : null,
    calendar.location_mode === "phone" && calendar.location_phone
      ? `Call: ${calendar.location_phone}`
      : null,
    calendar.location_mode === "custom" && calendar.location_custom
      ? calendar.location_custom
      : null,
  ].filter(Boolean);

  const googleEvent = await createGoogleBookingEvent({
    coachId: coach.id,
    title: calendar.name,
    description: descriptionParts.join("\n"),
    startsAt: chosen.startsAt,
    endsAt: chosen.endsAt,
    guestEmail: email,
    guestName,
    timezone: coachSettings.timezone,
    locationMode: calendar.location_mode,
    locationPhone: calendar.location_phone,
    locationCustom: calendar.location_custom,
  });

  if (googleEvent) {
    googleEventId = googleEvent.eventId;
    googleCalendarId = googleEvent.calendarId;
    if (googleEvent.hangoutLink) {
      meetingJoinUrl = googleEvent.hangoutLink;
    }
  }

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .insert({
      coach_id: coach.id,
      calendar_id: calendar.id,
      contact_id: contactId,
      kind: calendar.slug,
      status: "booked",
      starts_at: chosen.startsAt,
      ends_at: chosen.endsAt,
      prospect_timezone: prospectTz,
      prospect_name: guestName,
      prospect_email: email,
      prospect_phone: phone,
      notes: body.notes?.trim() || null,
      google_event_id: googleEventId,
      google_calendar_id: googleCalendarId,
      meeting_location_type: calendar.location_mode,
      meeting_join_url: meetingJoinUrl,
      meeting_phone: meetingPhone,
      meeting_instructions: meetingInstructions,
    })
    .select("id, starts_at, ends_at, status")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "That time is no longer available." },
        { status: 409 }
      );
    }
    console.error("book POST:", error);
    return NextResponse.json({ error: "Could not create booking." }, { status: 500 });
  }

  const startDate = new Date(chosen.startsAt);
  const endDate = new Date(chosen.endsAt);
  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };

  let whereLabel = "Details by email";
  if (calendar.location_mode === "google_meet") {
    whereLabel = meetingJoinUrl ? "Google Meet" : "Google Meet (invite by email)";
  } else if (calendar.location_mode === "phone" && meetingPhone) {
    whereLabel = `Phone · ${meetingPhone}`;
  } else if (calendar.location_mode === "custom" && meetingInstructions) {
    whereLabel = meetingInstructions;
  }

  return NextResponse.json({
    id: booking?.id,
    starts_at: chosen.startsAt,
    ends_at: chosen.endsAt,
    status: "booked",
    display: {
      date: formatInTimeZone(startDate, prospectTz, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      time: formatInTimeZone(startDate, prospectTz, timeOpts),
      time_end: formatInTimeZone(endDate, prospectTz, timeOpts),
      time_range: `${formatInTimeZone(startDate, prospectTz, timeOpts)} - ${formatInTimeZone(endDate, prospectTz, timeOpts)}`,
      timezone: prospectTz,
      ymd: ymdInTimeZone(startDate, prospectTz),
    },
    coach_name: coach.displayName,
    title: calendar.name,
    guest_email: email,
    location: {
      type: calendar.location_mode,
      label: whereLabel,
      join_url: meetingJoinUrl,
      phone: meetingPhone,
      instructions: meetingInstructions,
    },
  });
}
