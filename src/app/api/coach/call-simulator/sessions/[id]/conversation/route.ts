import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { ownCallSession, updateCallSession } from "@/lib/callSimulator/server";

/** Remember each ElevenLabs conversation, so the coach can listen back later. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await ownCallSession(check, id, { write: true });
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { conversationId?: unknown } | null;
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId.trim() : "";
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(conversationId)) {
    return NextResponse.json({ error: "Bad conversation id." }, { status: 400 });
  }
  if (!row.conversation_ids.includes(conversationId)) {
    await updateCallSession(id, { conversation_ids: [...row.conversation_ids, conversationId] });
  }
  return NextResponse.json({ ok: true });
}
