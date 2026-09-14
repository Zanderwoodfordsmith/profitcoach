import {
  formatInTimeZone,
  isValidIanaTimeZone,
  ymdInTimeZone,
} from "@/lib/booking/bookingTime";
import { calendarToBookingSettings } from "@/lib/booking/coachCalendars";
import type { CoachCalendarRow } from "@/lib/booking/coachCalendars";
import {
  computeBookingSlots,
  slotSearchHorizonDays,
} from "@/lib/booking/computeBookingSlots";
import { loadBookingSettingsForCoach, loadExistingBookedIntervals } from "@/lib/booking/bookingService";
import { fetchUnipileBusyIntervals } from "@/lib/booking/unipileCalendar";

export type CalendarSlotDay = {
  date: string;
  label: string;
  slots: { starts_at: string; ends_at: string; label: string }[];
};

export async function loadCalendarSlotDays(input: {
  calendar: CoachCalendarRow;
  displayTimezone: string;
  /** Coach booking their own calendar — skip public min-notice / advance window. */
  ignorePublicLimits?: boolean;
}): Promise<{
  coachTimezone: string;
  displayTimezone: string;
  durationMinutes: number;
  title: string;
  days: CalendarSlotDay[];
}> {
  const { calendar } = input;
  const displayTimezone = isValidIanaTimeZone(input.displayTimezone)
    ? input.displayTimezone
    : "UTC";

  const { settings: coachSettings, rules } = await loadBookingSettingsForCoach(
    calendar.coach_id
  );
  const settings = calendarToBookingSettings(calendar, coachSettings.timezone);

  if (rules.length === 0) {
    return {
      coachTimezone: coachSettings.timezone,
      displayTimezone,
      durationMinutes: calendar.meeting_duration_minutes,
      title: calendar.name,
      days: [],
    };
  }

  const now = new Date();
  const windowEnd = new Date(
    now.getTime() +
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
      calendar.coach_id,
      now.toISOString(),
      windowEnd.toISOString()
    ),
    fetchUnipileBusyIntervals({
      coachId: calendar.coach_id,
      timeMin: now.toISOString(),
      timeMax: windowEnd.toISOString(),
    }),
  ]);

  const slots = computeBookingSlots({
    settings,
    rules,
    existing: [...existing, ...googleBusy],
    now,
    ignorePublicLimits: input.ignorePublicLimits,
  });

  const daysMap = new Map<
    string,
    { starts_at: string; ends_at: string; label: string }[]
  >();

  for (const slot of slots) {
    const start = new Date(slot.startsAt);
    const ymd = ymdInTimeZone(start, displayTimezone);
    const list = daysMap.get(ymd) ?? [];
    list.push({
      starts_at: slot.startsAt,
      ends_at: slot.endsAt,
      label: formatInTimeZone(start, displayTimezone, {
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
        label: formatInTimeZone(first, displayTimezone, {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
        slots: daySlots,
      };
    });

  return {
    coachTimezone: coachSettings.timezone,
    displayTimezone,
    durationMinutes: calendar.meeting_duration_minutes,
    title: calendar.name,
    days,
  };
}
