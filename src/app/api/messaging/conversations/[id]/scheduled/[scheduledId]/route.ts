import { NextResponse } from "next/server";
import {
  cancelScheduledMessage,
  updateScheduledMessage,
} from "@/lib/messaging/scheduledMessages";
import { resolveMessagingAccess } from "@/lib/messaging/resolveMessagingAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function loadOwnedConversation(conversationId: string, coachId: string) {
  return supabaseAdmin
    .from("messaging_conversations")
    .select("id, coach_id, hidden_at")
    .eq("id", conversationId)
    .eq("coach_id", coachId)
    .maybeSingle();
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; scheduledId: string }> }
) {
  const { id, scheduledId } = await params;
  const access = await resolveMessagingAccess(request);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data: conversation } = await loadOwnedConversation(id, access.coachId);
  if (!conversation || conversation.hidden_at) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    body_text?: string;
    scheduled_for?: string;
  };

  try {
    const scheduled = await updateScheduledMessage({
      id: scheduledId,
      conversationId: id,
      coachId: access.coachId,
      bodyText: typeof body.body_text === "string" ? body.body_text : undefined,
      scheduledFor:
        typeof body.scheduled_for === "string" ? body.scheduled_for : undefined,
    });
    return NextResponse.json({ ok: true, scheduled });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not update scheduled message.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; scheduledId: string }> }
) {
  const { id, scheduledId } = await params;
  const access = await resolveMessagingAccess(request);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data: conversation } = await loadOwnedConversation(id, access.coachId);
  if (!conversation || conversation.hidden_at) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  try {
    await cancelScheduledMessage({
      id: scheduledId,
      conversationId: id,
      coachId: access.coachId,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not delete scheduled message.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
