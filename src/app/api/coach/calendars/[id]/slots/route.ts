import { NextResponse } from "next/server";
import { isValidIanaTimeZone } from "@/lib/booking/bookingTime";
import { loadCoachCalendarByPrimaryId } from "@/lib/booking/bookingService";
import { loadCalendarSlotDays } from "@/lib/booking/loadCalendarSlotDays";
import {
  canAccessCoachResource,
  requireCoachOrAdmin,
} from "@/lib/booking/resolveCoachTarget";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireCoachOrAdmin(request);
  if (auth.error || !auth.userId || !auth.role) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await params;
  const calendar = await loadCoachCalendarByPrimaryId(id ?? "");
  if (!calendar || !canAccessCoachResource(auth, calendar.coach_id)) {
    return NextResponse.json({ error: "Calendar not found." }, { status: 404 });
  }

  if (!calendar.is_enabled) {
    return NextResponse.json({
      enabled: false,
      days: [],
      duration_minutes: calendar.meeting_duration_minutes,
      title: calendar.name,
    });
  }

  const url = new URL(request.url);
  const tzParam = url.searchParams.get("tz")?.trim() || "UTC";
  const displayTimezone = isValidIanaTimeZone(tzParam) ? tzParam : "UTC";
  const loaded = await loadCalendarSlotDays({
    calendar,
    displayTimezone,
    ignorePublicLimits: true,
  });

  return NextResponse.json({
    enabled: true,
    coach_timezone: loaded.coachTimezone,
    timezone: loaded.displayTimezone,
    duration_minutes: loaded.durationMinutes,
    title: loaded.title,
    days: loaded.days,
  });
}
