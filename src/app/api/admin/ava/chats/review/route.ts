import { NextResponse } from "next/server";

import { loadReviewChat } from "@/lib/agent/chatReview";
import { reviewChat, reviewWaiting, writeDigest } from "@/lib/agent/chatReviewAi";
import { refreshAgentContextOverrides } from "@/lib/agent/agentOverrides";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * "Review new chats": the AI reads coaches' chats it hasn't read yet, then
 * writes the things to fix. Body { chatId } reads just that one chat (again).
 */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { chatId?: unknown } | null;
  try {
    if (typeof body?.chatId === "string" && body.chatId) {
      await refreshAgentContextOverrides();
      const { costUsd } = await reviewChat(body.chatId);
      return NextResponse.json({ costUsd, chat: await loadReviewChat(body.chatId) });
    }
    const run = await reviewWaiting(40);
    const digest = run.reviewed > 0 ? await writeDigest() : { written: false, costUsd: 0 };
    return NextResponse.json({ ...run, digest: digest.written, costUsd: run.costUsd + digest.costUsd });
  } catch (err) {
    console.error("ava chat review run:", err);
    return NextResponse.json({ error: "The review didn't finish. Try again." }, { status: 500 });
  }
}
