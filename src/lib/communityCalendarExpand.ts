import { DateTime } from "luxon";

import type {
  CommunityCalendarEventRow,
  CommunityCalendarOccurrence,
  MonthWeekOrdinal,
  RecurrencePayload,
} from "@/lib/communityCalendarTypes";

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
  rangeEnd: DateTime
): CommunityCalendarOccurrence[] {
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
        out.push({
          eventId: row.id,
          title: row.title,
          description: row.description,
          cover_image_url: row.cover_image_url,
          startsAtIso: sUtc.toISO()!,
          endsAtIso: eUtc.toISO()!,
          display_timezone: row.display_timezone,
          location_kind: row.location_kind,
          location_url: row.location_url,
        });
      }
      continue;
    }

    const starts = collectRecurringStarts(anchor, rec, zone);
    for (const startInst of starts) {
      const sUtc = startInst.toUTC();
      const eUtc = startInst.plus(duration).toUTC();
      if (eUtc < rs || sUtc > re) continue;
      out.push({
        eventId: row.id,
        title: row.title,
        description: row.description,
        cover_image_url: row.cover_image_url,
        startsAtIso: sUtc.toISO()!,
        endsAtIso: eUtc.toISO()!,
        display_timezone: row.display_timezone,
        location_kind: row.location_kind,
        location_url: row.location_url,
      });
    }
  }

  out.sort(
    (a, b) =>
      new Date(a.startsAtIso).getTime() - new Date(b.startsAtIso).getTime()
  );

  const seen = new Set<string>();
  return out.filter((o) => {
    const k = `${o.eventId}|${o.startsAtIso}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
