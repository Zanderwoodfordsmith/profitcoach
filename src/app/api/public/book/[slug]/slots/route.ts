import { NextResponse } from "next/server";
import { computeBookingSlots } from "@/lib/booking/computeBookingSlots";
import {
  formatInTimeZone,
  isValidIanaTimeZone,
  ymdInTimeZone,
} from "@/lib/booking/bookingTime";
import {
  loadBookingSettingsForCoach,
  loadCoachBySlug,
  loadExistingBookedIntervals,
} from "@/lib/booking/bookingService";

export async function GET(
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
    return NextResponse.json({
      enabled: false,
      slots: [],
      days: [],
    });
  }

  const url = new URL(request.url);
  const tzParam = url.searchParams.get("tz")?.trim() || "UTC";
  const prospectTz = isValidIanaTimeZone(tzParam) ? tzParam : "UTC";

  const now = new Date();
  const windowEnd = new Date(
    now.getTime() + (settings.booking_window_days + 2) * 24 * 60 * 60 * 1000
  );

  const existing = await loadExistingBookedIntervals(
    coach.id,
    now.toISOString(),
    windowEnd.toISOString()
  );

  const slots = computeBookingSlots({
    settings,
    rules,
    existing,
    now,
  });

  const daysMap = new Map<
    string,
    { starts_at: string; ends_at: string; label: string }[]
  >();

  for (const slot of slots) {
    const start = new Date(slot.startsAt);
    const ymd = ymdInTimeZone(start, prospectTz);
    const list = daysMap.get(ymd) ?? [];
    list.push({
      starts_at: slot.startsAt,
      ends_at: slot.endsAt,
      label: formatInTimeZone(start, prospectTz, {
        hour: "numeric",
        minute: "2-digit",
      }),
    });
    daysMap.set(ymd, list);
  }

  const days = Array.from(daysMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, daySlots]) => {
      const first = new Date(daySlots[0]!.starts_at);
      return {
        date,
        label: formatInTimeZone(first, prospectTz, {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
        slots: daySlots,
      };
    });

  return NextResponse.json({
    enabled: true,
    coach_timezone: settings.timezone,
    prospect_timezone: prospectTz,
    duration_minutes: settings.meeting_duration_minutes,
    title: settings.title,
    days,
  });
}
