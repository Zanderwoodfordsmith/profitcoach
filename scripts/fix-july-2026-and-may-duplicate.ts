/**
 * @deprecated Superseded by scripts/apply-day-after-tuesday-recurrence.ts
 *
 * Fix calendar state after conflicting June +7 and July −7 reschedules:
 * - Remove duplicate one-off Coaching Delivery on 27 May 2026
 * - Correct July 2026: Jul 1 = Coaching Delivery only (from June cascade);
 *   Jul 8/15/22/29 = COACH Cert / Lead / Signing / Coaching Delivery
 *
 * Run:    npx tsx scripts/fix-july-2026-and-may-duplicate.ts
 * Dry run: npx tsx scripts/fix-july-2026-and-may-duplicate.ts --dry-run
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
import type { CommunityCalendarEventRow } from "../src/lib/communityCalendarTypes";

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

/** Duplicate one-off on same day as recurring 4th-Wednesday series anchor. */
const DUPLICATE_ONE_OFF_ID = "5d8048d7-c747-49ae-9db2-20cc353db296";

const EVENT_IDS = {
  coachCert: "c34272d5-3d65-47ec-9c29-b3bfae873fa5",
  leadEngine: "b984aa29-a933-4860-9c0b-c4ae7b65f67e",
  signingClients: "e6e94321-092d-4a59-abd8-85ee3e34b647",
  coachingDelivery: "e5e5dc41-39a0-4cd8-8245-946cddea1704",
} as const;

/** Natural July 2026 ordinal occurrence → target date (+7 days). */
const JULY_2026_FIXES: Array<{
  eventId: string;
  title: string;
  naturalDay: number;
  targetDay: number;
}> = [
  { eventId: EVENT_IDS.coachCert, title: "COACH Certification", naturalDay: 1, targetDay: 8 },
  { eventId: EVENT_IDS.leadEngine, title: "Lead Engine", naturalDay: 8, targetDay: 15 },
  { eventId: EVENT_IDS.signingClients, title: "Signing Clients", naturalDay: 15, targetDay: 22 },
  { eventId: EVENT_IDS.coachingDelivery, title: "Coaching Delivery", naturalDay: 22, targetDay: 29 },
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

async function main() {
  console.log(
    `[fix] July 2026 + remove May duplicate${dryRun ? " (dry run)" : ""}…`
  );

  console.log(`  • Delete duplicate one-off Coaching Delivery (${DUPLICATE_ONE_OFF_ID})`);
  if (!dryRun) {
    const { error } = await supabase
      .from("community_calendar_events")
      .delete()
      .eq("id", DUPLICATE_ONE_OFF_ID);
    if (error) throw error;
  }

  for (const fix of JULY_2026_FIXES) {
    const natural = londonSlot(2026, 7, fix.naturalDay);
    const target = londonSlot(2026, 7, fix.targetDay);

    console.log(
      `  • ${fix.title} — ${DateTime.fromISO(natural.start, { zone: "utc" })
        .setZone(TZ)
        .toFormat("d MMM")} → ${DateTime.fromISO(target.start, { zone: "utc" })
        .setZone(TZ)
        .toFormat("d MMM")}`
    );

    if (dryRun) continue;

    const { error } = await supabase
      .from("community_calendar_event_exceptions")
      .upsert(
        {
          event_id: fix.eventId,
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
  const exceptions = exceptionsResult.data ?? [];
  const series = events.filter(
    (e) => e.is_recurring && e.recurrence?.monthMode === "ordinal_weekday"
  );

  const start = DateTime.fromObject({ year: 2026, month: 5, day: 1 }, { zone: "utc" });
  const end = DateTime.fromObject({ year: 2026, month: 7, day: 31 }, { zone: "utc" }).endOf(
    "day"
  );
  const expanded = expandCommunityCalendar(series, start, end, exceptions);

  console.log("\n[fix] May–Jul 2026 after fix:");
  for (const occ of expanded.sort((a, b) => a.startsAtIso.localeCompare(b.startsAtIso))) {
    const d = DateTime.fromISO(occ.startsAtIso, { zone: "utc" }).setZone(TZ);
    if (d.month >= 5 && d.month <= 7) {
      console.log(`  ${d.toFormat("ccc d MMM")} — ${occ.title}`);
    }
  }

  if (dryRun) {
    console.log("\n[fix] Dry run complete — no rows written.");
  } else {
    console.log("\n[fix] Done.");
  }
}

main().catch((err) => {
  console.error("[fix] failed:", err);
  process.exit(1);
});
