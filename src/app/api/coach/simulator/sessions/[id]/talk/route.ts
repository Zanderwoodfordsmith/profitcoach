import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { resolveClient } from "@/lib/simulator/custom";
import { feedbackFirstMessage, feedbackPrompt } from "@/lib/simulator/prompt";
import { AVA_FEEDBACK_SPEED, AVA_FEEDBACK_VOICE, coachFirstName, ownSession, signedCallUrl } from "@/lib/simulator/server";
import { situationById } from "@/lib/simulator/situations";
import type { CallStart } from "@/lib/simulator/types";

export const maxDuration = 30;

/** "Talk it through": Ava goes over the saved report by voice. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await ownSession(check, id, { write: true });
  const client = row ? await resolveClient(row.client_id, check) : null;
  const situation = row ? situationById(row.situation_id) : null;
  if (!row || !client || !situation) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!row.report || row.score === null) {
    return NextResponse.json({ error: "The report isn't ready yet." }, { status: 400 });
  }
  try {
    const coachName = await coachFirstName(check.userId);
    const call: CallStart = {
      signedUrl: await signedCallUrl(),
      prompt: feedbackPrompt({ client, situation, report: row.report, score: row.score, transcript: row.transcript, coachName }),
      firstMessage: feedbackFirstMessage(row.report, row.score),
      voiceId: AVA_FEEDBACK_VOICE,
      speed: AVA_FEEDBACK_SPEED,
    };
    return NextResponse.json({ call });
  } catch (err) {
    console.error("simulator talk:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not start the feedback call." }, { status: 502 });
  }
}
