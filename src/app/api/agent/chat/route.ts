import { NextResponse } from "next/server";

import { loadChatActions } from "@/lib/agent/actions";
import { resolveAgentActor } from "@/lib/agent/auth";
import { createChat, loadChat, type AgentChatRow } from "@/lib/agent/chatStore";
import { loadAgentCoach } from "@/lib/agent/coaches";
import { runAgentTurn, type AgentTurnInput } from "@/lib/agent/runTurn";
import type { AgentStreamEvent } from "@/lib/agent/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MESSAGE_MAX = 8_000;

/**
 * One agent turn, streamed as NDJSON (one AgentStreamEvent per line).
 * Body: { chatId?, message } for a new message, or { chatId, actionId } to
 * carry on after a confirmation card was confirmed or cancelled.
 */
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set." }, { status: 500 });
  }
  const auth = await resolveAgentActor(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { actor } = auth;

  const body = (await request.json().catch(() => ({}))) as {
    chatId?: unknown;
    message?: unknown;
    actionId?: unknown;
    screenPath?: unknown;
  };
  const screenPath =
    typeof body.screenPath === "string" && body.screenPath.startsWith("/")
      ? body.screenPath.slice(0, 200)
      : null;

  let chat: AgentChatRow | null = null;
  if (typeof body.chatId === "string" && body.chatId) {
    chat = await loadChat(body.chatId, actor.actorUserId);
    if (!chat) return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    if (chat.mode !== actor.mode) {
      return NextResponse.json({ error: "Start a new chat." }, { status: 403 });
    }
  }

  let input: AgentTurnInput;
  if (typeof body.actionId === "string" && body.actionId) {
    if (!chat) return NextResponse.json({ error: "Missing chat." }, { status: 400 });
    const action = (await loadChatActions(chat.id)).get(body.actionId);
    if (!action || action.status === "pending" || action.status === "running") {
      return NextResponse.json({ error: "That action has not finished." }, { status: 409 });
    }
    input = { kind: "action", action };
  } else {
    const text = typeof body.message === "string" ? body.message.trim() : "";
    if (!text) return NextResponse.json({ error: "Type a message." }, { status: 400 });
    input = { kind: "message", text: text.slice(0, MESSAGE_MAX) };
  }

  if (!chat) {
    let coachId: string | null = actor.mode === "coach" ? actor.actorUserId : null;
    if (actor.mode === "admin" && actor.impersonatedCoachId) {
      coachId = (await loadAgentCoach(actor.impersonatedCoachId))?.id ?? null;
    }
    chat = await createChat({ actorUserId: actor.actorUserId, mode: actor.mode, coachId });
  }

  const turnChat = chat;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const emit = (event: AgentStreamEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false;
        }
      };
      try {
        await runAgentTurn({ actor, chat: turnChat, input, screenPath, emit });
      } finally {
        open = false;
        try {
          controller.close();
        } catch {
          // Already closed by the client.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Chat-Id": turnChat.id,
    },
  });
}
