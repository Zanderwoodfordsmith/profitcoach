import { createHash, randomBytes } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { getRoadmapJob } from "./core";
import type { RoadmapAgentLogLine, RoadmapJob } from "./types";

/**
 * Hand a card to Claude: start a cloud Claude Code session (a routine) on the
 * card. The session gets a one-time key that only opens this card's three
 * functions (read it, add a progress line, finish; see the roadmap_agent
 * migration). When it finishes, the card goes to Review and the local dev
 * server pulls the change in (agentPull.ts).
 *
 * Needs ROADMAP_ROUTINE_ID (trig_…) and ROADMAP_ROUTINE_TOKEN (the routine's
 * API trigger token from claude.ai/code/routines).
 */

export function agentBranchFor(jobNumber: number): string {
  return `claude/job-${jobNumber}`;
}

export function hashAgentToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function logLine(text: string): RoadmapAgentLogLine {
  return { at: new Date().toISOString(), text, by: "app" };
}

export async function handRoadmapJobToClaude(id: string): Promise<RoadmapJob> {
  const routineId = process.env.ROADMAP_ROUTINE_ID?.trim();
  const routineToken = process.env.ROADMAP_ROUTINE_TOKEN?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!routineId || !routineToken) {
    throw new Error("Hand to Claude isn't set up here yet: ROADMAP_ROUTINE_ID and ROADMAP_ROUTINE_TOKEN are missing.");
  }
  if (!supabaseUrl || !anonKey) throw new Error("Supabase settings are missing.");

  const job = await getRoadmapJob(id);
  if (!job) throw new Error("Job not found.");
  if (job.agent_status === "queued" || job.agent_status === "working") {
    throw new Error("Claude is already on this card.");
  }

  const again = Boolean(job.agent_branch);
  const token = randomBytes(24).toString("base64url");
  const startLog = [...(job.agent_log ?? []), logLine(again ? "Sent back to Claude" : "Handed to Claude")];
  const { error: claimError } = await supabaseAdmin
    .from("roadmap_jobs")
    .update({
      agent_status: "queued",
      agent_token_hash: hashAgentToken(token),
      agent_session_url: null,
      agent_pull_error: null,
      agent_log: startLog,
      status: "in_progress",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (claimError) throw new Error(claimError.message);

  const text = [
    `Job number: ${job.job_number}`,
    `Key: ${token}`,
    `Supabase URL: ${supabaseUrl}`,
    `Supabase public key: ${anonKey}`,
    `Branch: ${agentBranchFor(job.job_number)} (${again ? "already exists: continue on it" : "new: create it from origin/staging"})`,
  ].join("\n");

  const res = await fetch(`https://api.anthropic.com/v1/claude_code/routines/${routineId}/fire`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${routineToken}`,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as
    | { claude_code_session_url?: string; error?: { message?: string } }
    | null;

  if (!res?.ok || !body?.claude_code_session_url) {
    const why = body?.error?.message ?? (res ? `status ${res.status}` : "no answer");
    await supabaseAdmin
      .from("roadmap_jobs")
      .update({
        agent_status: "failed",
        agent_token_hash: null,
        agent_log: [...startLog, logLine(`Couldn't start Claude: ${why}`)],
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    throw new Error(`Couldn't start Claude: ${why}`);
  }

  // Re-read the log: the session may already have written to it.
  const latest = await getRoadmapJob(id);
  const { error } = await supabaseAdmin
    .from("roadmap_jobs")
    .update({
      agent_session_url: body.claude_code_session_url,
      agent_log: [...(latest?.agent_log ?? startLog), logLine("Claude is starting up in the cloud")],
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return (await getRoadmapJob(id))!;
}
