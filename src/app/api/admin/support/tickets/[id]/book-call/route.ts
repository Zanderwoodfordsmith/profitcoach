import { NextResponse } from "next/server";
import {
  findOrCreateProspectContact,
  loadBookingSettingsForCoach,
  loadCoachBySlug,
  loadCoachCalendarBySlug,
} from "@/lib/booking/bookingService";
import { createCalendarBooking } from "@/lib/booking/createCalendarBooking";
import { clampBookingDurationMinutes } from "@/lib/booking/directBookingSlot";
import { requireAdmin } from "@/lib/requireAdmin";
import { loadTicketSupportCallContact } from "@/lib/support/supportCallPrefill";
import {
  isSupportCallHostSlug,
  SUPPORT_CALL_CALENDAR_SLUG,
  supportCallHostDisplayName,
} from "@/lib/support/supportCallHosts";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type BookBody = {
  host_slug?: string;
  starts_at?: string;
  duration_minutes?: number;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Book a support call for the person on this ticket.
 * Same calendar invite, confirmation, and reminders as a self-booking.
 * The start does not have to be on the public hours.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id: ticketId } = await context.params;
  if (!ticketId) {
    return NextResponse.json({ error: "Missing ticket id." }, { status: 400 });
  }

  let body: BookBody;
  try {
    body = (await request.json()) as BookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const hostSlug = body.host_slug?.trim().toLowerCase() ?? "";
  if (!isSupportCallHostSlug(hostSlug)) {
    return NextResponse.json({ error: "Unknown support host." }, { status: 400 });
  }
  const startsAt = body.starts_at?.trim() ?? "";
  if (!startsAt || Number.isNaN(Date.parse(startsAt))) {
    return NextResponse.json({ error: "Pick a date and time." }, { status: 400 });
  }

  const { data: ticket, error } = await supabaseAdmin
    .from("community_feedback_reports")
    .select("id, created_by, contact_email, submitter_name")
    .eq("id", ticketId)
    .maybeSingle();

  if (error || !ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  const contact = await loadTicketSupportCallContact({
    created_by: (ticket.created_by as string | null) ?? null,
    contact_email: (ticket.contact_email as string | null) ?? null,
    submitter_name: (ticket.submitter_name as string | null) ?? null,
  });

  const email = contact.email?.trim().toLowerCase() ?? "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "This ticket has no email address, so the invite can't be sent." },
      { status: 400 }
    );
  }

  const firstName = contact.firstName?.trim() || "Guest";
  const lastName = contact.lastName?.trim() || firstName;

  const coach = await loadCoachBySlug(hostSlug);
  if (!coach) {
    return NextResponse.json({ error: "Host not found." }, { status: 404 });
  }

  const calendar = await loadCoachCalendarBySlug(
    coach.id,
    SUPPORT_CALL_CALENDAR_SLUG
  );
  if (!calendar) {
    return NextResponse.json(
      { error: "Support calendar not found." },
      { status: 404 }
    );
  }

  const durationMinutes = clampBookingDurationMinutes(
    body.duration_minutes,
    calendar.meeting_duration_minutes
  );

  const { settings } = await loadBookingSettingsForCoach(coach.id);
  const contactId = await findOrCreateProspectContact({
    coachId: coach.id,
    email,
    firstName,
    lastName,
    phone: contact.phone,
  });

  const result = await createCalendarBooking({
    coach: { id: coach.id, displayName: coach.displayName },
    calendar,
    contactId,
    guest: {
      firstName,
      lastName,
      email,
      phone: contact.phone?.trim() || null,
    },
    startsAt,
    prospectTimezone: settings.timezone,
    allowUnlistedStart: true,
    durationMinutes,
    ignorePublicLimits: true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const hostName = supportCallHostDisplayName(hostSlug);
  const note = `Booked a ${durationMinutes}-minute support call with ${hostName} for ${result.data.display.date}, ${result.data.display.time_range} (${result.data.display.timezone}). Confirmation sent to ${email}.`;
  const { error: noteError } = await supabaseAdmin
    .from("support_ticket_internal_notes")
    .insert({
      report_id: ticketId,
      created_by: auth.userId,
      body: note,
      mentioned_user_ids: [],
    });
  if (noteError) {
    console.error("support book-call note:", noteError);
  }

  return NextResponse.json({
    id: result.data.booking.id,
    starts_at: result.data.booking.starts_at,
    ends_at: result.data.booking.ends_at,
    duration_minutes: durationMinutes,
    display: result.data.display,
    guest_email: email,
    host_name: hostName,
  });
}
