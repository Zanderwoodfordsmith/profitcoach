import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { callLiveCheck } from "@/lib/callSimulator/ai";
import { cleanTranscript, loadCall, updateCallSession } from "@/lib/callSimulator/server";

export const maxDuration = 30;

/** After each owner answer: save the call so far and work out the part, facts found and tip. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const loaded = await loadCall(check, id, { write: true });
  if (!loaded) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { row, prospect, call, parts } = loaded;
  if (row.status !== "live") return NextResponse.json({ live: row.live });

  const body = (await request.json().catch(() => null)) as { transcript?: unknown } | null;
  // Never let a shorter copy (say, from a reloaded page) overwrite what's saved.
  const sent = cleanTranscript(body?.transcript);
  const transcript = sent.length >= row.transcript.length ? sent : row.transcript;
  await updateCallSession(id, { transcript });
  if (!transcript.some((l) => l.role === "coach")) return NextResponse.json({ live: row.live });

  try {
    const live = await callLiveCheck({ prospect, call, parts, difficulty: row.difficulty, tips: row.tips, transcript, previous: row.live });
    await updateCallSession(id, { live });
    return NextResponse.json({ live });
  } catch (err) {
    console.error("call simulator turn:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ live: row.live });
  }
}
