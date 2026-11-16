import { NextResponse } from "next/server";

import { loadMarks, loadReviewChat, saveMark } from "@/lib/agent/chatReview";
import type { FixKind, MarkVerdict } from "@/lib/ava/chatReviewLabels";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const FIXES: FixKind[] = ["knowledge", "skill", "app", "coach"];

/** One chat to read: everything Ava did, the page per message, every mark and the AI's read. */
export async function GET(request: Request, ctx: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const chat = await loadReviewChat(id);
    if (!chat) return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    return NextResponse.json({ chat });
  } catch (err) {
    console.error("ava chat read:", err);
    return NextResponse.json({ error: "Could not open that chat." }, { status: 500 });
  }
}

/** BCA marks one reply. Body: { turn, verdict: "good" | "off" | null, fix?, note? }. Null clears it. */
export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) return NextResponse.json({ error: auth.error }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    turn?: unknown;
    verdict?: unknown;
    fix?: unknown;
    note?: unknown;
  } | null;
  const turn = typeof body?.turn === "number" && Number.isInteger(body.turn) && body.turn >= 0 ? body.turn : null;
  const verdict = body?.verdict === "good" || body?.verdict === "off" ? (body.verdict as MarkVerdict) : body?.verdict === null ? null : undefined;
  if (turn === null || verdict === undefined) {
    return NextResponse.json({ error: "Say which reply and Good or Off." }, { status: 400 });
  }
  const fix = FIXES.includes(body?.fix as FixKind) ? (body?.fix as FixKind) : null;
  const note = typeof body?.note === "string" ? body.note : null;
  try {
    await saveMark({ chatId: id, turn, source: "bca", verdict, fix, note, userId: auth.userId });
    return NextResponse.json({ marks: await loadMarks(id) });
  } catch (err) {
    console.error("ava chat mark:", err);
    return NextResponse.json({ error: "Could not save that mark." }, { status: 500 });
  }
}
