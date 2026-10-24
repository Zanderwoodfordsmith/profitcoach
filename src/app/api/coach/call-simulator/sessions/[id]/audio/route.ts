import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { ownCallSession } from "@/lib/callSimulator/server";
import { conversationAudio } from "@/lib/simulator/server";

export const maxDuration = 60;

/** Listen back: the recording of one stretch of the call, from ElevenLabs. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await ownCallSession(check, id);
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const part = Number(new URL(request.url).searchParams.get("part") ?? "0");
  const conversationId = row.conversation_ids[Number.isInteger(part) ? part : 0];
  if (!conversationId) return NextResponse.json({ error: "No recording." }, { status: 404 });

  const upstream = await conversationAudio(conversationId);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "The recording isn't ready yet." }, { status: upstream.status === 404 ? 404 : 502 });
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
