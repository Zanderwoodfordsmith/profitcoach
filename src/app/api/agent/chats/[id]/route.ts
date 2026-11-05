import { NextResponse } from "next/server";

import { loadChatActions } from "@/lib/agent/actions";
import { resolveAgentActor } from "@/lib/agent/auth";
import { deleteOwnChat, displayItems, loadChat, loadChatForAdmin, updateOwnChat } from "@/lib/agent/chatStore";
import { loadAgentCoach } from "@/lib/agent/coaches";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** One chat as the panel shows it. Admins can read a coach's chat; only its owner can carry it on. */
export async function GET(request: Request, ctx: Ctx) {
  const auth = await resolveAgentActor(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  const chat =
    (await loadChat(id, auth.actor.actorUserId)) ?? (auth.actor.isAdmin ? await loadChatForAdmin(id) : null);
  if (!chat) return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  const [actions, coach] = await Promise.all([
    loadChatActions(chat.id),
    chat.coach_id ? loadAgentCoach(chat.coach_id) : Promise.resolve(null),
  ]);
  return NextResponse.json({
    chat: {
      id: chat.id,
      title: chat.title,
      mode: chat.mode,
      coach,
      readOnly: chat.actor_user_id !== auth.actor.actorUserId,
    },
    items: displayItems(chat.api_messages, chat.mode, actions),
  });
}

/** Pin, unpin or rename your own chat. Body: { pinned?: boolean, title?: string }. */
export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await resolveAgentActor(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as { title?: unknown; pinned?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.replace(/\s+/g, " ").trim().slice(0, 80) : undefined;
  const pinned = typeof body?.pinned === "boolean" ? body.pinned : undefined;
  if (title === undefined && pinned === undefined) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }
  if (title === "") return NextResponse.json({ error: "Give the chat a name." }, { status: 400 });
  try {
    const ok = await updateOwnChat(id, auth.actor.actorUserId, { title, pinned });
    if (!ok) return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("agent chat update:", err);
    return NextResponse.json({ error: "Could not save that." }, { status: 500 });
  }
}

/** Delete your own chat (hidden, kept for costs). */
export async function DELETE(request: Request, ctx: Ctx) {
  const auth = await resolveAgentActor(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  try {
    const ok = await deleteOwnChat(id, auth.actor.actorUserId);
    if (!ok) return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("agent chat delete:", err);
    return NextResponse.json({ error: "Could not delete that." }, { status: 500 });
  }
}
