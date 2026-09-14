import { NextResponse } from "next/server";
import { isValidIanaTimeZone } from "@/lib/booking/bookingTime";
import {
  loadCoachCalendarByPrimaryId,
  loadCoachDisplayName,
} from "@/lib/booking/bookingService";
import { createCalendarBooking } from "@/lib/booking/createCalendarBooking";
import {
  canAccessCoachResource,
  requireCoachOrAdmin,
} from "@/lib/booking/resolveCoachTarget";
import { splitFullName } from "@/lib/splitFullName";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type BookBody = {
  prospect_id?: string;
  calendar_id?: string;
  starts_at?: string;
  prospect_timezone?: string;
};

export async function POST(request: Request) {
  const auth = await requireCoachOrAdmin(request);
  if (auth.error || !auth.userId || !auth.role) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let body: BookBody;
  try {
    body = (await request.json()) as BookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const prospectId = body.prospect_id?.trim() ?? "";
  const calendarId = body.calendar_id?.trim() ?? "";
  const startsAt = body.starts_at?.trim() ?? "";
  if (!prospectId || !calendarId || !startsAt) {
    return NextResponse.json(
      { error: "prospect_id, calendar_id, and starts_at are required." },
      { status: 400 }
    );
  }

  const { data: contact } = await supabaseAdmin
    .from("contacts")
    .select("id, coach_id, type, full_name, first_name, last_name, email, phone")
    .eq("id", prospectId)
    .maybeSingle();

  const prospectCoachId =
    typeof contact?.coach_id === "string" ? contact.coach_id : "";
  if (
    !contact ||
    !prospectCoachId ||
    !canAccessCoachResource(auth, prospectCoachId)
  ) {
    return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
  }

  const calendar = await loadCoachCalendarByPrimaryId(calendarId);
  if (!calendar || !canAccessCoachResource(auth, calendar.coach_id)) {
    return NextResponse.json({ error: "Calendar not found." }, { status: 404 });
  }
  if (!calendar.is_enabled) {
    return NextResponse.json(
      { error: "This calendar is not enabled." },
      { status: 400 }
    );
  }
  const coachId = calendar.coach_id;

  const split = splitFullName(String(contact.full_name ?? ""));
  const firstName =
    (typeof contact.first_name === "string" && contact.first_name.trim()) ||
    split.first_name ||
    "Prospect";
  const lastName =
    (typeof contact.last_name === "string" && contact.last_name.trim()) ||
    split.last_name ||
    firstName;
  const email =
    typeof contact.email === "string" ? contact.email.trim().toLowerCase() : "";
  const phone =
    typeof contact.phone === "string" && contact.phone.trim()
      ? contact.phone.trim()
      : null;

  const tzRaw = body.prospect_timezone?.trim();
  const prospectTimezone = tzRaw && isValidIanaTimeZone(tzRaw) ? tzRaw : "UTC";
  const displayName = await loadCoachDisplayName(coachId);

  const result = await createCalendarBooking({
    coach: { id: coachId, displayName },
    calendar,
    contactId: contact.id as string,
    guest: { firstName, lastName, email, phone },
    startsAt,
    prospectTimezone,
    markProspectBooked: true,
    ignorePublicLimits: true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    id: result.data.booking.id,
    starts_at: result.data.booking.starts_at,
    ends_at: result.data.booking.ends_at,
    status: "booked",
    title: calendar.name,
    where_label: result.data.whereLabel,
    next_call: result.data.next_call,
  });
}
