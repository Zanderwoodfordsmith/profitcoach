import { NextResponse } from "next/server";
import { loadBookingSettingsForCoach, loadCoachBySlug, loadCoachCalendarBySlug } from "@/lib/booking/bookingService";
import { clampBookingDurationMinutes } from "@/lib/booking/directBookingSlot";
import { loadCalendarSlotDays } from "@/lib/booking/loadCalendarSlotDays";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  isSupportCallHostSlug,
  SUPPORT_CALL_CALENDAR_SLUG,
} from "@/lib/support/supportCallHosts";

export const runtime = "nodejs";

/** Open support-call times for a host, ignoring the public booking window. */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { slug } = await context.params;
  if (!isSupportCallHostSlug(slug)) {
    return NextResponse.json({ error: "Unknown support host." }, { status: 400 });
  }

  const coach = await loadCoachBySlug(slug);
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

  const url = new URL(request.url);
  const durationRaw = Number(url.searchParams.get("duration"));
  const durationMinutes = clampBookingDurationMinutes(
    Number.isFinite(durationRaw) ? durationRaw : undefined,
    calendar.meeting_duration_minutes
  );

  const { settings } = await loadBookingSettingsForCoach(coach.id);
  const loaded = await loadCalendarSlotDays({
    calendar,
    displayTimezone: settings.timezone,
    ignorePublicLimits: true,
    durationMinutes,
  });

  return NextResponse.json({
    timezone: loaded.coachTimezone,
    duration_minutes: loaded.durationMinutes,
    default_duration_minutes: calendar.meeting_duration_minutes,
    days: loaded.days,
  });
}
