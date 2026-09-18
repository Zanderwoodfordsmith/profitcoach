import { NextResponse } from "next/server";
import { applyReplyDisposition, isReplyDisposition } from "@/lib/prospects/replyDisposition";
import { resolveMessagingAccess } from "@/lib/messaging/resolveMessagingAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await resolveMessagingAccess(request);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data: conversation, error } = await supabaseAdmin
    .from("messaging_conversations")
    .select("id, coach_id, contact_id, unipile_chat_id, hidden_at")
    .eq("id", id)
    .eq("coach_id", access.coachId)
    .maybeSingle();
  if (error || !conversation || conversation.hidden_at) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    disposition?: string;
  };
  if (!isReplyDisposition(body.disposition)) {
    return NextResponse.json(
      { error: "disposition must be interested, neutral, or not_interested." },
      { status: 400 }
    );
  }

  try {
    const result = await applyReplyDisposition({
      coachId: access.coachId,
      contactId: (conversation.contact_id as string | null) ?? null,
      unipileChatId: (conversation.unipile_chat_id as string | null) ?? null,
      disposition: body.disposition,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save reply." },
      { status: 400 }
    );
  }
}
