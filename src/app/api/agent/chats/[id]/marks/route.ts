import { NextResponse } from "next/server";

import { resolveAgentActor } from "@/lib/agent/auth";
import { loadMarks, saveMark } from "@/lib/agent/chatReview";
import { loadChat } from "@/lib/agent/chatStore";
import type { MarkVerdict } from "@/lib/ava/chatReviewLabels";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Thumbs on one of Ava's replies in your own chat. Body: { turn, verdict:
 * "good" | "off" | null, note? }. A coach's thumbs show BCA which replies
 * missed; an admin's count as BCA's mark.
 */
export async function POST(request: Request, ctx: Ctx) {
  const auth = await resolveAgentActor(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  const chat = await loadChat(id, auth.actor.actorUserId);
  if (!chat) return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { turn?: unknown; verdict?: unknown; note?: unknown } | null;
  const turn = typeof body?.turn === "number" && Number.isInteger(body.turn) && body.turn >= 0 ? body.turn : null;
  const verdict = body?.verdict === "good" || body?.verdict === "off" ? (body.verdict as MarkVerdict) : body?.verdict === null ? null : undefined;
  if (turn === null || verdict === undefined) {
    return NextResponse.json({ error: "Say which reply and up or down." }, { status: 400 });
  }
  const source = chat.mode === "admin" ? "bca" : "coach";
  try {
    await saveMark({
      chatId: chat.id,
      turn,
      source,
      verdict,
      note: typeof body?.note === "string" ? body.note : null,
      userId: auth.actor.actorUserId,
    });
    return NextResponse.json({ marks: await loadMarks(chat.id, source) });
  } catch (err) {
    console.error("ava reply thumbs:", err);
    return NextResponse.json({ error: "Could not save that." }, { status: 500 });
  }
}
