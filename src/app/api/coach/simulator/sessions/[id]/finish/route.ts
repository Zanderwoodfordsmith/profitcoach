import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { averageReports, checkReplay, scoreSession } from "@/lib/simulator/ai";
import { resolveClient } from "@/lib/simulator/custom";
import { cleanTranscript, getSession, ownSession, submitAssessmentIfDone, updateSession } from "@/lib/simulator/server";
import { situationById } from "@/lib/simulator/situations";
import type { SimReport } from "@/lib/simulator/types";

export const maxDuration = 300;

/**
 * End the call and score it. Practice is scored once; certification twice,
 * averaged. A moment replay is checked against the first try instead. A call
 * with almost nothing said is dropped, not scored.
 */
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
  if (row.status === "scored") return NextResponse.json({ status: "scored", score: row.score });

  const body = (await request.json().catch(() => null)) as { transcript?: unknown } | null;
  const sent = cleanTranscript(body?.transcript);
  const transcript = sent.length >= row.transcript.length ? sent : row.transcript;
  const ended_at = new Date().toISOString();

  if (row.replay_of !== null && row.replay_line !== null) {
    const original = await getSession(row.replay_of);
    const line = row.replay_line;
    if (!original || !transcript.some((l) => l.role === "coach")) {
      await updateSession(id, { transcript, status: "abandoned", ended_at });
      return NextResponse.json({ status: "abandoned" });
    }
    await updateSession(id, { transcript, status: "scoring", ended_at });
    try {
      const why =
        original.report?.notes?.find((n) => n.line === line)?.text ??
        original.report?.moments.find((m) => m.line === line)?.note ??
        "It missed a chance to go deeper.";
      const result = await checkReplay({
        client,
        situation,
        before: original.transcript.slice(0, line),
        firstTry: original.transcript[line]?.text ?? "",
        why,
        retry: transcript,
      });
      const report: SimReport = {
        summary: result.note,
        stages: [],
        power: [],
        strongest: "",
        focus: [],
        moments: [],
        oneThing: result.tryNext,
        agreedActions: [],
        found: [],
        replay: result,
      };
      await updateSession(id, { report, status: "scored" });
      return NextResponse.json({ status: "scored", replay: result });
    } catch (err) {
      console.error("simulator replay check:", err instanceof Error ? err.message : "failed");
      return NextResponse.json({ error: "Couldn't check the replay. Try again." }, { status: 502 });
    }
  }

  if (transcript.filter((l) => l.role === "coach").length < 3) {
    await updateSession(id, { transcript, status: "abandoned", ended_at });
    return NextResponse.json({ status: "abandoned" });
  }

  await updateSession(id, { transcript, status: "scoring", ended_at });
  try {
    const input = { client, situation, difficulty: row.difficulty, transcript, timeOuts: row.time_outs };
    const twice = row.mode === "assessment";
    const { report, score } = twice
      ? averageReports(...((await Promise.all([scoreSession(input), scoreSession(input)])) as [Awaited<ReturnType<typeof scoreSession>>, Awaited<ReturnType<typeof scoreSession>>]))
      : await scoreSession(input);
    await updateSession(id, { report, score, status: "scored", scoring_passes: twice ? 2 : 1 });
    if (row.assessment_id) await submitAssessmentIfDone(row.assessment_id);
    return NextResponse.json({ status: "scored", score });
  } catch (err) {
    console.error("simulator finish:", err instanceof Error ? err.message : "failed");
    // Leave it in "scoring" so the report page can try again.
    return NextResponse.json({ error: "Couldn't score the session. Try again from the report." }, { status: 502 });
  }
}
