import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { buildSection, isBuildableSection } from "./buildSection";

/**
 * "Write my blueprint" on the server. Starting a job writes as many sections
 * as fit in that request; the practice-build cron carries on every minute
 * until the job is done, so the coach can close the page.
 */

export type BuildJob = {
  id: string;
  coach_id: string;
  keys: string[];
  done: string[];
  failed: { key: string; error: string }[];
  current_key: string | null;
  status: "queued" | "running" | "done" | "cancelled";
  heartbeat_at: string | null;
  created_at: string;
  finished_at: string | null;
};

const JOB_SELECT =
  "id, coach_id, keys, done, failed, current_key, status, heartbeat_at, created_at, finished_at";

/** A section can take over a minute; a worker silent this long has died. */
const STALE_MS = 4 * 60 * 1000;
/** Stop starting new sections after this long, so the function never times out mid-write. */
export const WORK_BUDGET_MS = 170 * 1000;

function remaining(job: BuildJob): string[] {
  const finished = new Set([...job.done, ...job.failed.map((f) => f.key)]);
  return job.keys.filter((key) => !finished.has(key));
}

async function update(id: string, patch: Partial<BuildJob>): Promise<BuildJob | null> {
  const { data, error } = await supabaseAdmin
    .from("practice_build_jobs")
    .update(patch)
    .eq("id", id)
    .select(JOB_SELECT)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BuildJob | null) ?? null;
}

export async function latestBuildJob(coachId: string): Promise<BuildJob | null> {
  const { data, error } = await supabaseAdmin
    .from("practice_build_jobs")
    .select(JOB_SELECT)
    .eq("coach_id", coachId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BuildJob | null) ?? null;
}

export async function cancelBuildJobs(coachId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("practice_build_jobs")
    .update({ status: "cancelled", current_key: null, finished_at: new Date().toISOString() })
    .eq("coach_id", coachId)
    .in("status", ["queued", "running"]);
  if (error) throw new Error(error.message);
}

/** Replace any open job for this coach with a new one for these sections. */
export async function startBuildJob(opts: {
  coachId: string;
  requestedBy: string | null;
  keys: string[];
}): Promise<BuildJob> {
  const keys = [...new Set(opts.keys.filter(isBuildableSection))];
  if (!keys.length) throw new Error("Nothing to write.");
  await cancelBuildJobs(opts.coachId);
  const { data, error } = await supabaseAdmin
    .from("practice_build_jobs")
    .insert({ coach_id: opts.coachId, requested_by: opts.requestedBy, keys })
    .select(JOB_SELECT)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not start writing.");
  return data as BuildJob;
}

/** Claim a job if it is queued, or running with a worker that went silent. */
async function claim(jobId: string): Promise<BuildJob | null> {
  const now = new Date();
  const stale = new Date(now.getTime() - STALE_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("practice_build_jobs")
    .update({ status: "running", heartbeat_at: now.toISOString() })
    .eq("id", jobId)
    .or(`status.eq.queued,and(status.eq.running,heartbeat_at.lt.${stale})`)
    .select(JOB_SELECT)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BuildJob | null) ?? null;
}

/** Write sections for one job until it is done, cancelled, or out of time. */
export async function workBuildJob(jobId: string, budgetMs = WORK_BUDGET_MS): Promise<void> {
  const started = Date.now();
  let job = await claim(jobId);
  if (!job) return;

  while (job) {
    const next = remaining(job)[0];
    if (!next) {
      await update(job.id, { status: "done", current_key: null, finished_at: new Date().toISOString() });
      return;
    }
    if (Date.now() - started > budgetMs) {
      // Hand over to the cron.
      await update(job.id, { status: "queued", current_key: null, heartbeat_at: null });
      return;
    }
    await update(job.id, { current_key: next, heartbeat_at: new Date().toISOString() });
    let failure: string | null = null;
    try {
      await buildSection(job.coach_id, next);
    } catch (err) {
      failure = err instanceof Error ? err.message : "Could not write this section.";
    }
    // Reload: the coach may have cancelled while this section was being written.
    const { data: fresh } = await supabaseAdmin
      .from("practice_build_jobs")
      .select(JOB_SELECT)
      .eq("id", job.id)
      .maybeSingle();
    const current = fresh as BuildJob | null;
    if (!current || current.status === "cancelled") return;
    job = await update(job.id, {
      done: failure ? current.done : [...current.done, next],
      failed: failure ? [...current.failed, { key: next, error: failure.slice(0, 300) }] : current.failed,
      heartbeat_at: new Date().toISOString(),
    });
  }
}

/** Cron: pick up jobs nobody is working on. */
export async function workOpenBuildJobs(budgetMs = WORK_BUDGET_MS): Promise<{ worked: number }> {
  const stale = new Date(Date.now() - STALE_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("practice_build_jobs")
    .select("id")
    .or(`status.eq.queued,and(status.eq.running,heartbeat_at.lt.${stale})`)
    .order("created_at", { ascending: true })
    .limit(5);
  if (error) throw new Error(error.message);
  const started = Date.now();
  let worked = 0;
  for (const row of data ?? []) {
    const left = budgetMs - (Date.now() - started);
    if (left < 30_000) break;
    await workBuildJob(row.id as string, left);
    worked += 1;
  }
  return { worked };
}
