import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { prospectPrompt } from "@/lib/callSimulator/prompt";
import { cleanTranscript, loadCall, updateCallSession } from "@/lib/callSimulator/server";
import { coachFirstName, signedCallUrl } from "@/lib/simulator/server";
import type { CallStart } from "@/lib/simulator/types";

export const maxDuration = 30;

/**
 * Back from a time out, a dropped line, or a skip ahead: a fresh call that
 * knows everything said so far and waits for the coach.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const loaded = await loadCall(check, id, { write: true });
  if (!loaded) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { row, prospect, call } = loaded;
  if (row.status !== "live") return NextResponse.json({ error: "This call has ended." }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { skipTo?: unknown; transcript?: unknown } | null;
  const skipTo = typeof body?.skipTo === "string" && call.parts.some((p) => p.id === body.skipTo) ? body.skipTo : null;
  // A skip comes straight from the live call, so save the latest lines first.
  const sent = cleanTranscript(body?.transcript);
  const transcript = sent.length > row.transcript.length ? sent : row.transcript;
  if (transcript !== row.transcript) await updateCallSession(id, { transcript });
  if (skipTo) await updateCallSession(id, { live: { ...row.live, stage: skipTo } });
  try {
    const coachName = await coachFirstName(check.userId);
    const start: CallStart = {
      signedUrl: await signedCallUrl(),
      prompt: prospectPrompt({
        prospect,
        call,
        difficulty: row.difficulty,
        coachName,
        startPart: row.start_part,
        objections: row.objections,
        sofar: transcript,
        skipTo,
      }),
      firstMessage: "",
      voiceId: prospect.voiceId,
      speed: prospect.speed,
    };
    return NextResponse.json({ call: start });
  } catch (err) {
    console.error("call simulator resume:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not restart the call." }, { status: 502 });
  }
}
