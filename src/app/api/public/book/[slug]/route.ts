import { NextResponse } from "next/server";
import { computeBookingSlots } from "@/lib/booking/computeBookingSlots";
import { isValidIanaTimeZone } from "@/lib/booking/bookingTime";
import {
  findOrCreateProspectContact,
  loadBookingSettingsForCoach,
  loadCoachBySlug,
  loadExistingBookedIntervals,
} from "@/lib/booking/bookingService";
import { formatInTimeZone, ymdInTimeZone } from "@/lib/booking/bookingTime";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const coach = await loadCoachBySlug(slug ?? "");
  if (!coach) {
    return NextResponse.json({ error: "Coach not found." }, { status: 404 });
  }

  const { settings } = await loadBookingSettingsForCoach(coach.id);

  return NextResponse.json({
    slug: coach.slug,
    display_name: coach.displayName,
    is_enabled: settings.is_enabled,
    title: settings.title,
    timezone: settings.timezone,
    meeting_duration_minutes: settings.meeting_duration_minutes,
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
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const coach = await loadCoachBySlug(slug ?? "");
  if (!coach) {
    return NextResponse.json({ error: "Coach not found." }, { status: 404 });
  }

  const { settings, rules } = await loadBookingSettingsForCoach(coach.id);
  if (!settings.is_enabled) {
    return NextResponse.json(
      { error: "Booking is not enabled for this coach." },
      { status: 400 }
    );
  }
  if (rules.length === 0) {
    return NextResponse.json(
      { error: "No availability configured." },
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

  const windowStart = new Date();
  const windowEnd = new Date(
    windowStart.getTime() +
      (settings.booking_window_days + 2) * 24 * 60 * 60 * 1000
  );
  const existing = await loadExistingBookedIntervals(
    coach.id,
    windowStart.toISOString(),
    windowEnd.toISOString()
  );
  const slots = computeBookingSlots({
    settings,
    rules,
    existing,
  });
  const match = slots.find((s) => s.startsAt === new Date(startsAt).toISOString());
  if (!match) {
    // Also accept if starts_at string equals a slot after normalize
    const alt = slots.find(
      (s) => new Date(s.startsAt).getTime() === new Date(startsAt).getTime()
    );
    if (!alt) {
      return NextResponse.json(
        { error: "That time is no longer available." },
        { status: 409 }
      );
    }
  }

  const chosen =
    match ??
    slots.find(
      (s) => new Date(s.startsAt).getTime() === new Date(startsAt).getTime()
    )!;

  const contactId = await findOrCreateProspectContact({
    coachId: coach.id,
    email,
    firstName,
    lastName,
    phone,
  });

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .insert({
      coach_id: coach.id,
      contact_id: contactId,
      kind: "discovery",
      status: "booked",
      starts_at: chosen.startsAt,
      ends_at: chosen.endsAt,
      prospect_timezone: prospectTz,
      prospect_name: `${firstName} ${lastName}`.trim(),
      prospect_email: email,
      prospect_phone: phone,
      notes: body.notes?.trim() || null,
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
      time: formatInTimeZone(startDate, prospectTz, {
        hour: "numeric",
        minute: "2-digit",
      }),
      timezone: prospectTz,
      ymd: ymdInTimeZone(startDate, prospectTz),
    },
    coach_name: coach.displayName,
    title: settings.title,
  });
}
