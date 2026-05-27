export type CommunityCalendarLocationKind = "link" | "in_person";

/** Mon = 0 … Sun = 6 (matches UI checkboxes). */
export type WeekdayMon0Sun6 = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type MonthWeekOrdinal = 1 | 2 | 3 | 4 | 5 | -1;

export type RecurrencePayload = {
  interval: number;
  unit: "week" | "month";
  weekdays: WeekdayMon0Sun6[];
  monthMode?: "day_of_month" | "ordinal_weekday" | "day_after_ordinal_tuesday";
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
  access_tags?: string[];
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
  /** For rescheduled recurring occurrences, the original series slot (exception key). */
  seriesOccurrenceStartIso?: string;
  /** True when this occurrence was cancelled but kept visible on the calendar. */
  isCancelled?: boolean;
  cancellationReason?: string | null;
};

/** Per-occurrence overrides (cancellation, recording) for recurring events. */
export type CommunityCalendarEventExceptionRow = {
  id: string;
  event_id: string;
  occurrence_start: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  recording_link_url: string | null;
  recording_video_url: string | null;
  rescheduled_starts_at: string | null;
  rescheduled_ends_at: string | null;
  created_at: string;
};

export function communityCalendarExceptionOccurrenceStart(
  occurrence: Pick<
    CommunityCalendarOccurrence,
    "startsAtIso" | "seriesOccurrenceStartIso"
  >
): string {
  return occurrence.seriesOccurrenceStartIso ?? occurrence.startsAtIso;
}

export function isRecurringCommunityCalendarEvent(
  row: Pick<CommunityCalendarEventRow, "is_recurring" | "recurrence">
): boolean {
  return Boolean(row.is_recurring && row.recurrence);
}

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
