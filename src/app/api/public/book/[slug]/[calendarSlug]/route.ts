import { NextResponse } from "next/server";
import { isValidIanaTimeZone } from "@/lib/booking/bookingTime";
import {
  findOrCreateProspectContact,
  loadBookingSettingsForCoach,
  loadCoachBySlug,
  loadCoachCalendarBySlug,
} from "@/lib/booking/bookingService";
import { createCalendarBooking } from "@/lib/booking/createCalendarBooking";

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

  const contactId = await findOrCreateProspectContact({
    coachId: coach.id,
    email,
    firstName,
    lastName,
    phone,
  });

  const result = await createCalendarBooking({
    coach,
    calendar,
    contactId,
    guest: { firstName, lastName, email, phone },
    startsAt,
    prospectTimezone: prospectTz,
    notes: body.notes,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    id: result.data.booking.id,
    starts_at: result.data.booking.starts_at,
    ends_at: result.data.booking.ends_at,
    status: "booked",
    display: result.data.display,
    coach_name: coach.displayName,
    title: calendar.name,
    guest_email: email,
    location: {
      type: calendar.location_mode,
      label: result.data.whereLabel,
      join_url: result.data.meetingJoinUrl,
      phone: result.data.meetingPhone,
      instructions: result.data.meetingInstructions,
    },
  });
}
