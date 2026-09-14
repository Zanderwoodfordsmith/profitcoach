import { NextResponse } from "next/server";
import { isValidIanaTimeZone } from "@/lib/booking/bookingTime";
import {
  loadCoachBySlug,
  loadCoachCalendarBySlug,
} from "@/lib/booking/bookingService";
import { loadCalendarSlotDays } from "@/lib/booking/loadCalendarSlotDays";

export async function GET(
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
    return NextResponse.json({
      enabled: false,
      slots: [],
      days: [],
    });
  }

  const url = new URL(request.url);
  const tzParam = url.searchParams.get("tz")?.trim() || "UTC";
  const prospectTz = isValidIanaTimeZone(tzParam) ? tzParam : "UTC";
  const loaded = await loadCalendarSlotDays({
    calendar,
    displayTimezone: prospectTz,
  });

  return NextResponse.json({
    enabled: true,
    coach_timezone: loaded.coachTimezone,
    prospect_timezone: loaded.displayTimezone,
    duration_minutes: loaded.durationMinutes,
    title: loaded.title,
    days: loaded.days,
  });
}
