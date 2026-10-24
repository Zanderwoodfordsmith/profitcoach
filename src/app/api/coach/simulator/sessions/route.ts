import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveClient } from "@/lib/simulator/custom";
import { difficultyById } from "@/lib/simulator/difficulty";
import { clientFirstMessage, clientPrompt, type PreviousSession } from "@/lib/simulator/prompt";
import {
  ASSESSMENT_SESSIONS,
  MONTHLY_MINUTES,
  minutesThisMonth,
  assessmentSessions,
  coachFirstName,
  lastScoredWith,
  latestAssessment,
  signedCallUrl,
  simulatorConfigured,
} from "@/lib/simulator/server";
import { situationById } from "@/lib/simulator/situations";
import type { CallStart, Difficulty, SimMode } from "@/lib/simulator/types";

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
  if (!check.callerIsAdmin && (await minutesThisMonth(check.userId)) >= MONTHLY_MINUTES) {
    return NextResponse.json({ error: `You've used your ${MONTHLY_MINUTES} practice minutes this month. They reset on the 1st.` }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as {
    clientId?: string;
    situationId?: string;
    difficulty?: string;
    tips?: boolean;
    mode?: string;
    focus?: string;
  } | null;
  const client = await resolveClient(String(body?.clientId ?? ""), check);
  const situation = situationById(String(body?.situationId ?? ""));
  const difficulty = difficultyById(String(body?.difficulty ?? ""))?.id as Difficulty | undefined;
  const mode: SimMode = body?.mode === "assessment" ? "assessment" : "practice";
  if (!client || !situation || !difficulty) {
    return NextResponse.json({ error: "Pick a client, a session and a level." }, { status: 400 });
  }
  if (client.custom && client.custom.status !== "ready") {
    return NextResponse.json({ error: `Check ${client.firstName} and confirm them first.` }, { status: 400 });
  }
  // "Practise your weak spot": the tips lean on this area.
  const focus = typeof body?.focus === "string" && /^[a-z-]{2,30}$/.test(body.focus) ? body.focus : null;

  let assessmentId: string | null = null;
  if (mode === "assessment") {
    if (!situation.assessable) {
      return NextResponse.json({ error: "Certification uses coaching sessions only." }, { status: 400 });
    }
    const assessment = await latestAssessment(check.userId);
    if (!assessment || assessment.status !== "in_progress") {
      return NextResponse.json({ error: "Start a certification attempt first." }, { status: 400 });
    }
    const done = (await assessmentSessions(assessment.id)).filter((s) => s.status === "scored");
    if (done.length >= ASSESSMENT_SESSIONS) {
      return NextResponse.json({ error: "All three sessions are done." }, { status: 400 });
    }
    if (done.some((s) => s.client_id === client.id)) {
      return NextResponse.json({ error: `You've already done ${client.firstName}. Pick a different client.` }, { status: 400 });
    }
    if (done.length === ASSESSMENT_SESSIONS - 1 && !done.some((s) => s.difficulty === "hard") && difficulty !== "hard") {
      return NextResponse.json({ error: "One of the three sessions has to be on Hard." }, { status: 400 });
    }
    assessmentId = assessment.id;
  }

  let previous: PreviousSession | null = null;
  let followsId: string | null = null;
  if (situation.needsPrevious) {
    const last = await lastScoredWith(check.userId, client.id);
    if (!last?.report) {
      return NextResponse.json({ error: `Do a session with ${client.firstName} first.` }, { status: 400 });
    }
    followsId = last.id;
    previous = {
      when: new Date(last.started_at).toLocaleDateString("en-GB", { day: "numeric", month: "long" }),
      agreedActions: last.report.agreedActions,
      summary: last.report.summary,
    };
  }

  try {
    const coachName = await coachFirstName(check.userId);
    const { data, error } = await supabaseAdmin
      .from("sim_sessions")
      .insert({
        coach_id: check.userId,
        client_id: client.id,
        situation_id: situation.id,
        difficulty,
        tips: mode === "assessment" ? false : body?.tips !== false,
        mode,
        assessment_id: assessmentId,
        follows_session_id: followsId,
        ...(focus && mode === "practice" ? { live: { focus } } : {}),
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "insert failed");

    const call: CallStart = {
      signedUrl: await signedCallUrl(),
      prompt: clientPrompt({ client, situation, difficulty, mode, coachName, previous }),
      firstMessage: clientFirstMessage({ client, situation, difficulty, coachName }),
      voiceId: client.voiceId,
      speed: client.speed,
    };
    return NextResponse.json({ id: data.id, call });
  } catch (err) {
    console.error("simulator start:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not start the call." }, { status: 502 });
  }
}
