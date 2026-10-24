import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { callById } from "@/lib/callSimulator/calls";
import { MAX_OBJECTIONS, objectionList } from "@/lib/callSimulator/objections";
import { prospectById } from "@/lib/callSimulator/prospects";
import { prospectFirstMessage, prospectPrompt } from "@/lib/callSimulator/prompt";
import { difficultyById } from "@/lib/simulator/difficulty";
import { coachFirstName, signedCallUrl, simulatorConfigured } from "@/lib/simulator/server";
import type { CallStart, Difficulty } from "@/lib/simulator/types";

export const maxDuration = 30;

/** Start a practice call: save the session, then hand back what ElevenLabs needs. */
export async function POST(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  if (!simulatorConfigured()) {
    return NextResponse.json({ error: "Voice isn't set up yet." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as {
    prospectId?: string;
    callId?: string;
    difficulty?: string;
    tips?: boolean;
    startPart?: string | null;
    objections?: unknown;
  } | null;
  const prospect = prospectById(String(body?.prospectId ?? ""));
  const call = callById(String(body?.callId ?? ""));
  const difficulty = difficultyById(String(body?.difficulty ?? ""))?.id as Difficulty | undefined;
  if (!prospect || !call || !difficulty) {
    return NextResponse.json({ error: "Pick an owner, a call and a level." }, { status: 400 });
  }
  const startPart = call.startable && call.parts.some((p) => p.id === body?.startPart) ? String(body?.startPart) : null;
  const allowed = call.drill ? objectionList(call.drill).map((o) => o.id) : [];
  const objections = Array.isArray(body?.objections)
    ? Array.from(new Set(body.objections.map(String).filter((id) => allowed.includes(id)))).slice(0, MAX_OBJECTIONS)
    : [];
  if (call.drill && !objections.length) {
    return NextResponse.json({ error: "Pick at least one objection, or Surprise me." }, { status: 400 });
  }

  try {
    const coachName = await coachFirstName(check.userId);
    const { data, error } = await supabaseAdmin
      .from("call_sim_sessions")
      .insert({
        coach_id: check.userId,
        prospect_id: prospect.id,
        call_id: call.id,
        start_part: startPart,
        objections,
        difficulty,
        tips: body?.tips !== false,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "insert failed");

    const start: CallStart = {
      signedUrl: await signedCallUrl(),
      prompt: prospectPrompt({ prospect, call, difficulty, coachName, startPart, objections }),
      firstMessage: prospectFirstMessage(call, prospect, coachName, startPart),
      voiceId: prospect.voiceId,
      speed: prospect.speed,
    };
    return NextResponse.json({ id: data.id, call: start });
  } catch (err) {
    console.error("call simulator start:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not start the call." }, { status: 502 });
  }
}
