import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { resolveClient } from "@/lib/simulator/custom";
import { clientPrompt, type PreviousSession } from "@/lib/simulator/prompt";
import { cleanTranscript, coachFirstName, getSession, ownSession, signedCallUrl, updateSession } from "@/lib/simulator/server";
import { situationById } from "@/lib/simulator/situations";
import type { CallStart } from "@/lib/simulator/types";

export const maxDuration = 30;

/** Back from a time out: a fresh call that knows everything said so far and waits for the coach. */
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
  if (row.status !== "live") return NextResponse.json({ error: "This session has ended." }, { status: 400 });
  // After a pause the page sends the call so far; keep it if it's longer than what's saved.
  const body = (await request.json().catch(() => null)) as { transcript?: unknown } | null;
  const sent = cleanTranscript(body?.transcript);
  if (sent.length > row.transcript.length) {
    await updateSession(id, { transcript: sent });
    row.transcript = sent;
  }

  let previous: PreviousSession | null = null;
  if (row.follows_session_id) {
    const last = await getSession(row.follows_session_id);
    if (last?.report) {
      previous = {
        when: new Date(last.started_at).toLocaleDateString("en-GB", { day: "numeric", month: "long" }),
        agreedActions: last.report.agreedActions,
        summary: last.report.summary,
      };
    }
  }
  try {
    const coachName = await coachFirstName(check.userId);
    const call: CallStart = {
      signedUrl: await signedCallUrl(),
      prompt: clientPrompt({ client, situation, difficulty: row.difficulty, mode: row.mode, coachName, previous, sofar: row.transcript }),
      firstMessage: "",
      voiceId: client.voiceId,
      speed: client.speed,
    };
    return NextResponse.json({ call });
  } catch (err) {
    console.error("simulator resume:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not restart the call." }, { status: 502 });
  }
}
