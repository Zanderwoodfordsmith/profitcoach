import { NextResponse } from "next/server";

import { loadChatActions } from "@/lib/agent/actions";
import { resolveAgentActor } from "@/lib/agent/auth";
import { displayItems, loadChat } from "@/lib/agent/chatStore";
import { loadAgentCoach } from "@/lib/agent/coaches";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** One chat as the panel shows it. */
export async function GET(request: Request, ctx: Ctx) {
  const auth = await resolveAgentActor(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  const chat = await loadChat(id, auth.actor.actorUserId);
  if (!chat) return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  const [actions, coach] = await Promise.all([
    loadChatActions(chat.id),
    chat.coach_id ? loadAgentCoach(chat.coach_id) : Promise.resolve(null),
  ]);
  return NextResponse.json({
    chat: { id: chat.id, title: chat.title, mode: chat.mode, coach },
    items: displayItems(chat.api_messages, chat.mode, actions),
  });
}
