/**
 * Import the practice calls coaches made on the old Retell simulators into
 * retell_practice_calls: transcript (coaching part only), recording as a mono
 * MP3 in the retell-recordings bucket, and a Client simulator score. Safe to
 * re-run: each step skips calls that already have it.
 *
 *   npx tsx scripts/retell-import.ts --dry-run    # counts only, writes nothing
 *   npx tsx scripts/retell-import.ts --no-score   # transcripts and recordings
 *   npx tsx scripts/retell-import.ts              # all three
 *
 * Needs RETELL_API_KEY in .env.local and ffmpeg on the PATH.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadEnvConfig } from "@next/env";

import { RETELL_AGENTS as AGENTS } from "../src/lib/simulator/retell";

loadEnvConfig(process.cwd());

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const noScore = argv.includes("--no-score");
const noAudio = argv.includes("--no-audio");
const WORKERS = 6;
const MIN_MS = 3 * 60_000;

const RETELL = "https://api.retellai.com";
const headers = { Authorization: `Bearer ${process.env.RETELL_API_KEY}`, "Content-Type": "application/json" };

function difficultyOf(agentName: string): "easy" | "medium" | "hard" | null {
  if (agentName.includes("🟢")) return "easy";
  if (agentName.includes("🟡")) return "medium";
  if (agentName.includes("🔴")) return "hard";
  return /Time-management/i.test(agentName) ? "easy" : null;
}

type RetellUtterance = { role: string; content?: string; words?: { start: number }[]; name?: string };
type RetellCall = {
  call_id: string;
  agent_name: string;
  call_status: string;
  start_timestamp: number;
  duration_ms: number;
  recording_url?: string;
  transcript_with_tool_calls?: RetellUtterance[];
  transcript_object?: RetellUtterance[];
};

async function retell<T>(path: string, init?: RequestInit): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${RETELL}${path}`, { ...init, headers });
    if (res.ok) return (await res.json()) as T;
    if (attempt < 5 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    throw new Error(`Retell ${path}: ${res.status} ${await res.text()}`);
  }
}

async function listCalls(): Promise<RetellCall[]> {
  const all: RetellCall[] = [];
  let pagination_key: string | undefined;
  do {
    const page = await retell<{ items: RetellCall[]; has_more: boolean; pagination_key?: string }>("/v3/list-calls", {
      method: "POST",
      body: JSON.stringify({ limit: 1000, sort_order: "ascending", ...(pagination_key ? { pagination_key } : {}) }),
    });
    all.push(...page.items);
    pagination_key = page.has_more ? page.pagination_key : undefined;
  } while (pagination_key);
  return all;
}

/** The coaching part: everything before Retell switched to spoken feedback. */
function transcriptOf(call: RetellCall) {
  const items = call.transcript_with_tool_calls ?? call.transcript_object ?? [];
  const cut = items.findIndex((u) => u.role === "tool_call_invocation" && /feedback/i.test(u.name ?? ""));
  return (cut >= 0 ? items.slice(0, cut) : items)
    .filter((u) => (u.role === "user" || u.role === "agent") && u.content?.trim())
    .map((u) => ({
      role: u.role === "user" ? ("coach" as const) : ("client" as const),
      text: u.content!.trim(),
      ...(u.words?.[0] ? { at: Math.round(u.words[0].start * 10) / 10 } : {}),
    }));
}

const NOT_NAMES = /^(Part|Going|Here|Really|Just|Very|So|Not|Sure|Glad|Happy|Looking|Fine|Good|Okay|Great|The|A|Your|Gonna|Doing|Marcus|Sarah|Anna|David|Helen|Alex|Chen)$/;

/** The coach, when they said their full name or a first name only one profile has. */
function matchCoach(coachText: string, profiles: { id: string; full_name: string }[]) {
  const head = coachText.slice(0, 1500);
  const lower = head.toLowerCase();
  const intro = [...head.matchAll(/\b(?:my name is|my name's|i'm|i am|this is|name is)\s+([A-Z][a-z]+)(?:\s+([A-Z][a-z]+))?/g)]
    .map((m) => [m[1], m[2]].filter(Boolean) as string[])
    .find((n) => !NOT_NAMES.test(n[0]));
  let found = profiles.filter((p) => p.full_name.includes(" ") && lower.includes(p.full_name.toLowerCase()));
  if (!found.length && intro) {
    found = profiles.filter((p) => {
      const parts = p.full_name.toLowerCase().split(/\s+/);
      return parts[0] === intro[0].toLowerCase() && (!intro[1] || parts.slice(1).join(" ").startsWith(intro[1].toLowerCase()));
    });
  }
  const heard = found.length === 1 ? found[0].full_name : intro?.join(" ") ?? null;
  return { coachId: found.length === 1 ? found[0].id : null, heard };
}

async function pool<T>(items: T[], fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: WORKERS }, async () => {
      while (queue.length) await fn(queue.shift()!);
    })
  );
}

async function main() {
  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
  const { clientById } = await import("../src/lib/simulator/clients");
  const { situationById } = await import("../src/lib/simulator/situations");
  const { scoreSession } = await import("../src/lib/simulator/ai");

  const calls = (await listCalls()).filter((c) => c.call_status === "ended" && c.duration_ms >= MIN_MS);
  const { data: existing } = await supabaseAdmin.from("retell_practice_calls").select("call_id, recording_path, score");
  const have = new Map((existing ?? []).map((r) => [r.call_id as string, r]));
  console.log(`${calls.length} calls of 3 minutes or more; ${have.size} already imported.`);
  if (dryRun) return;

  const { data: profiles, error } = await supabaseAdmin.from("profiles").select("id, full_name").not("full_name", "is", null);
  if (error) throw new Error(error.message);
  const named = (profiles ?? []).map((p) => ({ id: p.id as string, full_name: String(p.full_name).trim() }));

  // 1. Transcripts
  const fresh = calls.filter((c) => !have.has(c.call_id));
  let done = 0;
  await pool(fresh, async (c) => {
    const call = await retell<RetellCall>(`/v2/get-call/${c.call_id}`);
    const transcript = transcriptOf(call);
    const agent = AGENTS.find((a) => a.match.test(call.agent_name));
    const { coachId, heard } = matchCoach(transcript.filter((l) => l.role === "coach").map((l) => l.text).join(" "), named);
    const { error: e } = await supabaseAdmin.from("retell_practice_calls").insert({
      call_id: call.call_id,
      agent_name: call.agent_name,
      client_id: agent?.clientId ?? null,
      difficulty: difficultyOf(call.agent_name),
      started_at: new Date(call.start_timestamp).toISOString(),
      duration_seconds: Math.round(call.duration_ms / 1000),
      coach_id: coachId,
      coach_name_heard: heard,
      transcript,
    });
    if (e) throw new Error(`${call.call_id}: ${e.message}`);
    have.set(call.call_id, { call_id: call.call_id, recording_path: null, score: null });
    if (++done % 50 === 0) console.log(`  transcripts ${done}/${fresh.length}`);
  });
  console.log(`Transcripts: ${done} new.`);

  // 2. Recordings, as mono 32 kbps MP3 (speech; about a tenth of the WAV).
  if (!noAudio) {
    const missing = calls.filter((c) => !have.get(c.call_id)?.recording_path);
    const dir = mkdtempSync(join(tmpdir(), "retell-"));
    let saved = 0;
    await pool(missing, (c) => saveRecording(c).catch((e) => console.log(`  ${c.call_id}: ${(e as Error).message}`)));
    async function saveRecording(c: RetellCall) {
      const call = await retell<RetellCall>(`/v2/get-call/${c.call_id}`);
      if (!call.recording_url) return;
      const res = await fetch(call.recording_url);
      if (!res.ok) return console.log(`  ${c.call_id}: recording ${res.status}`);
      const wav = join(dir, `${c.call_id}.wav`);
      const mp3 = join(dir, `${c.call_id}.mp3`);
      writeFileSync(wav, Buffer.from(await res.arrayBuffer()));
      execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", wav, "-ac", "1", "-b:a", "32k", mp3]);
      const path = `${c.call_id}.mp3`;
      const { error: up } = await supabaseAdmin.storage
        .from("retell-recordings")
        .upload(path, readFileSync(mp3), { contentType: "audio/mpeg", upsert: true });
      rmSync(wav);
      rmSync(mp3);
      if (up) return console.log(`  ${c.call_id}: upload ${up.message}`);
      await supabaseAdmin.from("retell_practice_calls").update({ recording_path: path }).eq("call_id", c.call_id);
      if (++saved % 50 === 0) console.log(`  recordings ${saved}/${missing.length}`);
    }
    rmSync(dir, { recursive: true, force: true });
    console.log(`Recordings: ${saved} saved.`);
  }

  // 3. Scores
  if (!noScore) {
    const situation = situationById("coaching")!;
    const { data: rows } = await supabaseAdmin
      .from("retell_practice_calls")
      .select("call_id, agent_name, client_id, difficulty, transcript")
      .is("score", null)
      .not("client_id", "is", null);
    // Too short to judge: a coach who said fewer than ten things.
    const todo = (rows ?? []).filter((r) => (r.transcript as { role: string }[]).filter((l) => l.role === "coach").length >= 10);
    let scored = 0;
    let failed = 0;
    await pool(todo, async (r) => {
      const base = clientById(r.client_id as string)!;
      const oldName = AGENTS.find((a) => a.clientId === r.client_id)!.oldName;
      // The transcript uses the Retell client's name, so the scorer gets that name.
      const client = { ...base, name: oldName, firstName: oldName.split(" ")[0] };
      try {
        const { report, score } = await scoreSession({
          client,
          situation,
          difficulty: (r.difficulty ?? "medium") as "easy" | "medium" | "hard",
          transcript: r.transcript as Parameters<typeof scoreSession>[0]["transcript"],
          timeOuts: 0,
        });
        await supabaseAdmin.from("retell_practice_calls").update({ report, score }).eq("call_id", r.call_id);
        if (++scored % 25 === 0) console.log(`  scored ${scored}/${todo.length}`);
      } catch (e) {
        failed++;
        console.log(`  ${r.call_id}: ${(e as Error).message}`);
      }
    });
    console.log(`Scores: ${scored} scored, ${failed} failed, ${(rows?.length ?? 0) - todo.length} too short to score.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
