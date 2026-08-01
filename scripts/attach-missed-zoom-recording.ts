/**
 * Manually attach a Zoom recording to a recurring community calendar occurrence.
 *
 * Use when the `recording.completed` webhook logged `unmatched` — typically because
 * the meeting ran outside the occurrence's match window.
 *
 * Usage:
 *   npx tsx scripts/attach-missed-zoom-recording.ts <eventId> <occurrenceStartIso> <shareUrl> [--dry-run]
 */
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const dryRun = process.argv.includes("--dry-run");
const [eventId, occurrenceStartInput, shareUrl] = args;

if (!eventId || !occurrenceStartInput || !shareUrl) {
  console.error(
    "Usage: npx tsx scripts/attach-missed-zoom-recording.ts <eventId> <occurrenceStartIso> <shareUrl> [--dry-run]"
  );
  process.exit(1);
}

if (!/^https?:\/\//i.test(shareUrl)) {
  console.error("Share URL must start with http:// or https://");
  process.exit(1);
}

const occurrenceStart = DateTime.fromISO(occurrenceStartInput, { zone: "utc" });
if (!occurrenceStart.isValid) {
  console.error(`Invalid occurrence start: ${occurrenceStartInput}`);
  process.exit(1);
}
const normalized = occurrenceStart.toISO()!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  const { data: event, error: eventError } = await supabase
    .from("community_calendar_events")
    .select("id, title, is_recurring")
    .eq("id", eventId)
    .maybeSingle();
  if (eventError) throw eventError;
  if (!event) {
    console.error(`No calendar event found with id ${eventId}`);
    process.exit(1);
  }

  console.log(`Event:      ${event.title} (${event.id})`);
  console.log(`Occurrence: ${normalized}`);
  console.log(`Recording:  ${shareUrl}`);

  const { data: existing, error: readError } = await supabase
    .from("community_calendar_event_exceptions")
    .select(
      "cancelled_at, cancellation_reason, recording_link_url, recording_video_url"
    )
    .eq("event_id", eventId)
    .eq("occurrence_start", normalized)
    .maybeSingle();
  if (readError) throw readError;

  if (existing?.recording_link_url || existing?.recording_video_url) {
    console.error(
      `Occurrence already has a recording: ${
        existing.recording_link_url ?? existing.recording_video_url
      }`
    );
    console.error("Refusing to overwrite. Clear it first if this is intended.");
    process.exit(1);
  }

  if (dryRun) {
    console.log("\nDry run — no changes written.");
    return;
  }

  const { error } = await supabase
    .from("community_calendar_event_exceptions")
    .upsert(
      {
        event_id: eventId,
        occurrence_start: normalized,
        cancelled_at: existing?.cancelled_at ?? null,
        cancellation_reason: existing?.cancellation_reason ?? null,
        recording_link_url: shareUrl,
        recording_video_url: existing?.recording_video_url ?? null,
      },
      { onConflict: "event_id,occurrence_start" }
    );
  if (error) throw error;

  console.log("\nAttached.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
