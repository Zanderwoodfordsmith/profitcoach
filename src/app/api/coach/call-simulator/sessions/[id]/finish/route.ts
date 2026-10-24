import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { scoreCall } from "@/lib/callSimulator/ai";
import { cleanTranscript, loadCall, updateCallSession } from "@/lib/callSimulator/server";

export const maxDuration = 300;

/** End the call and score it. A call with almost nothing said is dropped, not scored. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const loaded = await loadCall(check, id, { write: true });
  if (!loaded) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { row, prospect, call, parts } = loaded;
  if (row.status === "scored") return NextResponse.json({ status: "scored", score: row.score });

  const body = (await request.json().catch(() => null)) as { transcript?: unknown } | null;
  const sent = cleanTranscript(body?.transcript);
  const transcript = sent.length >= row.transcript.length ? sent : row.transcript;
  const ended_at = new Date().toISOString();

  // Short calls are the point here (a cold call can be two minutes), so two lines from the coach is enough.
  if (transcript.filter((l) => l.role === "coach").length < 2) {
    await updateCallSession(id, { transcript, status: "abandoned", ended_at });
    return NextResponse.json({ status: "abandoned" });
  }

  await updateCallSession(id, { transcript, status: "scoring", ended_at });
  try {
    const { report, score } = await scoreCall({
      prospect,
      call,
      parts,
      difficulty: row.difficulty,
      startPart: row.start_part,
      transcript,
      timeOuts: row.time_outs,
    });
    await updateCallSession(id, { report, score, outcome: report.outcome.result, status: "scored" });
    return NextResponse.json({ status: "scored", score });
  } catch (err) {
    console.error("call simulator finish:", err instanceof Error ? err.message : "failed");
    // Leave it in "scoring" so the report page can try again.
    return NextResponse.json({ error: "Couldn't score the call. Try again from the report." }, { status: 502 });
  }
}
