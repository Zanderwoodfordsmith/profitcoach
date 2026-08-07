/**
 * Backfill academy_lesson_content.duration for rows that have video/audio
 * but no duration label. Probes public media URLs with ffprobe (HTTP range
 * seeks — does not download full files).
 *
 * Usage:
 *   npx tsx scripts/backfill-academy-lesson-durations.ts --dry-run
 *   npx tsx scripts/backfill-academy-lesson-durations.ts --apply
 *   npx tsx scripts/backfill-academy-lesson-durations.ts --apply --limit 20
 *   npx tsx scripts/backfill-academy-lesson-durations.ts --apply --concurrency 4
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { path as ffprobePath } from "@ffprobe-installer/ffprobe";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { formatLessonDurationFromSeconds } from "../src/lib/academy/hubCatalog";

loadEnvConfig(process.cwd());

const execFileAsync = promisify(execFile);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const apply = argv.includes("--apply");

const limitIdx = argv.indexOf("--limit");
const limit =
  limitIdx >= 0 && argv[limitIdx + 1]
    ? Number.parseInt(argv[limitIdx + 1]!, 10)
    : null;

const concurrencyIdx = argv.indexOf("--concurrency");
const concurrency = Math.max(
  1,
  concurrencyIdx >= 0 && argv[concurrencyIdx + 1]
    ? Number.parseInt(argv[concurrencyIdx + 1]!, 10)
    : 3
);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (!dryRun && !apply) {
  console.error("Pass --dry-run or --apply.");
  process.exit(1);
}

type Row = {
  course_id: string;
  lesson_id: string;
  title: string | null;
  video_url: string | null;
  audio_url: string | null;
  duration: string | null;
};

async function probeDurationSeconds(mediaUrl: string): Promise<number | null> {
  const { stdout } = await execFileAsync(
    ffprobePath,
    ["-v", "error", "-show_entries", "format=duration", "-of", "json", mediaUrl],
    { timeout: 180_000, maxBuffer: 2 * 1024 * 1024 }
  );
  const json = JSON.parse(stdout) as { format?: { duration?: string } };
  const seconds = Number(json.format?.duration);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds;
}

async function mapPool<T, R>(
  items: T[],
  poolSize: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(poolSize, items.length) }, () => worker())
  );
  return results;
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(
    `[duration-backfill] mode=${apply ? "apply" : "dry-run"} concurrency=${concurrency}` +
      (limit != null ? ` limit=${limit}` : "")
  );
  console.log(`[duration-backfill] ffprobe=${ffprobePath}`);

  const { data, error } = await supabase
    .from("academy_lesson_content")
    .select("course_id, lesson_id, title, video_url, audio_url, duration")
    .or("video_url.neq.,audio_url.neq.");
  if (error) throw new Error(error.message);

  let missing = ((data ?? []) as Row[]).filter((row) => {
    const hasMedia = Boolean(
      row.video_url?.trim() || row.audio_url?.trim()
    );
    const hasDuration = Boolean(row.duration?.trim());
    return hasMedia && !hasDuration;
  });

  if (limit != null && Number.isFinite(limit)) {
    missing = missing.slice(0, limit);
  }

  console.log(`[duration-backfill] candidates=${missing.length}`);

  let ok = 0;
  let failed = 0;
  let skipped = 0;

  await mapPool(missing, concurrency, async (row) => {
    const mediaUrl =
      row.video_url?.trim() || row.audio_url?.trim() || null;
    if (!mediaUrl) {
      skipped++;
      return;
    }

    try {
      const seconds = await probeDurationSeconds(mediaUrl);
      const label = seconds != null ? formatLessonDurationFromSeconds(seconds) : null;
      if (!label) {
        failed++;
        console.warn(
          `[duration-backfill] no duration ${row.course_id}/${row.lesson_id}`
        );
        return;
      }

      console.log(
        `[duration-backfill] ${row.course_id}/${row.lesson_id} → ${label}` +
          (seconds != null ? ` (${Math.round(seconds)}s)` : "")
      );

      if (!apply) {
        ok++;
        return;
      }

      const { error: updateError } = await supabase
        .from("academy_lesson_content")
        .update({
          duration: label,
          updated_at: new Date().toISOString(),
        })
        .eq("course_id", row.course_id)
        .eq("lesson_id", row.lesson_id);
      if (updateError) {
        throw new Error(updateError.message);
      }
      ok++;
    } catch (err) {
      failed++;
      console.warn(
        `[duration-backfill] fail ${row.course_id}/${row.lesson_id}:`,
        err instanceof Error ? err.message : err
      );
    }
  });

  console.log(
    `[duration-backfill] done ok=${ok} failed=${failed} skipped=${skipped}`
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
