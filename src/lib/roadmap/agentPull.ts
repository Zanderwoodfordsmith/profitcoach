import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { RoadmapAgentLogLine } from "./types";

/**
 * Local dev only (started from src/instrumentation.ts): when Claude finishes a
 * card in the cloud, Supabase tells this server straight away and it drops the
 * change into this folder as uncommitted edits, so 3002 shows it. Nothing is
 * forced: if the change doesn't fit cleanly (someone edited the same lines),
 * the card says so and nothing is touched. Only runs on the main branch.
 */

const runFile = promisify(execFile);
const ROOT = process.cwd();
const COLUMNS = "id, job_number, agent_status, agent_branch, agent_head_sha, agent_applied_sha, agent_pull_error, agent_log";

type Row = {
  id: string;
  job_number: number;
  agent_status: string | null;
  agent_branch: string | null;
  agent_head_sha: string | null;
  agent_applied_sha: string | null;
  agent_pull_error: string | null;
  agent_log: RoadmapAgentLogLine[] | null;
};

async function git(args: string[]): Promise<string> {
  const { stdout } = await runFile("git", args, { cwd: ROOT, maxBuffer: 50 * 1024 * 1024 });
  return stdout;
}

function gitApply(args: string[], patch: string): Promise<{ ok: boolean; err: string }> {
  return new Promise((resolve) => {
    const p = spawn("git", ["apply", "--whitespace=nowarn", ...args], { cwd: ROOT });
    let err = "";
    p.stderr.on("data", (d) => (err += String(d)));
    p.on("error", (e) => resolve({ ok: false, err: e.message }));
    p.on("close", (code) => resolve({ ok: code === 0, err }));
    p.stdin.end(patch);
  });
}

function waiting(row: Row | null): row is Row & { agent_branch: string; agent_head_sha: string } {
  return Boolean(
    row &&
      row.agent_status === "done" &&
      row.agent_branch &&
      row.agent_head_sha &&
      row.agent_head_sha !== row.agent_applied_sha &&
      !row.agent_pull_error,
  );
}

async function record(row: Row, text: string, patch: Record<string, unknown>) {
  const line: RoadmapAgentLogLine = { at: new Date().toISOString(), text, by: "app" };
  await supabaseAdmin
    .from("roadmap_jobs")
    .update({ ...patch, agent_log: [...(row.agent_log ?? []), line], updated_at: new Date().toISOString() })
    .eq("id", row.id);
}

async function pull(id: string) {
  const { data } = await supabaseAdmin.from("roadmap_jobs").select(COLUMNS).eq("id", id).maybeSingle();
  const row = data as Row | null;
  if (!waiting(row)) return;

  const branch = (await git(["rev-parse", "--abbrev-ref", "HEAD"])).trim();
  if (branch !== "main") {
    console.log(`[roadmap] Job ${row.job_number} is ready, but this folder is on ${branch}, not main. Skipped.`);
    return;
  }

  try {
    await git(["fetch", "--quiet", "origin", row.agent_branch, "staging"]);
    const sha = row.agent_head_sha;
    await git(["cat-file", "-e", `${sha}^{commit}`]);
    const from = row.agent_applied_sha ?? (await git(["merge-base", "origin/staging", sha])).trim();
    const files = (await git(["diff", "--name-only", from, sha])).split("\n").filter(Boolean);
    const patch = await git(["diff", "--binary", from, sha]);
    if (patch.trim()) {
      const check = await gitApply(["--check"], patch);
      if (!check.ok) {
        const why = check.err.split("\n").find((l) => l.trim()) ?? "it doesn't fit";
        await record(row, `Couldn't bring it onto your Mac: ${why.slice(0, 200)}. Nothing was changed.`, {
          agent_pull_error: why.slice(0, 500),
        });
        return;
      }
      const applied = await gitApply([], patch);
      if (!applied.ok) throw new Error(applied.err || "git apply failed");
    }
    await record(row, `On your Mac: ${files.length} ${files.length === 1 ? "file" : "files"} changed. Check it on 3002.`, {
      agent_applied_sha: sha,
      agent_applied_at: new Date().toISOString(),
    });
    console.log(`[roadmap] Pulled job ${row.job_number} (${row.agent_branch}) into this folder.`);
  } catch (e) {
    const why = e instanceof Error ? e.message.split("\n")[0] : String(e);
    await record(row, `Couldn't bring it onto your Mac: ${why.slice(0, 200)}`, { agent_pull_error: why.slice(0, 500) });
  }
}

// One at a time, so two cards never write to the folder together.
let queue: Promise<void> = Promise.resolve();
function enqueue(id: string) {
  queue = queue.then(() => pull(id)).catch((e) => console.error("[roadmap] pull failed:", e));
}

async function catchUp() {
  const { data } = await supabaseAdmin
    .from("roadmap_jobs")
    .select(COLUMNS)
    .eq("agent_status", "done")
    .not("agent_head_sha", "is", null)
    .is("agent_pull_error", null);
  for (const row of (data ?? []) as Row[]) if (waiting(row)) enqueue(row.id);
}

export function startRoadmapAgentPull() {
  const g = globalThis as { __roadmapAgentPull?: boolean };
  if (g.__roadmapAgentPull) return;
  g.__roadmapAgentPull = true;
  supabaseAdmin
    .channel("roadmap-agent-pull")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "roadmap_jobs", filter: "agent_status=eq.done" },
      (payload) => {
        const row = payload.new as Row;
        if (waiting(row)) enqueue(row.id);
      },
    )
    .subscribe((status) => {
      // Also on every reconnect: anything that finished while we weren't listening.
      if (status === "SUBSCRIBED") void catchUp();
    });
  console.log("[roadmap] Listening for cards Claude finishes.");
}
