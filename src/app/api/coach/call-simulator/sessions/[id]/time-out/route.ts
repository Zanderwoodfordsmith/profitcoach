import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { callTimeOutNote } from "@/lib/callSimulator/ai";
import { cleanTranscript, loadCall, updateCallSession } from "@/lib/callSimulator/server";

export const maxDuration = 60;

/** Time out: the call is paused; a short note on how it's going. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const loaded = await loadCall(check, id, { write: true });
  if (!loaded) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { row, prospect, call, parts } = loaded;

  const body = (await request.json().catch(() => null)) as { transcript?: unknown } | null;
  const sent = cleanTranscript(body?.transcript);
  const transcript = sent.length >= row.transcript.length ? sent : row.transcript;
  await updateCallSession(id, { transcript, time_outs: row.time_outs + 1 });
  if (!transcript.some((l) => l.role === "coach")) {
    return NextResponse.json({
      note: { working: "You haven't started yet.", next: parts[0]?.aim ?? call.coachAim, ask: parts[0]?.questions[0] ?? "" },
    });
  }
  try {
    const note = await callTimeOutNote({ prospect, call, parts, difficulty: row.difficulty, transcript, live: row.live });
    return NextResponse.json({ note });
  } catch (err) {
    console.error("call simulator time out:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Couldn't get a note this time." }, { status: 502 });
  }
}
