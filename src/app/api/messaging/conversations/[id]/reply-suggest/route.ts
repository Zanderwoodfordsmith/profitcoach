import { NextResponse } from "next/server";
import { isReplyCopilotChannel } from "@/lib/messaging/replyCopilot";
import { draftReplyForConversation } from "@/lib/messaging/replyDraft";
import { consumeReplyCopilotRateLimit } from "@/lib/messaging/replyCopilotRateLimit";
import { resolveMessagingAccess } from "@/lib/messaging/resolveMessagingAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * AuthZ: conversation owner (or admin impersonating that coach). 404 if the
 * conversation is missing/hidden. Body allowlist is { channel } only.
 * Thread + prospect facts are quoted as untrusted data. Suggest-only.
 */
async function loadConversation(id: string, coachId: string) {
  return supabaseAdmin
    .from("messaging_conversations")
    .select("id, coach_id, contact_id, hidden_at")
    .eq("id", id)
    .eq("coach_id", coachId)
    .maybeSingle();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await resolveMessagingAccess(request);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data: conversation, error: convErr } = await loadConversation(
    id,
    access.coachId
  );
  if (convErr || !conversation || conversation.hidden_at) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  if (!consumeReplyCopilotRateLimit(access.coachId)) {
    return NextResponse.json(
      { error: "Too many suggestions. Try again in a minute." },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { channel?: unknown };
  const channelRaw =
    typeof body.channel === "string" ? body.channel.trim().toLowerCase() : "";
  if (channelRaw === "comment") {
    return NextResponse.json(
      { error: "Copilot is not available for internal notes." },
      { status: 400 }
    );
  }
  if (!isReplyCopilotChannel(channelRaw)) {
    return NextResponse.json({ error: "Unsupported channel." }, { status: 400 });
  }

  const result = await draftReplyForConversation({
    conversationId: id,
    coachId: access.coachId,
    contactId: (conversation.contact_id as string | null) ?? null,
    channel: channelRaw,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ suggestion: result.suggestion });
}
