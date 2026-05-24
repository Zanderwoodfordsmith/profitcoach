export type CommunityCalendarLocationKind = "link" | "in_person";

/** Mon = 0 … Sun = 6 (matches UI checkboxes). */
export type WeekdayMon0Sun6 = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type MonthWeekOrdinal = 1 | 2 | 3 | 4 | 5 | -1;

export type RecurrencePayload = {
  interval: number;
  unit: "week" | "month";
  weekdays: WeekdayMon0Sun6[];
  monthMode?: "day_of_month" | "ordinal_weekday";
  monthWeekday?: WeekdayMon0Sun6;
  monthOrdinal?: MonthWeekOrdinal;
  end: "never" | "on" | "after";
  /** yyyy-MM-dd interpreted in display_timezone */
  endDate?: string;
  maxOccurrences?: number;
};

export type CommunityCalendarEventRow = {
  id: string;
  created_by: string;
  title: string;
  description: string;
  cover_image_url: string | null;
  starts_at: string;
  ends_at: string;
  display_timezone: string;
  location_kind: CommunityCalendarLocationKind;
  location_url: string | null;
  recording_link_url: string | null;
  recording_video_url: string | null;
  is_recurring: boolean;
  recurrence: RecurrencePayload | null;
  created_at: string;
  updated_at: string;
};

export type CommunityCalendarOccurrence = {
  eventId: string;
  title: string;
  description: string;
  cover_image_url: string | null;
  startsAtIso: string;
  endsAtIso: string;
  display_timezone: string;
  location_kind: CommunityCalendarLocationKind;
  location_url: string | null;
  recording_link_url: string | null;
  recording_video_url: string | null;
  /** True when this occurrence was cancelled but kept visible on the calendar. */
  isCancelled?: boolean;
  cancellationReason?: string | null;
};

/** Cancelled/skipped instance of a recurring event. */
export type CommunityCalendarEventExceptionRow = {
  id: string;
  event_id: string;
  occurrence_start: string;
  cancellation_reason: string | null;
  created_at: string;
};

/** UTC epoch ms — avoids ISO string format mismatches from Postgres vs Luxon. */
export function communityCalendarOccurrenceStartMs(iso: string): number {
  return Date.parse(iso);
}

export function communityCalendarOccurrenceKey(
  eventId: string,
  startsAtIso: string
): string {
  return `${eventId}|${communityCalendarOccurrenceStartMs(startsAtIso)}`;
}

export function isActiveCommunityCalendarOccurrence(
  occurrence: CommunityCalendarOccurrence
): boolean {
  return !occurrence.isCancelled;
}
