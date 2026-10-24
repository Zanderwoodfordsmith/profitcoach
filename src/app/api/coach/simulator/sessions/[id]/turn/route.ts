import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { liveCheck } from "@/lib/simulator/ai";
import { resolveClient } from "@/lib/simulator/custom";
import { cleanTranscript, ownSession, updateSession } from "@/lib/simulator/server";
import { situationById } from "@/lib/simulator/situations";

export const maxDuration = 30;

/** After each client answer: save the call so far and work out the stage, facts found and tip. */
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
  if (row.status !== "live") return NextResponse.json({ live: row.live });

  const body = (await request.json().catch(() => null)) as { transcript?: unknown } | null;
  // Never let a shorter copy (say, from a reloaded page) overwrite what's saved.
  const sent = cleanTranscript(body?.transcript);
  const transcript = sent.length >= row.transcript.length ? sent : row.transcript;
  await updateSession(id, { transcript });
  if (!transcript.some((l) => l.role === "coach")) return NextResponse.json({ live: row.live });

  try {
    const live = await liveCheck({ client, situation, difficulty: row.difficulty, tips: row.tips, transcript, previous: row.live });
    await updateSession(id, { live });
    return NextResponse.json({ live });
  } catch (err) {
    console.error("simulator turn:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ live: row.live });
  }
}
