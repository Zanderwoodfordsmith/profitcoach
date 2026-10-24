import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { SimAssessmentRow, SimSessionRow } from "./types";

/**
 * Server-only: the simulator's tables and the ElevenLabs agent. One agent
 * plays every client; each call sends its own prompt, opening line and voice.
 */

/** Zander thinks the certification pass mark is 60% (30 of 50), maybe 70%. To confirm. */
export const PASS_MARK = 30;
/** Certification: this many coaching sessions, at least one on Hard, three different clients. */
export const ASSESSMENT_SESSIONS = 3;

export function simulatorConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim() && process.env.SIMULATOR_ELEVENLABS_AGENT_ID?.trim());
}

export async function signedCallUrl(): Promise<string> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(process.env.SIMULATOR_ELEVENLABS_AGENT_ID!.trim())}`,
    { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!.trim() } }
  );
  if (!res.ok) throw new Error(`ElevenLabs signed URL failed (${res.status})`);
  const body = (await res.json()) as { signed_url?: string };
  if (!body.signed_url) throw new Error("ElevenLabs sent no signed URL");
  return body.signed_url;
}

export async function conversationAudio(conversationId: string): Promise<Response> {
  return fetch(`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}/audio`, {
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!.trim() },
  });
}

export async function coachFirstName(coachId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("profiles").select("first_name, full_name").eq("id", coachId).maybeSingle();
  const first = (data?.first_name as string | null)?.trim() || (data?.full_name as string | null)?.trim().split(/\s+/)[0];
  return first || null;
}

export const SESSION_SUMMARY_COLUMNS =
  "id, coach_id, client_id, situation_id, difficulty, tips, mode, assessment_id, follows_session_id, status, score, reviewed_score, time_outs, started_at, ended_at, replay_of, replay_line, shared_at, share_score, scoring_passes";

export type SimSessionSummary = Omit<SimSessionRow, "transcript" | "live" | "conversation_ids" | "report">;

export async function getSession(id: string): Promise<SimSessionRow | null> {
  const { data } = await supabaseAdmin.from("sim_sessions").select("*").eq("id", id).maybeSingle();
  return (data as SimSessionRow | null) ?? null;
}

export async function updateSession(id: string, patch: Partial<SimSessionRow>): Promise<void> {
  const { error } = await supabaseAdmin.from("sim_sessions").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listSessions(coachId: string, limit = 40): Promise<SimSessionSummary[]> {
  const { data } = await supabaseAdmin
    .from("sim_sessions")
    .select(SESSION_SUMMARY_COLUMNS)
    .eq("coach_id", coachId)
    .neq("status", "abandoned")
    // Moment replays live on the report they came from, not in the history.
    .is("replay_of", null)
    .order("started_at", { ascending: false })
    .limit(limit);
  return (data as SimSessionSummary[] | null) ?? [];
}

/** The latest scored session with this client, for a follow-up. */
export async function lastScoredWith(coachId: string, clientId: string): Promise<SimSessionRow | null> {
  const { data } = await supabaseAdmin
    .from("sim_sessions")
    .select("*")
    .eq("coach_id", coachId)
    .eq("client_id", clientId)
    .eq("status", "scored")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SimSessionRow | null) ?? null;
}

export async function latestAssessment(coachId: string): Promise<SimAssessmentRow | null> {
  const { data } = await supabaseAdmin
    .from("sim_assessments")
    .select("*")
    .eq("coach_id", coachId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SimAssessmentRow | null) ?? null;
}

export async function assessmentSessions(assessmentId: string): Promise<SimSessionSummary[]> {
  const { data } = await supabaseAdmin
    .from("sim_sessions")
    .select(SESSION_SUMMARY_COLUMNS)
    .eq("assessment_id", assessmentId)
    .neq("status", "abandoned")
    .order("started_at", { ascending: true });
  return (data as SimSessionSummary[] | null) ?? [];
}

/** Once the third assessment session is scored, work out the average and hand it in for review. */
export async function submitAssessmentIfDone(assessmentId: string): Promise<void> {
  const sessions = (await assessmentSessions(assessmentId)).filter((s) => s.status === "scored" && s.score !== null);
  if (sessions.length < ASSESSMENT_SESSIONS) return;
  const average = Math.round((sessions.reduce((sum, s) => sum + (s.score ?? 0), 0) / sessions.length) * 10) / 10;
  await supabaseAdmin
    .from("sim_assessments")
    .update({ status: "submitted", average, passed: average >= PASS_MARK, submitted_at: new Date().toISOString() })
    .eq("id", assessmentId)
    .eq("status", "in_progress");
}

/** Ava's voice for the spoken feedback, a little quicker than its natural pace. */
export const AVA_FEEDBACK_VOICE = "NTqGiNK8P02i66yY2GOH";
export const AVA_FEEDBACK_SPEED = 1.08;

/**
 * The signed-in coach's own session. Admins may read anyone's (to review
 * assessments) but only change their own.
 */
export async function ownSession(
  check: { userId: string; callerIsAdmin: boolean },
  id: string,
  opts: { write?: boolean } = {}
): Promise<SimSessionRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const row = await getSession(id);
  if (!row) return null;
  if (row.coach_id === check.userId) return row;
  // Admins read any session to review it; any coach reads one shared with the community.
  return !opts.write && (check.callerIsAdmin || row.shared_at) ? row : null;
}

/** Transcript lines from the browser: trimmed, capped, and only the two roles. */
export function cleanTranscript(raw: unknown): SimSessionRow["transcript"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 600)
    .map((l) => {
      const line = l as { role?: unknown; text?: unknown; at?: unknown };
      const role = line.role === "coach" ? "coach" : line.role === "client" ? "client" : null;
      // Drop sound cues like "[nervous laugh]" that some voice models add.
      const text = typeof line.text === "string" ? line.text.replace(/\[[a-z ,'-]{2,40}\]\s*/gi, "").trim().slice(0, 2000) : "";
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : undefined);
      const at = num(line.at);
      const part = num((l as { part?: unknown }).part);
      const t = num((l as { t?: unknown }).t);
      return role && text
        ? { role, text, ...(at !== undefined ? { at } : {}), ...(part !== undefined ? { part: Math.round(part) } : {}), ...(t !== undefined ? { t } : {}) }
        : null;
    })
    .filter((l): l is SimSessionRow["transcript"][number] => Boolean(l));
}

/** Which client best drills each area, for "Practise your weak spot". */
const DRILLS: Record<string, string> = {
  change: "marcus",
  objective: "priya",
  anchors: "david",
  choices: "kit",
  how: "jess",
  questioning: "david",
  listening: "sarah",
  workflow: "kit",
  execution: "jess",
  rapport: "helen",
};

export type WeakSpot = { id: string; label: string; average: number; sessions: number; clientId: string };

/**
 * The coach's weakest area over their last ten scored sessions: the POWER
 * skills from every session, the COACH stages from coaching sessions. Needs
 * at least two sessions to mean anything.
 */
export async function weakSpot(coachId: string): Promise<WeakSpot | null> {
  const { data } = await supabaseAdmin
    .from("sim_sessions")
    .select("situation_id, report")
    .eq("coach_id", coachId)
    .eq("status", "scored")
    .is("replay_of", null)
    .order("started_at", { ascending: false })
    .limit(10);
  const rows = ((data ?? []) as { situation_id: string; report: SimSessionRow["report"] }[]).filter((r) => r.report?.power?.length);
  if (rows.length < 2) return null;
  const totals = new Map<string, { label: string; sum: number; n: number }>();
  for (const r of rows) {
    const areas = [...r.report!.power, ...(r.situation_id === "coaching" ? r.report!.stages : [])];
    for (const a of areas) {
      const t = totals.get(a.id) ?? { label: a.label, sum: 0, n: 0 };
      t.sum += a.score;
      t.n += 1;
      totals.set(a.id, t);
    }
  }
  let worst: WeakSpot | null = null;
  for (const [id, t] of totals) {
    const average = Math.round((t.sum / t.n) * 10) / 10;
    if (!worst || average < worst.average) worst = { id, label: t.label, average, sessions: rows.length, clientId: DRILLS[id] ?? "jess" };
  }
  return worst;
}

/**
 * Practice minutes each coach gets a month. Voice costs about 1,000 ElevenLabs
 * credits a minute; Zander is happy to raise this (23 Oct). Admins have no limit.
 */
export const MONTHLY_MINUTES = 240;

type Timed = { started_at: string; ended_at: string | null; last_at?: string | null };

/**
 * A call's length. One that never ended (the tab closed, or it dropped) runs
 * to its last line plus half a minute, or one minute if nothing was said, so
 * a closed tab doesn't cost a coach the full 45.
 */
function sessionMinutes(s: Timed): number {
  if (!s.ended_at) {
    const last = Number(s.last_at);
    return Number.isFinite(last) && last > 0 ? (last + 30) / 60 : 1;
  }
  return Math.max(0, (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60_000);
}

const TIMED = "started_at, ended_at, last_at:transcript->-1->>at";

function monthStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

/** Both simulators share the minutes, since they use the same ElevenLabs account (Zander, 24 Oct). Dropped calls count: they used voice. */
const VOICE_TABLES = ["sim_sessions", "call_sim_sessions"] as const;

export async function minutesThisMonth(coachId: string): Promise<number> {
  const results = await Promise.all(
    VOICE_TABLES.map((t) => supabaseAdmin.from(t).select(TIMED).eq("coach_id", coachId).gte("started_at", monthStart()))
  );
  const rows = results.flatMap((r) => (r.data ?? []) as unknown as Timed[]);
  return Math.round(rows.reduce((sum, s) => sum + sessionMinutes(s), 0));
}

/** Minutes this month by coach, for the admin usage list. */
export async function minutesByCoach(): Promise<{ coach_id: string; minutes: number; sessions: number }[]> {
  const results = await Promise.all(
    VOICE_TABLES.map((t) => supabaseAdmin.from(t).select(`coach_id, ${TIMED}`).gte("started_at", monthStart()).limit(5000))
  );
  const by = new Map<string, { minutes: number; sessions: number }>();
  for (const s of results.flatMap((r) => (r.data ?? []) as unknown as (Timed & { coach_id: string })[])) {
    const t = by.get(s.coach_id) ?? { minutes: 0, sessions: 0 };
    t.minutes += sessionMinutes(s);
    t.sessions += 1;
    by.set(s.coach_id, t);
  }
  return Array.from(by, ([coach_id, t]) => ({ coach_id, minutes: Math.round(t.minutes), sessions: t.sessions })).sort((a, b) => b.minutes - a.minutes);
}

/**
 * Exact timings for the player. ElevenLabs keeps when each line was said in
 * each recording; once it has finished processing a call, copy those times
 * onto our lines (matched in order, coach to "user", client to "agent") and
 * mark the session so it only happens once. Until then the page's own
 * estimates stand.
 */
export async function alignTimes(row: SimSessionRow): Promise<SimSessionRow> {
  if (row.live?.aligned || !row.conversation_ids.length || row.status !== "scored") return row;
  const transcript = row.transcript.map((l) => ({ ...l }));
  for (let part = 0; part < row.conversation_ids.length; part++) {
    const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(row.conversation_ids[part])}`, {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!.trim() },
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as {
      status?: string;
      transcript?: { role: "user" | "agent"; message: string | null; time_in_call_secs: number }[];
    } | null;
    if (!body || body.status !== "done" || !body.transcript) return row;
    const said = body.transcript.filter((m) => m.message?.trim());
    const ours = transcript.filter((l) => (l.part ?? 0) === part);
    let j = 0;
    for (const line of ours) {
      const want = line.role === "coach" ? "user" : "agent";
      while (j < said.length && said[j].role !== want) j++;
      if (j >= said.length) break;
      line.t = said[j].time_in_call_secs;
      j++;
    }
  }
  const live = { ...row.live, aligned: true };
  await updateSession(row.id, { transcript, live });
  return { ...row, transcript, live };
}
