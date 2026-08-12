import {
  addDaysYmd,
  minutesToTime,
  parseTimeToMinutes,
  utcToZonedParts,
  ymdInTimeZone,
  zonedLocalToUtc,
} from "@/lib/booking/bookingTime";

export type BookingSettingsRow = {
  timezone: string;
  meeting_duration_minutes: number;
  buffer_minutes: number;
  min_notice_hours: number;
  booking_window_days: number;
  is_enabled: boolean;
  title: string;
  location_mode: "google_meet" | "phone" | "custom";
  location_phone: string | null;
  location_custom: string | null;
};

export type AvailabilityRuleRow = {
  weekday: number;
  start_time: string; // HH:MM:SS or HH:MM
  end_time: string;
};

export type ExistingBookingInterval = {
  starts_at: string | Date;
  ends_at: string | Date;
};

export type SlotOffer = {
  startsAt: string; // ISO UTC
  endsAt: string;
};

function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
  bufferMs: number
): boolean {
  const aS = aStart - bufferMs;
  const aE = aEnd + bufferMs;
  return aS < bEnd && aE > bStart;
}

/**
 * Calendar days to scan when collecting a rolling window of open days
 * (skips weekends / fully booked days). Capped at 90.
 */
export function bookingWindowLookaheadDays(bookingWindowDays: number): number {
  const n = Math.max(1, Math.floor(bookingWindowDays));
  return Math.min(90, Math.max(n * 4, n + 21));
}

/**
 * Compute bookable slots in UTC for a coach window.
 * Availability rule times are wall-clock in coach timezone.
 *
 * `booking_window_days` is a rolling count of days that still have at least
 * one open slot (not a raw calendar span from today). Late Friday with a
 * 3-day window and Mon–Fri rules → Mon/Tue/Wed, not Fri/Sat/Sun.
 */
export function computeBookingSlots(input: {
  settings: BookingSettingsRow;
  rules: AvailabilityRuleRow[];
  existing: ExistingBookingInterval[];
  /** Prospect/viewer timezone — only used to bound "today"; slots are absolute. */
  now?: Date;
}): SlotOffer[] {
  const now = input.now ?? new Date();
  const coachTz = input.settings.timezone;
  const durationMin = input.settings.meeting_duration_minutes;
  const bufferMs = input.settings.buffer_minutes * 60_000;
  const minNoticeMs = input.settings.min_notice_hours * 3_600_000;
  const earliestMs = now.getTime() + minNoticeMs;

  const openDaysTarget = Math.max(1, Math.floor(input.settings.booking_window_days));
  const coachToday = ymdInTimeZone(now, coachTz);
  const scanEndYmd = addDaysYmd(
    coachToday,
    bookingWindowLookaheadDays(openDaysTarget) - 1
  );

  const existingMs = input.existing.map((b) => {
    const s = new Date(b.starts_at).getTime();
    const e = new Date(b.ends_at).getTime();
    return { s, e };
  });

  const rulesByWeekday = new Map<number, AvailabilityRuleRow[]>();
  for (const rule of input.rules) {
    const list = rulesByWeekday.get(rule.weekday) ?? [];
    list.push(rule);
    rulesByWeekday.set(rule.weekday, list);
  }

  const slots: SlotOffer[] = [];
  let cursorYmd = coachToday;
  let openDaysFound = 0;

  while (cursorYmd <= scanEndYmd && openDaysFound < openDaysTarget) {
    const [y, m, d] = cursorYmd.split("-").map(Number);
    // Noon UTC probe to read weekday in coach TZ for this calendar date
    const probe = zonedLocalToUtc({
      year: y,
      month: m,
      day: d,
      hour: 12,
      minute: 0,
      timeZone: coachTz,
    });
    const weekday = utcToZonedParts(probe, coachTz).weekday;
    const dayRules = rulesByWeekday.get(weekday) ?? [];

    const daySlots: SlotOffer[] = [];
    for (const rule of dayRules) {
      const startMin = parseTimeToMinutes(rule.start_time.slice(0, 5));
      const endMin = parseTimeToMinutes(rule.end_time.slice(0, 5));
      for (
        let slotStart = startMin;
        slotStart + durationMin <= endMin;
        slotStart += durationMin
      ) {
        const { hour, minute } = minutesToTime(slotStart);
        const starts = zonedLocalToUtc({
          year: y,
          month: m,
          day: d,
          hour,
          minute,
          timeZone: coachTz,
        });
        const ends = new Date(starts.getTime() + durationMin * 60_000);
        if (starts.getTime() < earliestMs) continue;

        const taken = existingMs.some((ex) =>
          overlaps(starts.getTime(), ends.getTime(), ex.s, ex.e, bufferMs)
        );
        if (taken) continue;

        daySlots.push({
          startsAt: starts.toISOString(),
          endsAt: ends.toISOString(),
        });
      }
    }

    if (daySlots.length > 0) {
      slots.push(...daySlots);
      openDaysFound += 1;
    }

    cursorYmd = addDaysYmd(cursorYmd, 1);
  }

  return slots;
}

/** Mon–Fri 09:00–17:00 defaults when enabling booking with no rules. */
export const DEFAULT_WEEKDAY_AVAILABILITY: AvailabilityRuleRow[] = [
  { weekday: 1, start_time: "09:00", end_time: "17:00" },
  { weekday: 2, start_time: "09:00", end_time: "17:00" },
  { weekday: 3, start_time: "09:00", end_time: "17:00" },
  { weekday: 4, start_time: "09:00", end_time: "17:00" },
  { weekday: 5, start_time: "09:00", end_time: "17:00" },
];

export const DEFAULT_BOOKING_SETTINGS: Omit<
  BookingSettingsRow,
  "is_enabled"
> & { is_enabled: boolean } = {
  timezone: "Europe/London",
  meeting_duration_minutes: 15,
  buffer_minutes: 0,
  min_notice_hours: 24,
  booking_window_days: 14,
  is_enabled: false,
  title: "15-Minute Discovery Call",
  location_mode: "google_meet",
  location_phone: null,
  location_custom: null,
};
