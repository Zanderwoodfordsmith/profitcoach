/**
 * Queue Happy Scribe transcripts for academy videos missing transcript_text.
 *
 * Skips Profit System Framework & tools (and related Profit System filters
 * already applied in loadTranscriptionCandidates).
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/queue-happy-scribe-transcripts.ts --dry-run
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/queue-happy-scribe-transcripts.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/queue-happy-scribe-transcripts.ts --tick
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const dryRun = process.argv.includes("--dry-run");
const tickOnly = process.argv.includes("--tick");
const BATCH_SIZE = 100;

async function main() {
  const {
    advanceTranscriptionQueue,
    createTranscriptionBatch,
    loadTranscriptionCandidates,
    loadTranscriptionQueue,
  } = await import("../src/lib/happyScribe/queue");
  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");

  if (tickOnly) {
    const result = await advanceTranscriptionQueue();
    console.log(JSON.stringify({ tick: result }, null, 2));
    return;
  }

  const candidates = await loadTranscriptionCandidates();
  const byCourse = new Map<string, number>();
  let totalSeconds = 0;
  for (const candidate of candidates) {
    byCourse.set(candidate.courseId, (byCourse.get(candidate.courseId) ?? 0) + 1);
    totalSeconds += candidate.durationSeconds ?? 0;
  }

  console.log(
    JSON.stringify(
      {
        candidateCount: candidates.length,
        totalSeconds,
        totalHoursApprox: Math.round((totalSeconds / 3600) * 100) / 100,
        byCourse: Object.fromEntries(
          [...byCourse.entries()].sort((a, b) => b[1] - a[1]),
        ),
        sample: candidates.slice(0, 20).map((c) => ({
          key: c.key,
          title: c.lessonTitle,
          kind: c.kind,
          parent: c.parentLessonTitle,
          durationSeconds: c.durationSeconds,
        })),
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    console.log("Dry run only — no batches created.");
    return;
  }

  if (candidates.length === 0) {
    console.log("No eligible missing transcripts.");
    const runs = await loadTranscriptionQueue(3);
    console.log(
      JSON.stringify(
        {
          recentRuns: runs.map((run) => ({
            id: run.id,
            status: run.status,
            requested: run.requestedCount,
            completed: run.completedCount,
            failed: run.failedCount,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (adminError) throw new Error(adminError.message);
  const createdBy = admin?.id;
  if (!createdBy) throw new Error("No admin profile found for created_by.");

  const createdRuns: string[] = [];
  for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
    const slice = candidates.slice(offset, offset + BATCH_SIZE);
    const run = await createTranscriptionBatch({
      createdBy,
      keys: slice.map((candidate) => candidate.key),
      service: "auto",
      language: "en",
    });
    createdRuns.push(run.id);
    console.log(
      `Created run ${run.id} with ${run.requestedCount} items (${offset + 1}-${offset + slice.length} of ${candidates.length}).`,
    );
  }

  // Kick the queue a few times so Happy Scribe jobs start immediately.
  const ticks = [];
  for (let i = 0; i < 5; i += 1) {
    ticks.push(await advanceTranscriptionQueue());
  }

  console.log(
    JSON.stringify(
      {
        createdRuns,
        ticks,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
