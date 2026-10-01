import { NextResponse } from "next/server";

import { resolveAgentActor } from "@/lib/agent/auth";
import { listChats } from "@/lib/agent/chatStore";

export const runtime = "nodejs";

/** The actor's recent agent chats. */
export async function GET(request: Request) {
  const auth = await resolveAgentActor(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const chats = await listChats(auth.actor.actorUserId, auth.actor.mode);
    return NextResponse.json({ chats });
  } catch (err) {
    console.error("agent chats:", err);
    return NextResponse.json({ error: "Could not load chats." }, { status: 500 });
  }
}
