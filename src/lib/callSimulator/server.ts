import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanTranscript } from "@/lib/simulator/server";

import { callById, sessionParts } from "./calls";
import { prospectById, type Prospect } from "./prospects";
import type { CallSessionRow, CallSessionSummary, SimCallType, SimStage } from "./types";

/**
 * Server-only: the call simulator's table. The voice agent, signed URLs,
 * audio and transcript cleaning are the Client simulator's (one agent plays
 * every owner).
 */

export { cleanTranscript };

export const CALL_SESSION_SUMMARY_COLUMNS =
  "id, coach_id, prospect_id, call_id, start_part, objections, difficulty, tips, status, time_outs, score, outcome, started_at, ended_at";

export async function getCallSession(id: string): Promise<CallSessionRow | null> {
  const { data } = await supabaseAdmin.from("call_sim_sessions").select("*").eq("id", id).maybeSingle();
  return (data as CallSessionRow | null) ?? null;
}

export async function updateCallSession(id: string, patch: Partial<CallSessionRow>): Promise<void> {
  const { error } = await supabaseAdmin.from("call_sim_sessions").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listCallSessions(coachId: string, limit = 40): Promise<CallSessionSummary[]> {
  const { data } = await supabaseAdmin
    .from("call_sim_sessions")
    .select(CALL_SESSION_SUMMARY_COLUMNS)
    .eq("coach_id", coachId)
    .neq("status", "abandoned")
    .order("started_at", { ascending: false })
    .limit(limit);
  return (data as CallSessionSummary[] | null) ?? [];
}

/** The signed-in coach's own session. Admins may read anyone's but only change their own. */
export async function ownCallSession(
  check: { userId: string; callerIsAdmin: boolean },
  id: string,
  opts: { write?: boolean } = {}
): Promise<CallSessionRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const row = await getCallSession(id);
  if (!row) return null;
  if (row.coach_id === check.userId) return row;
  return !opts.write && check.callerIsAdmin ? row : null;
}

/** Everything a route needs about a session: the row, the owner, the call and the parts it covers. */
export async function loadCall(
  check: { userId: string; callerIsAdmin: boolean },
  id: string,
  opts: { write?: boolean } = {}
): Promise<{ row: CallSessionRow; prospect: Prospect; call: SimCallType; parts: SimStage[] } | null> {
  const row = await ownCallSession(check, id, opts);
  const prospect = row ? prospectById(row.prospect_id) : null;
  const call = row ? callById(row.call_id) : null;
  if (!row || !prospect || !call) return null;
  return { row, prospect, call, parts: sessionParts(call, { startPart: row.start_part, objections: row.objections }) };
}
