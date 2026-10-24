import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveClient } from "@/lib/simulator/custom";
import { clientPrompt } from "@/lib/simulator/prompt";
import { MONTHLY_MINUTES, coachFirstName, minutesThisMonth, ownSession, signedCallUrl, simulatorConfigured } from "@/lib/simulator/server";
import { situationById } from "@/lib/simulator/situations";
import type { CallStart } from "@/lib/simulator/types";

export const maxDuration = 30;

/**
 * "Try that moment again": a short call that picks up just before one of the
 * coach's lines. The client says their line again, then the coach has
 * another go. Saved as its own session, linked to the first.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  if (!simulatorConfigured()) return NextResponse.json({ error: "Voice isn't set up yet." }, { status: 503 });
  if (!check.callerIsAdmin && (await minutesThisMonth(check.userId)) >= MONTHLY_MINUTES) {
    return NextResponse.json({ error: `You've used your ${MONTHLY_MINUTES} practice minutes this month. They reset on the 1st.` }, { status: 429 });
  }
  const { id } = await params;
  const row = await ownSession(check, id, { write: true });
  const client = row ? await resolveClient(row.client_id, check) : null;
  const situation = row ? situationById(row.situation_id) : null;
  if (!row || !client || !situation) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { line?: unknown } | null;
  const line = Number(body?.line);
  if (!Number.isInteger(line) || line < 1 || row.transcript[line]?.role !== "coach") {
    return NextResponse.json({ error: "Pick one of your own lines to try again." }, { status: 400 });
  }
  const before = row.transcript.slice(0, line);
  const cue = [...before].reverse().find((l) => l.role === "client")?.text ?? "";

  try {
    const { data, error } = await supabaseAdmin
      .from("sim_sessions")
      .insert({
        coach_id: check.userId,
        client_id: row.client_id,
        situation_id: row.situation_id,
        difficulty: row.difficulty,
        tips: false,
        mode: "practice",
        replay_of: row.id,
        replay_line: line,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "insert failed");
    const coachName = await coachFirstName(check.userId);
    const prompt =
      clientPrompt({ client, situation, difficulty: row.difficulty, mode: "practice", coachName, previous: null, sofar: before }) +
      `\n\n# This is a replay\nThe coach is having a second go at their next line. You've just said your last line again. Answer whatever they say now as you would have done, then keep going naturally for a few turns.`;
    const call: CallStart = {
      signedUrl: await signedCallUrl(),
      prompt,
      // The client says their line again, so the coach has the moment back.
      firstMessage: cue,
      voiceId: client.voiceId,
      speed: client.speed,
    };
    return NextResponse.json({ id: data.id, call, cue, firstTry: row.transcript[line].text });
  } catch (err) {
    console.error("simulator replay:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not start the replay." }, { status: 502 });
  }
}
