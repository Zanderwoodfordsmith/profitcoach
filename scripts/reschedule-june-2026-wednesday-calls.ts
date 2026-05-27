/**
 * One-off: move every Wednesday community call in June 2026 forward by 1 week.
 *
 * Example: 4th-Wednesday "Coaching Delivery" on 24 Jun → 1 Jul.
 *
 * Run:    npx tsx scripts/reschedule-june-2026-wednesday-calls.ts
 * Dry run: npx tsx scripts/reschedule-june-2026-wednesday-calls.ts --dry-run
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
 * Apply migration 20260729120000_community_calendar_exception_reschedule.sql first.
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

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const JUNE_2026_START = DateTime.fromObject(
  { year: 2026, month: 6, day: 1 },
  { zone: "utc" }
).startOf("day");
const JUNE_2026_END = DateTime.fromObject(
  { year: 2026, month: 6, day: 30 },
  { zone: "utc" }
).endOf("day");

function isJune2026WednesdayOccurrence(
  startsAtIso: string,
  displayTimezone: string
): boolean {
  const local = DateTime.fromISO(startsAtIso, { zone: "utc" }).setZone(
    displayTimezone || "UTC"
  );
  return local.year === 2026 && local.month === 6 && local.weekday === 3;
}

async function main() {
  console.log(
    `[reschedule] June 2026 Wednesday calls +7 days${dryRun ? " (dry run)" : ""}…`
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

  const recurringEvents = events.filter(
    (row) => row.is_recurring && row.recurrence
  );

  const exceptionsForDiscovery = exceptions.map((ex) => ({
    ...ex,
    rescheduled_starts_at: null,
    rescheduled_ends_at: null,
  }));

  const occurrences = expandCommunityCalendar(
    recurringEvents,
    JUNE_2026_START,
    JUNE_2026_END,
    exceptionsForDiscovery
  );

  const targets = occurrences.filter((occ) =>
    isJune2026WednesdayOccurrence(occ.startsAtIso, occ.display_timezone)
  );

  const targetTitles = new Set(targets.map((t) => t.title));
  const duplicateOneOffs = events.filter((row) => {
    if (row.is_recurring) return false;
    if (!targetTitles.has(row.title)) return false;
    return isJune2026WednesdayOccurrence(row.starts_at, row.display_timezone);
  });

  if (targets.length === 0) {
    console.log("[reschedule] No June 2026 Wednesday occurrences found.");
    return;
  }

  console.log(`[reschedule] Found ${targets.length} occurrence(s):`);
  for (const occ of targets) {
    const start = DateTime.fromISO(occ.startsAtIso, { zone: "utc" });
    const end = DateTime.fromISO(occ.endsAtIso, { zone: "utc" });
    const newStart = start.plus({ days: 7 });
    const newEnd = end.plus({ days: 7 });
    const local = start.setZone(occ.display_timezone || "UTC");

    console.log(
      `  • ${occ.title} — ${local.toFormat("ccc d MMM yyyy")} → ${newStart
        .setZone(occ.display_timezone || "UTC")
        .toFormat("ccc d MMM yyyy")}`
    );

    const seriesStart =
      occ.seriesOccurrenceStartIso ?? occ.startsAtIso;
    const normalizedStart = DateTime.fromISO(seriesStart, {
      zone: "utc",
    }).toISO();
    if (!normalizedStart) {
      throw new Error(`Invalid occurrence start for ${occ.title}`);
    }

    const payload = {
      event_id: occ.eventId,
      occurrence_start: normalizedStart,
      rescheduled_starts_at: newStart.toISO(),
      rescheduled_ends_at: newEnd.toISO(),
      cancelled_at: null,
      cancellation_reason: null,
    };

    if (dryRun) continue;

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
          ...payload,
          recording_link_url: existing?.recording_link_url ?? null,
          recording_video_url: existing?.recording_video_url ?? null,
        },
        { onConflict: "event_id,occurrence_start" }
      );

    if (error) throw error;
  }

  if (duplicateOneOffs.length > 0) {
    console.log(
      `[reschedule] Removing ${duplicateOneOffs.length} duplicate one-off event(s):`
    );
    for (const row of duplicateOneOffs) {
      const local = DateTime.fromISO(row.starts_at, { zone: "utc" }).setZone(
        row.display_timezone || "UTC"
      );
      console.log(`  • ${row.title} — ${local.toFormat("ccc d MMM yyyy")}`);
      if (dryRun) continue;
      const { error: deleteError } = await supabase
        .from("community_calendar_events")
        .delete()
        .eq("id", row.id);
      if (deleteError) throw deleteError;
    }
  }

  if (dryRun) {
    console.log("[reschedule] Dry run complete — no rows written.");
  } else {
    console.log("[reschedule] Done.");
  }
}

main().catch((err) => {
  console.error("[reschedule] failed:", err);
  process.exit(1);
});
