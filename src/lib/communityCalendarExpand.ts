import { DateTime } from "luxon";

import type {
  CommunityCalendarEventExceptionRow,
  CommunityCalendarEventRow,
  CommunityCalendarOccurrence,
  MonthWeekOrdinal,
  RecurrencePayload,
} from "@/lib/communityCalendarTypes";
import { communityCalendarOccurrenceKey } from "@/lib/communityCalendarTypes";

function luxonToMon0Sun6(weekday: number): number {
  return (weekday + 6) % 7;
}

/** Monday 00:00 in the same calendar week as `dt` (Luxon weekday Mon=1…Sun=7). */
export function communityCalendarMondayStart(dt: DateTime): DateTime {
  const d = dt.startOf("day");
  return d.minus({ days: luxonToMon0Sun6(d.weekday) });
}

function mondayStart(dt: DateTime): DateTime {
  return communityCalendarMondayStart(dt);
}

function parseRecurrence(row: CommunityCalendarEventRow): RecurrencePayload | null {
  if (!row.is_recurring || !row.recurrence) return null;
  const r = row.recurrence as RecurrencePayload;
  if (!r || typeof r !== "object") return null;
  return r;
}

function endOfRecurrenceDay(
  rec: RecurrencePayload,
  zone: string
): DateTime | null {
  if (rec.end !== "on" || !rec.endDate) return null;
  const parts = rec.endDate.split("-").map((x) => Number(x));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return DateTime.fromObject(
    { year: parts[0], month: parts[1], day: parts[2] },
    { zone }
  ).endOf("day");
}

function matchesWeekRecurrence(
  startInst: DateTime,
  anchor: DateTime,
  rec: RecurrencePayload
): boolean {
  const interval = Math.max(1, Math.floor(rec.interval));
  const wd = luxonToMon0Sun6(startInst.weekday);
  if (!rec.weekdays?.includes(wd as (typeof rec.weekdays)[number])) return false;
  const w0 = mondayStart(anchor);
  const w1 = mondayStart(startInst);
  const weeks = Math.round(w1.diff(w0, "weeks").weeks);
  if (weeks < 0) return false;
  return weeks % interval === 0;
}

function weekdayOrdinalInMonth(dt: DateTime): number {
  return Math.floor((dt.day - 1) / 7) + 1;
}

function matchesMonthWeekOrdinal(
  startInst: DateTime,
  ordinal: MonthWeekOrdinal
): boolean {
  const ord = monthWeekOrdinal(startInst);
  if (ordinal === -1) return ord === -1;
  if (ord === ordinal) return true;
  // e.g. 4th Wed when that week is the last in the month (monthWeekOrdinal → -1)
  return ord === -1 && weekdayOrdinalInMonth(startInst) === ordinal;
}

/** Nth Tuesday (1-based) in the same calendar month as `dt`. Luxon weekday Tue = 2. */
export function nthTuesdayOfMonth(
  dt: DateTime,
  ordinal: MonthWeekOrdinal
): DateTime | null {
  if (ordinal < 1) return null;
  let count = 0;
  let day = dt.startOf("month");
  const last = dt.endOf("month").startOf("day");
  while (day <= last) {
    if (day.weekday === 2) {
      count++;
      if (count === ordinal) return day;
    }
    day = day.plus({ days: 1 });
  }
  return null;
}

/** Wednesday immediately after the Nth Tuesday of the month, at anchor time. */
export function dayAfterNthTuesdayOfMonth(
  year: number,
  month: number,
  ordinal: MonthWeekOrdinal,
  anchor: DateTime,
  zone: string
): DateTime | null {
  const nthTue = nthTuesdayOfMonth(
    DateTime.fromObject({ year, month, day: 1 }, { zone }),
    ordinal
  );
  if (!nthTue) return null;
  return nthTue.plus({ days: 1 }).set({
    hour: anchor.hour,
    minute: anchor.minute,
    second: anchor.second,
    millisecond: anchor.millisecond,
  });
}

function monthWeekOrdinal(dt: DateTime): number {
  const nth = Math.floor((dt.day - 1) / 7) + 1;
  if (dt.plus({ days: 7 }).month !== dt.month) return -1;
  return nth;
}

function monthOccurrenceAt(
  year: number,
  month: number,
  anchor: DateTime,
  rec: RecurrencePayload,
  zone: string
): DateTime | null {
  if (rec.monthMode === "day_after_ordinal_tuesday") {
    const ordinal =
      rec.monthOrdinal ?? (monthWeekOrdinal(anchor) as MonthWeekOrdinal);
    return dayAfterNthTuesdayOfMonth(year, month, ordinal, anchor, zone);
  }
  if (rec.monthMode === "ordinal_weekday") {
    const weekday =
      rec.monthWeekday ??
      (luxonToMon0Sun6(anchor.weekday) as 0 | 1 | 2 | 3 | 4 | 5 | 6);
    const ordinal =
      rec.monthOrdinal ?? (monthWeekOrdinal(anchor) as MonthWeekOrdinal);
    let day = DateTime.fromObject({ year, month, day: 1 }, { zone }).startOf(
      "day"
    );
    const last = day.endOf("month").startOf("day");
    while (day <= last) {
      if (
        luxonToMon0Sun6(day.weekday) === weekday &&
        matchesMonthWeekOrdinal(day, ordinal)
      ) {
        return day.set({
          hour: anchor.hour,
          minute: anchor.minute,
          second: anchor.second,
          millisecond: anchor.millisecond,
        });
      }
      day = day.plus({ days: 1 });
    }
    return null;
  }
  const candidate = DateTime.fromObject(
    {
      year,
      month,
      day: anchor.day,
      hour: anchor.hour,
      minute: anchor.minute,
      second: anchor.second,
      millisecond: anchor.millisecond,
    },
    { zone }
  );
  return candidate.isValid ? candidate : null;
}

/** Buffer so rescheduled occurrences just outside the visible range are still found. */
const RECURRENCE_RESCHEDULE_BUFFER_DAYS = 45;

function collectRecurringStarts(
  anchor: DateTime,
  rec: RecurrencePayload,
  zone: string,
  rangeStart: DateTime,
  rangeEnd: DateTime
): DateTime[] {
  const scanStart = DateTime.max(
    anchor.startOf("day"),
    rangeStart.minus({ days: RECURRENCE_RESCHEDULE_BUFFER_DAYS }).startOf("day")
  );
  const scanEnd = rangeEnd
    .plus({ days: RECURRENCE_RESCHEDULE_BUFFER_DAYS })
    .endOf("day");
  const endDay = endOfRecurrenceDay(rec, zone);
  const effectiveEnd = endDay ? DateTime.min(scanEnd, endDay) : scanEnd;
  const maxOcc =
    rec.end === "after" && rec.maxOccurrences
      ? Math.max(1, Math.floor(rec.maxOccurrences))
      : null;
  const interval = Math.max(1, Math.floor(rec.interval));

  if (rec.unit === "month") {
    const out: DateTime[] = [];
    let cursor = scanStart.startOf("month");
    while (cursor <= effectiveEnd) {
      const startInst = monthOccurrenceAt(
        cursor.year,
        cursor.month,
        anchor,
        rec,
        zone
      );
      if (startInst && startInst >= anchor && startInst <= effectiveEnd) {
        const months = Math.round(
          startInst
            .startOf("month")
            .diff(anchor.startOf("month"), "months").months
        );
        if (months >= 0 && months % interval === 0) {
          out.push(startInst);
          if (maxOcc && out.length >= maxOcc) break;
        }
      }
      cursor = cursor.plus({ months: 1 });
    }
    return out;
  }

  const out: DateTime[] = [];
  let day = scanStart.startOf("day");
  while (day <= effectiveEnd) {
    const startInst = day.set({
      hour: anchor.hour,
      minute: anchor.minute,
      second: anchor.second,
      millisecond: anchor.millisecond,
    });
    if (
      startInst.isValid &&
      startInst >= anchor &&
      matchesWeekRecurrence(startInst, anchor, rec)
    ) {
      out.push(startInst);
      if (maxOcc && out.length >= maxOcc) break;
    }
    day = day.plus({ days: 1 });
  }
  return out;
}

/** Occurrences overlapping [rangeStart, rangeEnd] (inclusive). */
export function filterCommunityCalendarOccurrencesInRange(
  occurrences: CommunityCalendarOccurrence[],
  rangeStart: DateTime,
  rangeEnd: DateTime
): CommunityCalendarOccurrence[] {
  const rs = rangeStart.toUTC().toMillis();
  const re = rangeEnd.toUTC().toMillis();
  return occurrences.filter((o) => {
    const s = Date.parse(o.startsAtIso);
    const e = Date.parse(o.endsAtIso);
    return e >= rs && s <= re;
  });
}

/**
 * Expands stored events into concrete occurrences overlapping [rangeStart, rangeEnd] (inclusive).
 */
export function expandCommunityCalendar(
  rows: CommunityCalendarEventRow[],
  rangeStart: DateTime,
  rangeEnd: DateTime,
  exceptions: CommunityCalendarEventExceptionRow[] = []
): CommunityCalendarOccurrence[] {
  const exceptionByKey = new Map<
    string,
    {
      isCancelled: boolean;
      cancellationReason: string | null;
      recordingLinkUrl: string | null;
      recordingVideoUrl: string | null;
      rescheduledStartsAt: string | null;
      rescheduledEndsAt: string | null;
    }
  >();
  for (const ex of exceptions) {
    exceptionByKey.set(communityCalendarOccurrenceKey(ex.event_id, ex.occurrence_start), {
      isCancelled: Boolean(ex.cancelled_at),
      cancellationReason: ex.cancellation_reason?.trim() || null,
      recordingLinkUrl: ex.recording_link_url ?? null,
      recordingVideoUrl: ex.recording_video_url ?? null,
      rescheduledStartsAt: ex.rescheduled_starts_at ?? null,
      rescheduledEndsAt: ex.rescheduled_ends_at ?? null,
    });
  }

  function occurrenceFields(
    row: CommunityCalendarEventRow,
    occurrenceKey: string,
    isRecurringSeries: boolean
  ): Pick<
    CommunityCalendarOccurrence,
    | "recording_link_url"
    | "recording_video_url"
    | "isCancelled"
    | "cancellationReason"
  > {
    const ex = exceptionByKey.get(occurrenceKey);
    const isCancelled = ex?.isCancelled ?? false;
    if (isRecurringSeries) {
      return {
        recording_link_url: ex?.recordingLinkUrl ?? null,
        recording_video_url: ex?.recordingVideoUrl ?? null,
        isCancelled,
        cancellationReason: ex?.cancellationReason ?? null,
      };
    }
    return {
      recording_link_url: ex?.recordingLinkUrl ?? row.recording_link_url,
      recording_video_url: ex?.recordingVideoUrl ?? row.recording_video_url,
      isCancelled,
      cancellationReason: ex?.cancellationReason ?? null,
    };
  }
  const out: CommunityCalendarOccurrence[] = [];
  const rs = rangeStart.toUTC();
  const re = rangeEnd.toUTC();

  for (const row of rows) {
    const zone = row.display_timezone || "UTC";
    const anchor = DateTime.fromISO(row.starts_at, { zone: "utc" }).setZone(zone);
    const endAnchor = DateTime.fromISO(row.ends_at, { zone: "utc" }).setZone(zone);
    const duration = endAnchor.diff(anchor);

    if (!anchor.isValid || !endAnchor.isValid || duration.as("milliseconds") <= 0) {
      continue;
    }

    const rec = parseRecurrence(row);

    if (!row.is_recurring || !rec) {
      const sUtc = anchor.toUTC();
      const eUtc = endAnchor.toUTC();
      const startsAtIso = sUtc.toISO()!;
      const occurrenceKey = communityCalendarOccurrenceKey(row.id, startsAtIso);
      const ex = exceptionByKey.get(occurrenceKey);

      if (ex?.rescheduledStartsAt && ex?.rescheduledEndsAt) {
        const rS = DateTime.fromISO(ex.rescheduledStartsAt, { zone: "utc" });
        const rE = DateTime.fromISO(ex.rescheduledEndsAt, { zone: "utc" });
        if (rE >= rs && rS <= re) {
          out.push({
            eventId: row.id,
            title: row.title,
            description: row.description,
            cover_image_url: row.cover_image_url,
            startsAtIso: ex.rescheduledStartsAt,
            endsAtIso: ex.rescheduledEndsAt,
            seriesOccurrenceStartIso: startsAtIso,
            display_timezone: row.display_timezone,
            location_kind: row.location_kind,
            location_url: row.location_url,
            ...occurrenceFields(row, occurrenceKey, false),
          });
        }
        continue;
      }

      if (eUtc >= rs && sUtc <= re) {
        out.push({
          eventId: row.id,
          title: row.title,
          description: row.description,
          cover_image_url: row.cover_image_url,
          startsAtIso,
          endsAtIso: eUtc.toISO()!,
          display_timezone: row.display_timezone,
          location_kind: row.location_kind,
          location_url: row.location_url,
          ...occurrenceFields(row, occurrenceKey, false),
        });
      }
      continue;
    }

    const starts = collectRecurringStarts(anchor, rec, zone, rangeStart, rangeEnd);
    for (const startInst of starts) {
      const sUtc = startInst.toUTC();
      const eUtc = startInst.plus(duration).toUTC();
      const startsAtIso = sUtc.toISO()!;
      const occurrenceKey = communityCalendarOccurrenceKey(row.id, startsAtIso);
      const ex = exceptionByKey.get(occurrenceKey);

      if (ex?.rescheduledStartsAt && ex?.rescheduledEndsAt) {
        const rS = DateTime.fromISO(ex.rescheduledStartsAt, { zone: "utc" });
        const rE = DateTime.fromISO(ex.rescheduledEndsAt, { zone: "utc" });
        if (rE >= rs && rS <= re) {
          out.push({
            eventId: row.id,
            title: row.title,
            description: row.description,
            cover_image_url: row.cover_image_url,
            startsAtIso: ex.rescheduledStartsAt,
            endsAtIso: ex.rescheduledEndsAt,
            seriesOccurrenceStartIso: startsAtIso,
            display_timezone: row.display_timezone,
            location_kind: row.location_kind,
            location_url: row.location_url,
            ...occurrenceFields(row, occurrenceKey, true),
          });
        }
        continue;
      }

      if (eUtc < rs || sUtc > re) continue;
      out.push({
        eventId: row.id,
        title: row.title,
        description: row.description,
        cover_image_url: row.cover_image_url,
        startsAtIso,
        endsAtIso: eUtc.toISO()!,
        display_timezone: row.display_timezone,
        location_kind: row.location_kind,
        location_url: row.location_url,
        ...occurrenceFields(row, occurrenceKey, true),
      });
    }
  }

  out.sort(
    (a, b) =>
      new Date(a.startsAtIso).getTime() - new Date(b.startsAtIso).getTime()
  );

  const recurringEventIds = new Set(
    rows
      .filter((row) => row.is_recurring && row.recurrence)
      .map((row) => row.id)
  );

  function localTitleDayKey(o: CommunityCalendarOccurrence): string {
    const zone = o.display_timezone || "UTC";
    const local = DateTime.fromISO(o.startsAtIso, { zone: "utc" }).setZone(zone);
    return `${o.title}|${local.toISODate() ?? ""}`;
  }

  const seenExact = new Set<string>();
  const bestByTitleDay = new Map<string, CommunityCalendarOccurrence>();

  for (const o of out) {
    const exactKey = communityCalendarOccurrenceKey(o.eventId, o.startsAtIso);
    if (seenExact.has(exactKey)) continue;
    seenExact.add(exactKey);

    const titleDayKey = localTitleDayKey(o);
    const existing = bestByTitleDay.get(titleDayKey);
    if (!existing) {
      bestByTitleDay.set(titleDayKey, o);
      continue;
    }

    const oRecurring = recurringEventIds.has(o.eventId);
    const existingRecurring = recurringEventIds.has(existing.eventId);
    if (oRecurring && !existingRecurring) {
      bestByTitleDay.set(titleDayKey, o);
    }
  }

  return [...bestByTitleDay.values()].sort(
    (a, b) =>
      new Date(a.startsAtIso).getTime() - new Date(b.startsAtIso).getTime()
  );
}

/** Whether `date` falls in the Mon–Sun week starting at `weekMonday`. */
export function isDateInCalendarWeek(
  weekMonday: DateTime,
  date: DateTime
): boolean {
  const start = communityCalendarMondayStart(weekMonday).startOf("day");
  const end = start.plus({ days: 6 }).endOf("day");
  const d = date.startOf("day");
  return d >= start && d <= end;
}

/** True when `now` is after the end of the last occurrence in the week. */
export function isPastLastEventInWeek(
  occurrences: CommunityCalendarOccurrence[],
  now: DateTime = DateTime.now()
): boolean {
  if (occurrences.length === 0) return false;

  const lastEndMs = Math.max(
    ...occurrences.map((o) =>
      DateTime.fromISO(o.endsAtIso, { zone: "utc" }).toMillis()
    )
  );
  return now.toUTC().toMillis() > lastEndMs;
}

/** @deprecated Use isPastLastEventInWeek */
export function isPastLastActiveEventInWeek(
  occurrences: CommunityCalendarOccurrence[],
  now?: DateTime
): boolean {
  return isPastLastEventInWeek(occurrences, now);
}
