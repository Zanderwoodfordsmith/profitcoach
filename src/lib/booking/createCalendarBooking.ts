import { formatInTimeZone, isValidIanaTimeZone, ymdInTimeZone } from "@/lib/booking/bookingTime";
import { calendarToBookingSettings } from "@/lib/booking/coachCalendars";
import type { CoachCalendarRow } from "@/lib/booking/coachCalendars";
import {
  computeBookingSlots,
  slotSearchHorizonDays,
} from "@/lib/booking/computeBookingSlots";
import {
  loadBookingSettingsForCoach,
  loadExistingBookedIntervals,
} from "@/lib/booking/bookingService";
import { createUnipileBookingEvent, fetchUnipileBusyIntervals } from "@/lib/booking/unipileCalendar";
import {
  createZoomBookingMeeting,
  deleteZoomBookingMeeting,
} from "@/lib/booking/zoomMeetings";
import { sendBookingConfirmations } from "@/lib/messaging/bookingConfirmations";
import type { ProspectNextCall } from "@/lib/prospectNextCall";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const CLOSED_STATUSES = new Set(["won", "lost", "abandoned"]);

export type CreateCalendarBookingInput = {
  coach: { id: string; displayName: string };
  calendar: CoachCalendarRow;
  contactId: string | null;
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
  startsAt: string;
  prospectTimezone: string;
  notes?: string | null;
  /** When true, set the contact's prospect_status to booked (unless already closed). */
  markProspectBooked?: boolean;
  /** Coach booking their own calendar — skip public min-notice / advance window. */
  ignorePublicLimits?: boolean;
};

export type CreateCalendarBookingSuccess = {
  booking: { id: string; starts_at: string; ends_at: string; status: string };
  display: {
    date: string;
    time: string;
    time_end: string;
    time_range: string;
    timezone: string;
    ymd: string;
  };
  whereLabel: string;
  meetingJoinUrl: string | null;
  meetingPhone: string | null;
  meetingInstructions: string | null;
  next_call: ProspectNextCall;
};

export type CreateCalendarBookingResult =
  | { ok: true; data: CreateCalendarBookingSuccess }
  | { ok: false; status: number; error: string };

export async function createCalendarBooking(
  input: CreateCalendarBookingInput
): Promise<CreateCalendarBookingResult> {
  const { coach, calendar, guest } = input;
  const startsAt = input.startsAt.trim();
  const prospectTz = isValidIanaTimeZone(input.prospectTimezone)
    ? input.prospectTimezone
    : "UTC";

  if (!startsAt || Number.isNaN(Date.parse(startsAt))) {
    return { ok: false, status: 400, error: "Invalid starts_at." };
  }
  if (!calendar.is_enabled) {
    return { ok: false, status: 400, error: "This calendar is not enabled." };
  }

  const { settings: coachSettings, rules } = await loadBookingSettingsForCoach(
    coach.id
  );
  if (rules.length === 0) {
    return { ok: false, status: 400, error: "No availability configured." };
  }

  const settings = calendarToBookingSettings(calendar, coachSettings.timezone);
  const windowStart = new Date();
  const windowEnd = new Date(
    windowStart.getTime() +
      slotSearchHorizonDays({
        bookingWindowDays: settings.booking_window_days,
        ignorePublicLimits: input.ignorePublicLimits,
      }) *
        24 *
        60 *
        60 *
        1000
  );

  const [existing, googleBusy] = await Promise.all([
    loadExistingBookedIntervals(
      coach.id,
      windowStart.toISOString(),
      windowEnd.toISOString()
    ),
    fetchUnipileBusyIntervals({
      coachId: coach.id,
      timeMin: windowStart.toISOString(),
      timeMax: windowEnd.toISOString(),
    }),
  ]);

  const slots = computeBookingSlots({
    settings,
    rules,
    existing: [...existing, ...googleBusy],
    ignorePublicLimits: input.ignorePublicLimits,
  });
  const match = slots.find((s) => s.startsAt === new Date(startsAt).toISOString());
  const alt = slots.find(
    (s) => new Date(s.startsAt).getTime() === new Date(startsAt).getTime()
  );
  const chosen = match ?? alt;
  if (!chosen) {
    return { ok: false, status: 409, error: "That time is no longer available." };
  }

  const email = guest.email.trim().toLowerCase();
  const firstName = guest.firstName.trim();
  const lastName = guest.lastName.trim();
  const phone = guest.phone?.trim() || null;
  const guestName = `${firstName} ${lastName}`.trim() || "Guest";

  let meetingJoinUrl: string | null = null;
  let meetingPhone: string | null =
    calendar.location_mode === "phone" ? calendar.location_phone : null;
  let meetingInstructions: string | null =
    calendar.location_mode === "custom" ? calendar.location_custom : null;
  let googleEventId: string | null = null;
  let googleCalendarId: string | null = null;
  let zoomMeetingId: string | null = null;

  if (calendar.location_mode === "zoom") {
    const zoom = await createZoomBookingMeeting({
      coachId: coach.id,
      topic: `${calendar.name} with ${guestName}`,
      startsAt: chosen.startsAt,
      endsAt: chosen.endsAt,
    });
    if (!zoom) {
      return {
        ok: false,
        status: 400,
        error:
          "This calendar uses Zoom. Connect Zoom in Calls → Settings, then try again.",
      };
    }
    meetingJoinUrl = zoom.joinUrl;
    zoomMeetingId = zoom.meetingId;
  }

  const descriptionParts = [
    calendar.location_mode === "zoom" && meetingJoinUrl
      ? `Join: ${meetingJoinUrl}`
      : null,
    calendar.location_mode === "custom" && calendar.location_custom
      ? `Join: ${calendar.location_custom.trim()}`
      : null,
    calendar.location_mode === "phone" && calendar.location_phone
      ? `Call: ${calendar.location_phone}`
      : null,
    `${calendar.name} with ${coach.displayName}.`,
    `Guest: ${guestName}${email ? ` (${email})` : ""}`,
    phone ? `Phone: ${phone}` : null,
    input.notes?.trim() ? `About:\n${input.notes.trim()}` : null,
  ].filter(Boolean);

  const googleEvent = await createUnipileBookingEvent({
    coachId: coach.id,
    title: calendar.name,
    description: descriptionParts.join("\n"),
    startsAt: chosen.startsAt,
    endsAt: chosen.endsAt,
    guestEmail: email,
    guestName,
    timezone: coachSettings.timezone,
    locationMode:
      calendar.location_mode === "zoom" ? "custom" : calendar.location_mode,
    locationPhone: calendar.location_phone,
    locationCustom:
      calendar.location_mode === "zoom"
        ? meetingJoinUrl
        : calendar.location_custom,
  });

  if (googleEvent) {
    googleEventId = googleEvent.eventId;
    googleCalendarId = googleEvent.calendarId;
    if (googleEvent.hangoutLink && calendar.location_mode !== "zoom") {
      meetingJoinUrl = googleEvent.hangoutLink;
    }
  }

  if (
    calendar.location_mode === "custom" &&
    calendar.location_custom &&
    /^https?:\/\//i.test(calendar.location_custom.trim())
  ) {
    meetingJoinUrl = calendar.location_custom.trim();
  }

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .insert({
      coach_id: coach.id,
      calendar_id: calendar.id,
      contact_id: input.contactId,
      kind: calendar.slug,
      status: "booked",
      starts_at: chosen.startsAt,
      ends_at: chosen.endsAt,
      prospect_timezone: prospectTz,
      prospect_name: guestName,
      prospect_email: email || null,
      prospect_phone: phone,
      notes: input.notes?.trim() || null,
      google_event_id: googleEventId,
      google_calendar_id: googleCalendarId,
      zoom_meeting_id: zoomMeetingId,
      meeting_location_type: calendar.location_mode,
      meeting_join_url: meetingJoinUrl,
      meeting_phone: meetingPhone,
      meeting_instructions: meetingInstructions,
    })
    .select("id, starts_at, ends_at, status")
    .maybeSingle();

  if (error) {
    if (zoomMeetingId) {
      await deleteZoomBookingMeeting({
        coachId: coach.id,
        meetingId: zoomMeetingId,
      });
    }
    if (error.code === "23505") {
      return { ok: false, status: 409, error: "That time is no longer available." };
    }
    console.error("createCalendarBooking:", error);
    return { ok: false, status: 500, error: "Could not create booking." };
  }

  let whereLabel = "Details by email";
  if (calendar.location_mode === "google_meet") {
    whereLabel = meetingJoinUrl ? "Google Meet" : "Google Meet (invite by email)";
  } else if (calendar.location_mode === "zoom") {
    whereLabel = meetingJoinUrl ? "Zoom" : "Zoom (invite by email)";
  } else if (calendar.location_mode === "phone" && meetingPhone) {
    whereLabel = `Phone · ${meetingPhone}`;
  } else if (calendar.location_mode === "custom" && meetingJoinUrl) {
    whereLabel = "Zoom";
  } else if (calendar.location_mode === "custom" && meetingInstructions) {
    whereLabel = meetingInstructions;
  }

  if (booking?.id && email) {
    try {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
        coach.id
      );
      await sendBookingConfirmations({
        bookingId: booking.id as string,
        coachId: coach.id,
        coachName: coach.displayName,
        coachEmail: authUser.user?.email ?? null,
        contactId: input.contactId,
        calendarId: calendar.id,
        calendarTitle: calendar.name,
        prospectName: guestName,
        prospectEmail: email,
        prospectPhone: phone,
        startsAtIso: chosen.startsAt,
        endsAtIso: chosen.endsAt,
        timezone: prospectTz,
        locationLabel: whereLabel,
        meetingJoinUrl,
      });
    } catch (notifyErr) {
      console.error("booking confirmation notify:", notifyErr);
    }
  }

  if (input.markProspectBooked && input.contactId) {
    const { data: contact } = await supabaseAdmin
      .from("contacts")
      .select("prospect_status")
      .eq("id", input.contactId)
      .maybeSingle();
    const current = String(contact?.prospect_status ?? "").trim().toLowerCase();
    if (!CLOSED_STATUSES.has(current)) {
      await supabaseAdmin
        .from("contacts")
        .update({ prospect_status: "booked" })
        .eq("id", input.contactId)
        .eq("coach_id", coach.id);
    }
  }

  const startDate = new Date(chosen.startsAt);
  const endDate = new Date(chosen.endsAt);
  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };

  return {
    ok: true,
    data: {
      booking: {
        id: String(booking?.id ?? ""),
        starts_at: chosen.startsAt,
        ends_at: chosen.endsAt,
        status: "booked",
      },
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
      whereLabel,
      meetingJoinUrl,
      meetingPhone,
      meetingInstructions,
      next_call: {
        start_time: chosen.startsAt,
        status_normalized: "booked",
        calendar_name: calendar.name,
        title: calendar.name,
      },
    },
  };
}
