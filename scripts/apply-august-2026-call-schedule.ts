/**
 * August 2026 community call schedule changes (same as migration
 * 20260829120000_august_2026_community_call_schedule.sql).
 *
 * - End Wednesday coach calls after July 2026
 * - End New Member Kick-off after July 2026
 * - Win The Week + Profit Coach Training → 4pm London from Aug 2026
 * - Monthly Momentum → 3:30–4pm London from Aug 2026
 *
 * Run:    npx tsx scripts/apply-august-2026-call-schedule.ts
 * Dry run: npx tsx scripts/apply-august-2026-call-schedule.ts --dry-run
 */
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { expandCommunityCalendar } from "../src/lib/communityCalendarExpand";
import type {
  CommunityCalendarEventExceptionRow,
  CommunityCalendarEventRow,
  RecurrencePayload,
} from "../src/lib/communityCalendarTypes";

loadEnvConfig(process.cwd());

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
const END_DATE = "2026-07-31";

const COACH_CALL_SERIES_IDS = [
  "c34272d5-3d65-47ec-9c29-b3bfae873fa5", // COACH Certification
  "b984aa29-a933-4860-9c0b-c4ae7b65f67e", // Lead Engine
  "e6e94321-092d-4a59-abd8-85ee3e34b647", // Signing Clients
  "e5e5dc41-39a0-4cd8-8245-946cddea1704", // Coaching Delivery
] as const;

const KICKOFF_ID = "b0eef000-0000-4000-a000-000000000001";
const WIN_THE_WEEK_OLD_ID = "d1ae0ec5-0594-4a49-ac2b-ab18cb6a4a83";
const PROFIT_COACH_TRAINING_OLD_ID = "8ceef792-c4b5-4418-b204-f015fc39eab5";
const MONTHLY_MOMENTUM_OLD_ID = "6ca4cc73-0a5e-4f89-9a07-3cc77469f637";

const WIN_THE_WEEK_NEW_ID = "c8f10000-0000-4000-a000-000000000001";
const PROFIT_COACH_TRAINING_NEW_ID = "c8f10000-0000-4000-a000-000000000002";
const MONTHLY_MOMENTUM_NEW_ID = "c8f10000-0000-4000-a000-000000000003";

const EVENT_SELECT =
  "id, created_by, title, description, cover_image_url, starts_at, ends_at, display_timezone, location_kind, location_url, recording_link_url, recording_video_url, is_recurring, recurrence, access_tags, created_at, updated_at";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function endedRecurrence(existing: RecurrencePayload | null): RecurrencePayload {
  const base = { ...(existing ?? { interval: 1, unit: "month" as const, weekdays: [] }) };
  delete base.maxOccurrences;
  return {
    ...base,
    end: "on",
    endDate: END_DATE,
  };
}

async function endSeries(id: string, label: string) {
  const { data, error } = await supabase
    .from("community_calendar_events")
    .select("id, title, recurrence")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    console.log(`[skip] ${label}: not found`);
    return;
  }
  const next = endedRecurrence(data.recurrence as RecurrencePayload | null);
  console.log(`[end] ${data.title} (${id}) → end on ${END_DATE}`);
  if (dryRun) return;
  const { error: updErr } = await supabase
    .from("community_calendar_events")
    .update({ recurrence: next })
    .eq("id", id);
  if (updErr) throw updErr;
}

async function ensureContinuation(opts: {
  newId: string;
  oldId: string;
  label: string;
  startsAt: string;
  endsAt: string;
  recurrence: RecurrencePayload;
}) {
  const { data: existing, error: existErr } = await supabase
    .from("community_calendar_events")
    .select("id")
    .eq("id", opts.newId)
    .maybeSingle();
  if (existErr) throw existErr;
  if (existing) {
    console.log(`[skip] ${opts.label}: continuation already exists (${opts.newId})`);
    return;
  }

  const { data: old, error: oldErr } = await supabase
    .from("community_calendar_events")
    .select(EVENT_SELECT)
    .eq("id", opts.oldId)
    .maybeSingle();
  if (oldErr) throw oldErr;
  if (!old) {
    console.log(`[skip] ${opts.label}: source series missing (${opts.oldId})`);
    return;
  }

  const row = old as CommunityCalendarEventRow;
  console.log(
    `[create] ${opts.label}: ${opts.startsAt} → ${opts.endsAt} (${opts.newId})`
  );
  if (dryRun) return;

  const { error: insErr } = await supabase.from("community_calendar_events").insert({
    id: opts.newId,
    created_by: row.created_by,
    title: row.title,
    description: row.description,
    cover_image_url: row.cover_image_url,
    starts_at: opts.startsAt,
    ends_at: opts.endsAt,
    display_timezone: TZ,
    location_kind: row.location_kind,
    location_url: row.location_url,
    is_recurring: true,
    recurrence: opts.recurrence,
    access_tags: row.access_tags ?? [],
  });
  if (insErr) throw insErr;
}

async function verify() {
  const ids = [
    ...COACH_CALL_SERIES_IDS,
    KICKOFF_ID,
    WIN_THE_WEEK_OLD_ID,
    PROFIT_COACH_TRAINING_OLD_ID,
    MONTHLY_MOMENTUM_OLD_ID,
    WIN_THE_WEEK_NEW_ID,
    PROFIT_COACH_TRAINING_NEW_ID,
    MONTHLY_MOMENTUM_NEW_ID,
  ];

  const { data: events, error } = await supabase
    .from("community_calendar_events")
    .select(EVENT_SELECT)
    .in("id", ids);
  if (error) throw error;

  const { data: exceptions, error: exErr } = await supabase
    .from("community_calendar_event_exceptions")
    .select("*")
    .in("event_id", ids);
  if (exErr) throw exErr;

  const rangeStart = DateTime.fromISO("2026-07-20T00:00:00", { zone: TZ });
  const rangeEnd = DateTime.fromISO("2026-08-15T23:59:59", { zone: TZ });
  const occs = expandCommunityCalendar(
    (events ?? []) as CommunityCalendarEventRow[],
    rangeStart,
    rangeEnd,
    (exceptions ?? []) as CommunityCalendarEventExceptionRow[]
  );

  console.log("\n=== Verify Jul 20 – Aug 15 (Europe/London) ===");
  for (const o of occs.sort((a, b) => a.startsAtIso.localeCompare(b.startsAtIso))) {
    const local = DateTime.fromISO(o.startsAtIso, { zone: "utc" }).setZone(TZ);
    console.log(local.toFormat("ccc dd LLL yyyy HH:mm"), "|", o.title);
  }
}

async function main() {
  console.log(
    `[apply] August 2026 community call schedule${dryRun ? " (dry run)" : ""}…`
  );

  for (const id of COACH_CALL_SERIES_IDS) {
    await endSeries(id, "coach call");
  }
  await endSeries(KICKOFF_ID, "kick-off");
  await endSeries(WIN_THE_WEEK_OLD_ID, "Win The Week (old)");
  await endSeries(PROFIT_COACH_TRAINING_OLD_ID, "Profit Coach Training (old)");
  await endSeries(MONTHLY_MOMENTUM_OLD_ID, "Monthly Momentum (old)");

  await ensureContinuation({
    newId: WIN_THE_WEEK_NEW_ID,
    oldId: WIN_THE_WEEK_OLD_ID,
    label: "Win The Week 4pm",
    startsAt: "2026-08-03T15:00:00+00:00",
    endsAt: "2026-08-03T16:00:00+00:00",
    recurrence: {
      end: "after",
      unit: "week",
      interval: 1,
      weekdays: [0],
      maxOccurrences: 52,
    },
  });

  await ensureContinuation({
    newId: PROFIT_COACH_TRAINING_NEW_ID,
    oldId: PROFIT_COACH_TRAINING_OLD_ID,
    label: "Profit Coach Training 4pm",
    startsAt: "2026-08-06T15:00:00+00:00",
    endsAt: "2026-08-06T16:00:00+00:00",
    recurrence: {
      end: "after",
      unit: "week",
      interval: 1,
      weekdays: [3],
      maxOccurrences: 52,
    },
  });

  await ensureContinuation({
    newId: MONTHLY_MOMENTUM_NEW_ID,
    oldId: MONTHLY_MOMENTUM_OLD_ID,
    label: "Monthly Momentum 3:30pm",
    startsAt: "2026-08-03T14:30:00+00:00",
    endsAt: "2026-08-03T15:00:00+00:00",
    recurrence: {
      end: "after",
      unit: "month",
      interval: 1,
      weekdays: [],
      monthMode: "ordinal_weekday",
      monthOrdinal: 1,
      monthWeekday: 0,
      maxOccurrences: 24,
    },
  });

  if (!dryRun) await verify();
  console.log("[apply] done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
