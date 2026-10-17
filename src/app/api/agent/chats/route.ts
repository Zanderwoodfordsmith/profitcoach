import { NextResponse } from "next/server";

import { resolveAgentActor } from "@/lib/agent/auth";
import { listChats, listCoachChats } from "@/lib/agent/chatStore";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Recent Ava chats. ?coach=<id> (admins): every chat about that coach, theirs
 * and BCA's, each marked with who had it.
 */
export async function GET(request: Request) {
  const auth = await resolveAgentActor(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { actor } = auth;
  const coach = new URL(request.url).searchParams.get("coach")?.trim() ?? "";
  try {
    if (actor.isAdmin && UUID_RE.test(coach)) {
      const rows = await listCoachChats(coach);
      return NextResponse.json({
        chats: rows.map((row) => ({
          id: row.id,
          title: row.title,
          updated_at: row.updated_at,
          by: row.actor_user_id === actor.actorUserId ? "you" : row.actor_user_id === coach ? "coach" : "bca",
        })),
      });
    }
    const chats = await listChats(actor.actorUserId, actor.mode);
    return NextResponse.json({ chats: chats.map((chat) => ({ ...chat, by: "you" })) });
  } catch (err) {
    console.error("agent chats:", err);
    return NextResponse.json({ error: "Could not load chats." }, { status: 500 });
  }
}
