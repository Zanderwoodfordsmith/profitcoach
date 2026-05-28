/**
 * Restore May 2026 Lead Engine conference make-up (Fri 15 May 2026, 1–3pm London).
 *
 * Run:    npx tsx scripts/restore-may-2026-lead-engine.ts
 * With recording:
 *   npx tsx scripts/restore-may-2026-lead-engine.ts --recording-url "https://..."
 * Dry run: npx tsx scripts/restore-may-2026-lead-engine.ts --dry-run
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";

loadEnvConfig(process.cwd());

import { COMMUNITY_CALENDAR_EVENT_SELECT } from "../src/lib/communityCalendarData";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const LEAD_ENGINE_SERIES_ID = "b984aa29-a933-4860-9c0b-c4ae7b65f67e";
/** Preserved one-off — conference make-up, not a duplicate. */
export const MAY_2026_LEAD_ENGINE_ONE_OFF_ID =
  "ed3a5920-fabd-495d-8211-752f4263ced6";

const TZ = "Europe/London";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const recordingUrlArg = process.argv.find((a) => a.startsWith("--recording-url="));
const recordingUrl = recordingUrlArg?.slice("--recording-url=".length).trim() || null;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: series, error: seriesError } = await supabase
    .from("community_calendar_events")
    .select(COMMUNITY_CALENDAR_EVENT_SELECT)
    .eq("id", LEAD_ENGINE_SERIES_ID)
    .maybeSingle();

  if (seriesError) throw seriesError;
  if (!series) {
    console.error("[restore] Lead Engine recurring series not found.");
    process.exit(1);
  }

  const start = DateTime.fromObject(
    { year: 2026, month: 5, day: 15, hour: 13, minute: 0 },
    { zone: TZ }
  );
  const end = start.plus({ hours: 2 });

  const row = {
    id: MAY_2026_LEAD_ENGINE_ONE_OFF_ID,
    created_by: series.created_by,
    title: series.title,
    description: series.description,
    cover_image_url: series.cover_image_url,
    starts_at: start.toUTC().toISO()!,
    ends_at: end.toUTC().toISO()!,
    display_timezone: series.display_timezone,
    location_kind: series.location_kind,
    location_url: series.location_url,
    recording_link_url: recordingUrl,
    recording_video_url: null,
    is_recurring: false,
    recurrence: null,
    access_tags: series.access_tags,
  };

  console.log(
    `[restore] May 2026 Lead Engine → ${start.toFormat("ccc d MMM yyyy HH:mm")} ${TZ}${
      dryRun ? " (dry run)" : ""
    }`
  );
  if (recordingUrl) {
    console.log(`[restore] Recording URL: ${recordingUrl}`);
  } else {
    console.log(
      "[restore] No recording URL — re-attach via calendar UI or pass --recording-url=..."
    );
  }

  if (dryRun) return;

  const { error } = await supabase
    .from("community_calendar_events")
    .upsert(row, { onConflict: "id" });

  if (error) throw error;
  console.log("[restore] Done.");
}

main().catch((err) => {
  console.error("[restore] failed:", err);
  process.exit(1);
});
