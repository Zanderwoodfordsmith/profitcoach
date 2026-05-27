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

function matchesMonthRecurrence(
  startInst: DateTime,
  anchor: DateTime,
  rec: RecurrencePayload
): boolean {
  const interval = Math.max(1, Math.floor(rec.interval));
  const months = Math.round(
    startInst.startOf("month").diff(anchor.startOf("month"), "months").months
  );
  if (months < 0) return false;
  if (months % interval !== 0) return false;
  if (rec.monthMode === "ordinal_weekday") {
    const weekday =
      rec.monthWeekday ?? (luxonToMon0Sun6(anchor.weekday) as 0 | 1 | 2 | 3 | 4 | 5 | 6);
    const ordinal = rec.monthOrdinal ?? (monthWeekOrdinal(anchor) as MonthWeekOrdinal);
    const startWeekday = luxonToMon0Sun6(startInst.weekday);
    if (startWeekday !== weekday) return false;
    return monthWeekOrdinal(startInst) === ordinal;
  }
  return startInst.day === anchor.day;
}

function monthWeekOrdinal(dt: DateTime): number {
  const nth = Math.floor((dt.day - 1) / 7) + 1;
  if (dt.plus({ days: 7 }).month !== dt.month) return -1;
  return nth;
}

function collectRecurringStarts(
  anchor: DateTime,
  rec: RecurrencePayload,
  zone: string
): DateTime[] {
  const out: DateTime[] = [];
  const endDay = endOfRecurrenceDay(rec, zone);
  const maxOcc =
    rec.end === "after" && rec.maxOccurrences
      ? Math.max(1, Math.floor(rec.maxOccurrences))
      : null;

  let day = anchor.startOf("day");
  const hardStop = anchor.plus({ years: 3 });

  while (day <= hardStop) {
    if (endDay && day > endDay.endOf("day")) break;

    const startInst = day.set({
      hour: anchor.hour,
      minute: anchor.minute,
      second: anchor.second,
      millisecond: anchor.millisecond,
    });
    if (!startInst.isValid) {
      day = day.plus({ days: 1 });
      continue;
    }
    if (startInst < anchor) {
      day = day.plus({ days: 1 });
      continue;
    }

    const ok =
      rec.unit === "month"
        ? matchesMonthRecurrence(startInst, anchor, rec)
        : matchesWeekRecurrence(startInst, anchor, rec);

    if (ok) {
      out.push(startInst);
      if (maxOcc && out.length >= maxOcc) break;
    }

    day = day.plus({ days: 1 });
  }

  return out;
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
    }
  >();
  for (const ex of exceptions) {
    exceptionByKey.set(communityCalendarOccurrenceKey(ex.event_id, ex.occurrence_start), {
      isCancelled: Boolean(ex.cancelled_at),
      cancellationReason: ex.cancellation_reason?.trim() || null,
      recordingLinkUrl: ex.recording_link_url ?? null,
      recordingVideoUrl: ex.recording_video_url ?? null,
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
      if (eUtc >= rs && sUtc <= re) {
        const startsAtIso = sUtc.toISO()!;
        const occurrenceKey = communityCalendarOccurrenceKey(row.id, startsAtIso);
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

    const starts = collectRecurringStarts(anchor, rec, zone);
    for (const startInst of starts) {
      const sUtc = startInst.toUTC();
      const eUtc = startInst.plus(duration).toUTC();
      if (eUtc < rs || sUtc > re) continue;
      const startsAtIso = sUtc.toISO()!;
      const occurrenceKey = communityCalendarOccurrenceKey(row.id, startsAtIso);
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

  const seen = new Set<string>();
  return out.filter((o) => {
    const k = communityCalendarOccurrenceKey(o.eventId, o.startsAtIso);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
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
