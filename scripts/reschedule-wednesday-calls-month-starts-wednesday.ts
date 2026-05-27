/**
 * @deprecated Superseded by day_after_ordinal_tuesday recurrence
 * (see scripts/apply-day-after-tuesday-recurrence.ts). Do not run.
 *
 * When the 1st of a month is a Wednesday, onboarding uses that day. Shift the
 * four ordinal-Wednesday community calls back 1 week for that month.
 *
 * Covers 2026–2029. Skips June 2026 (handled by reschedule-june-2026-wednesday-calls.ts).
 *
 * Run:    npx tsx scripts/reschedule-wednesday-calls-month-starts-wednesday.ts
 * Dry run: npx tsx scripts/reschedule-wednesday-calls-month-starts-wednesday.ts --dry-run
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";

loadEnvConfig(process.cwd());

import {
  COMMUNITY_CALENDAR_EVENT_SELECT,
  COMMUNITY_CALENDAR_EXCEPTION_SELECT,
} from "../src/lib/communityCalendarData";
import { expandCommunityCalendar } from "../src/lib/communityCalendarExpand";
import type {
  CommunityCalendarEventExceptionRow,
  CommunityCalendarEventRow,
  RecurrencePayload,
} from "../src/lib/communityCalendarTypes";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const START_YEAR = 2026;
const END_YEAR = 2029;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function isOrdinalWednesdaySeries(row: CommunityCalendarEventRow): boolean {
  if (!row.is_recurring || !row.recurrence) return false;
  const rec = row.recurrence as RecurrencePayload;
  return (
    rec.unit === "month" &&
    rec.monthMode === "ordinal_weekday" &&
    rec.monthWeekday === 2 &&
    typeof rec.monthOrdinal === "number" &&
    rec.monthOrdinal >= 1 &&
    rec.monthOrdinal <= 4
  );
}

function monthStartsOnWednesday(
  year: number,
  month: number,
  timezone: string
): boolean {
  return (
    DateTime.fromObject({ year, month, day: 1 }, { zone: timezone }).weekday ===
    3
  );
}

function occurrenceInMonth(
  startsAtIso: string,
  timezone: string,
  year: number,
  month: number
): boolean {
  const local = DateTime.fromISO(startsAtIso, { zone: "utc" }).setZone(timezone);
  return local.year === year && local.month === month;
}

async function main() {
  console.log(
    `[reschedule] Ordinal Wednesday calls −7 days when month starts on Wednesday (${START_YEAR}–${END_YEAR})${dryRun ? " (dry run)" : ""}…`
  );

  const [eventsResult, exceptionsResult] = await Promise.all([
    supabase
      .from("community_calendar_events")
      .select(COMMUNITY_CALENDAR_EVENT_SELECT)
      .order("starts_at", { ascending: true }),
    supabase
      .from("community_calendar_event_exceptions")
      .select(COMMUNITY_CALENDAR_EXCEPTION_SELECT),
  ]);

  if (eventsResult.error) throw eventsResult.error;
  if (exceptionsResult.error) throw exceptionsResult.error;

  const events = (eventsResult.data ?? []) as CommunityCalendarEventRow[];
  const exceptions = (exceptionsResult.data ??
    []) as CommunityCalendarEventExceptionRow[];

  const series = events.filter(isOrdinalWednesdaySeries);
  if (series.length === 0) {
    console.log("[reschedule] No ordinal-Wednesday recurring series found.");
    return;
  }

  const exceptionsForDiscovery = exceptions.map((ex) => ({
    ...ex,
    rescheduled_starts_at: null,
    rescheduled_ends_at: null,
  }));

  const rangeStart = DateTime.fromObject(
    { year: START_YEAR, month: 1, day: 1 },
    { zone: "utc" }
  ).startOf("day");
  const rangeEnd = DateTime.fromObject(
    { year: END_YEAR, month: 12, day: 31 },
    { zone: "utc" }
  ).endOf("day");

  let count = 0;

  for (const row of series) {
    const tz = row.display_timezone || "Europe/London";
    const naturalOccurrences = expandCommunityCalendar(
      [row],
      rangeStart,
      rangeEnd,
      exceptionsForDiscovery
    );

    for (let year = START_YEAR; year <= END_YEAR; year++) {
      for (let month = 1; month <= 12; month++) {
        // June 2026: +7 via reschedule-june-2026-wednesday-calls.ts
        // July 2026: +7 on natural ordinals via fix-july-2026-and-may-duplicate.ts
        if (year === 2026 && (month === 6 || month === 7)) continue;
        if (!monthStartsOnWednesday(year, month, tz)) continue;

        const monthOccurrences = naturalOccurrences.filter((occ) =>
          occurrenceInMonth(occ.startsAtIso, tz, year, month)
        );

        for (const occ of monthOccurrences) {
          const start = DateTime.fromISO(occ.startsAtIso, { zone: "utc" });
          const end = DateTime.fromISO(occ.endsAtIso, { zone: "utc" });
          const newStart = start.minus({ days: 7 });
          const newEnd = end.minus({ days: 7 });
          const local = start.setZone(tz);

          console.log(
            `  • ${occ.title} — ${local.toFormat("ccc d MMM yyyy")} → ${newStart
              .setZone(tz)
              .toFormat("ccc d MMM yyyy")}`
          );
          count++;

          if (dryRun) continue;

          const normalizedStart = DateTime.fromISO(occ.startsAtIso, {
            zone: "utc",
          }).toISO();
          if (!normalizedStart) {
            throw new Error(`Invalid occurrence start for ${occ.title}`);
          }

          const existing = exceptions.find(
            (ex) =>
              ex.event_id === occ.eventId &&
              DateTime.fromISO(ex.occurrence_start, { zone: "utc" }).toMillis() ===
                DateTime.fromISO(normalizedStart, { zone: "utc" }).toMillis()
          );

          const { error } = await supabase
            .from("community_calendar_event_exceptions")
            .upsert(
              {
                event_id: occ.eventId,
                occurrence_start: normalizedStart,
                rescheduled_starts_at: newStart.toISO(),
                rescheduled_ends_at: newEnd.toISO(),
                cancelled_at: null,
                cancellation_reason: null,
                recording_link_url: existing?.recording_link_url ?? null,
                recording_video_url: existing?.recording_video_url ?? null,
              },
              { onConflict: "event_id,occurrence_start" }
            );

          if (error) throw error;
        }
      }
    }
  }

  if (count === 0) {
    console.log("[reschedule] No matching occurrences found.");
  } else if (dryRun) {
    console.log(`[reschedule] Dry run complete — ${count} occurrence(s), no rows written.`);
  } else {
    console.log(`[reschedule] Done — ${count} occurrence(s) updated.`);
  }
}

main().catch((err) => {
  console.error("[reschedule] failed:", err);
  process.exit(1);
});
