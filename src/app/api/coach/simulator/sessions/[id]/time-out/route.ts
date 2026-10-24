import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { timeOutNote } from "@/lib/simulator/ai";
import { resolveClient } from "@/lib/simulator/custom";
import { cleanTranscript, ownSession, updateSession } from "@/lib/simulator/server";
import { situationById } from "@/lib/simulator/situations";

export const maxDuration = 60;

/** "How am I doing?" while paused: a short note on how it's going. Practice only; certification gets no help. */
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
  if (row.mode === "assessment") {
    return NextResponse.json({ error: "There's no help during certification." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { transcript?: unknown } | null;
  // Never let a shorter copy (say, from a reloaded page) overwrite what's saved.
  const sent = cleanTranscript(body?.transcript);
  const transcript = sent.length >= row.transcript.length ? sent : row.transcript;
  await updateSession(id, { transcript, time_outs: row.time_outs + 1 });
  if (!transcript.some((l) => l.role === "coach")) {
    return NextResponse.json({
      note: { working: "You haven't started yet.", next: "Open the session and set it up: what you'll cover and what they want from it.", ask: "What would make today really useful for you?" },
    });
  }
  try {
    const note = await timeOutNote({ client, situation, difficulty: row.difficulty, transcript, live: row.live });
    return NextResponse.json({ note });
  } catch (err) {
    console.error("simulator time out:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Couldn't get a note this time." }, { status: 502 });
  }
}
