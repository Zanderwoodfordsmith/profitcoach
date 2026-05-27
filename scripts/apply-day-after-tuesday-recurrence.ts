/**
 * Apply day-after-Nth-Tuesday recurrence for coach community calls and clean up
 * obsolete reschedule exceptions from the old ordinal-Wednesday + month-starts-Wednesday rules.
 *
 * Keeps June 2026 onboarding shift (onboarding moved from 2 Jun to 9 Jun → calls +7 days).
 *
 * Run:    npx tsx scripts/apply-day-after-tuesday-recurrence.ts
 * Dry run: npx tsx scripts/apply-day-after-tuesday-recurrence.ts --dry-run
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
const TZ = "Europe/London";

const COACH_CALL_SERIES_IDS = [
  "c34272d5-3d65-47ec-9c29-b3bfae873fa5",
  "b984aa29-a933-4860-9c0b-c4ae7b65f67e",
  "e6e94321-092d-4a59-abd8-85ee3e34b647",
  "e5e5dc41-39a0-4cd8-8245-946cddea1704",
] as const;

const COACH_CALL_TITLES = [
  "COACH Certification",
  "Lead Engine",
  "Signing Clients",
  "Coaching Delivery",
] as const;

const KNOWN_DUPLICATE_ONE_OFF_IDS = [
  "5d8048d7-c747-49ae-9db2-20cc353db296",
  "0750f06a-3ce8-4c77-af88-e82ffd7e5e80",
  "f74b2463-ce66-48c6-8244-014c74f2c75d",
  "b7f0082e-c034-4392-93c0-8ab960e10df7",
  "ed3a5920-fabd-495d-8211-752f4263ced6",
] as const;

/** June 2026 onboarding shift — occurrence_start keys at 13:00 Europe/London. */
const JUNE_2026_ONBOARDING: Array<{
  eventId: string;
  occurrenceDay: number;
  targetDay: number;
  targetMonth?: number;
}> = [
  { eventId: COACH_CALL_SERIES_IDS[0], occurrenceDay: 3, targetDay: 10 },
  { eventId: COACH_CALL_SERIES_IDS[1], occurrenceDay: 10, targetDay: 17 },
  { eventId: COACH_CALL_SERIES_IDS[2], occurrenceDay: 17, targetDay: 24 },
  {
    eventId: COACH_CALL_SERIES_IDS[3],
    occurrenceDay: 24,
    targetDay: 1,
    targetMonth: 7,
  },
];

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function londonSlot(year: number, month: number, day: number) {
  const start = DateTime.fromObject(
    { year, month, day, hour: 13, minute: 0 },
    { zone: TZ }
  );
  const end = start.plus({ hours: 2 });
  return { start: start.toUTC().toISO()!, end: end.toUTC().toISO()! };
}

function occurrenceStartMs(iso: string): number {
  return Date.parse(iso);
}

function isJune2026OnboardingException(
  eventId: string,
  occurrenceStart: string
): boolean {
  const ms = occurrenceStartMs(occurrenceStart);
  return JUNE_2026_ONBOARDING.some((row) => {
    const natural = londonSlot(2026, 6, row.occurrenceDay);
    return row.eventId === eventId && occurrenceStartMs(natural.start) === ms;
  });
}

async function main() {
  console.log(
    `[apply] day-after-Nth-Tuesday recurrence${dryRun ? " (dry run)" : ""}…`
  );

  for (const id of COACH_CALL_SERIES_IDS) {
    const { data: row, error: fetchError } = await supabase
      .from("community_calendar_events")
      .select("recurrence")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    const rec = (row?.recurrence ?? {}) as RecurrencePayload;
    const next: RecurrencePayload = {
      ...rec,
      monthMode: "day_after_ordinal_tuesday",
    };
    delete next.monthWeekday;

    console.log(`  • Update recurrence for ${id.slice(0, 8)}…`);
    if (!dryRun) {
      const { error } = await supabase
        .from("community_calendar_events")
        .update({ recurrence: next })
        .eq("id", id);
      if (error) throw error;
    }
  }

  console.log("  • Remove duplicate one-off coach call events");
  const { data: oneOffRows, error: oneOffError } = await supabase
    .from("community_calendar_events")
    .select(COMMUNITY_CALENDAR_EVENT_SELECT)
    .eq("is_recurring", false)
    .in("title", [...COACH_CALL_TITLES]);
  if (oneOffError) throw oneOffError;

  const { data: seriesRows, error: seriesError } = await supabase
    .from("community_calendar_events")
    .select(COMMUNITY_CALENDAR_EVENT_SELECT)
    .in("id", [...COACH_CALL_SERIES_IDS]);
  if (seriesError) throw seriesError;

  const series = (seriesRows ?? []) as CommunityCalendarEventRow[];
  const rangeStart = DateTime.fromObject({ year: 2026, month: 1, day: 1 }, { zone: "utc" });
  const rangeEnd = DateTime.fromObject({ year: 2029, month: 12, day: 31 }, { zone: "utc" }).endOf(
    "day"
  );
  const seriesOccurrences = expandCommunityCalendar(series, rangeStart, rangeEnd, []);

  const seriesDayKeys = new Set<string>();
  for (const occ of seriesOccurrences) {
    const d = DateTime.fromISO(occ.startsAtIso, { zone: "utc" }).setZone(TZ);
    seriesDayKeys.add(`${occ.title}|${d.toISODate()}`);
  }

  const oneOffIdsToDelete = new Set<string>(KNOWN_DUPLICATE_ONE_OFF_IDS);
  for (const row of oneOffRows ?? []) {
    const d = DateTime.fromISO(row.starts_at, { zone: "utc" }).setZone(TZ);
    const key = `${row.title}|${d.toISODate()}`;
    if (seriesDayKeys.has(key)) oneOffIdsToDelete.add(row.id);
  }

  for (const id of oneOffIdsToDelete) {
    const row = (oneOffRows ?? []).find((r) => r.id === id);
    console.log(`    - ${id.slice(0, 8)}${row ? ` (${row.title})` : ""}`);
    if (dryRun) continue;
    const { error } = await supabase.from("community_calendar_events").delete().eq("id", id);
    if (error) throw error;
  }

  const { data: exceptions, error: exError } = await supabase
    .from("community_calendar_event_exceptions")
    .select(COMMUNITY_CALENDAR_EXCEPTION_SELECT);
  if (exError) throw exError;

  const toDelete = (exceptions ?? []).filter((ex) => {
    if (ex.rescheduled_starts_at && isJune2026OnboardingException(ex.event_id, ex.occurrence_start)) {
      return false;
    }
    if (ex.rescheduled_starts_at) return true;
    if (ex.cancelled_at && ex.cancellation_reason?.includes("June 2026")) return true;
    return false;
  });

  if (toDelete.length > 0) {
    console.log(`  • Remove ${toDelete.length} stale exception(s)`);
    for (const ex of toDelete) {
      console.log(`    - ${ex.id.slice(0, 8)}`);
      if (!dryRun) {
        const { error } = await supabase
          .from("community_calendar_event_exceptions")
          .delete()
          .eq("id", ex.id);
        if (error) throw error;
      }
    }
  }

  console.log("  • June 2026 onboarding shift");
  for (const row of JUNE_2026_ONBOARDING) {
    const natural = londonSlot(2026, 6, row.occurrenceDay);
    const target = londonSlot(2026, row.targetMonth ?? 6, row.targetDay);
    console.log(
      `    ${DateTime.fromISO(natural.start, { zone: "utc" })
        .setZone(TZ)
        .toFormat("d MMM")} → ${DateTime.fromISO(target.start, { zone: "utc" })
        .setZone(TZ)
        .toFormat("d Mmm")}`
    );
    if (dryRun) continue;
    const { error } = await supabase
      .from("community_calendar_event_exceptions")
      .upsert(
        {
          event_id: row.eventId,
          occurrence_start: natural.start,
          rescheduled_starts_at: target.start,
          rescheduled_ends_at: target.end,
          cancelled_at: null,
          cancellation_reason: null,
        },
        { onConflict: "event_id,occurrence_start" }
      );
    if (error) throw error;
  }

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
  const allExceptions = (exceptionsResult.data ??
    []) as CommunityCalendarEventExceptionRow[];
  const coachSeries = events.filter(
    (e) =>
      e.is_recurring &&
      e.recurrence?.monthMode === "day_after_ordinal_tuesday"
  );

  const verifyMonths = [
    { year: 2026, month: 5, label: "May 2026" },
    { year: 2026, month: 6, label: "June 2026" },
    { year: 2026, month: 7, label: "July 2026" },
    { year: 2027, month: 9, label: "Sep 2027" },
  ];

  console.log("\n[apply] Verification:");
  for (const { year, month, label } of verifyMonths) {
    const start = DateTime.fromObject({ year, month, day: 1 }, { zone: "utc" });
    const end = start.endOf("month");
    const expanded = expandCommunityCalendar(coachSeries, start, end, allExceptions);
    console.log(`\n  ${label}:`);
    for (const occ of expanded) {
      const d = DateTime.fromISO(occ.startsAtIso, { zone: "utc" }).setZone(TZ);
      console.log(`    ${d.toFormat("ccc d MMM")} — ${occ.title}`);
    }
  }

  if (dryRun) {
    console.log("\n[apply] Dry run complete — no rows written.");
  } else {
    console.log("\n[apply] Done.");
  }
}

main().catch((err) => {
  console.error("[apply] failed:", err);
  process.exit(1);
});
