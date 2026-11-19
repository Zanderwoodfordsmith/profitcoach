import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { reactOnSupportWhatsApp } from "@/lib/support/whatsapp";
import { supportChatOpenedByBca } from "@/lib/support/tickets";

export const runtime = "nodejs";

/**
 * BCA reacts to a coach's message (19 Nov), in place of the "Seen" tick: it
 * stops needing a reply and sends nothing new. When the coach's message came
 * in on WhatsApp, the reaction also goes on it there. reaction null = take it off.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id: ticketId } = await context.params;
  const body = ((await request.json().catch(() => null)) ?? {}) as {
    replyId?: string | null;
    reaction?: string | null;
  };
  const reaction = body.reaction?.trim().slice(0, 16) || null;
  const replyId = body.replyId?.trim() || null;

  const { data: report } = await supabaseAdmin
    .from("community_feedback_reports")
    .select("id, created_by, created_by_admin, source, whatsapp_message_id")
    .eq("id", ticketId)
    .maybeSingle();
  if (!report) return NextResponse.json({ error: "Chat not found." }, { status: 404 });

  const now = new Date().toISOString();
  let whatsappMessageId: string | null = null;

  if (replyId) {
    const { data: reply } = await supabaseAdmin
      .from("community_feedback_replies")
      .select("id, created_by, as_ava, whatsapp_message_id")
      .eq("id", replyId)
      .eq("report_id", ticketId)
      .maybeSingle();
    if (!reply) return NextResponse.json({ error: "Message not found." }, { status: 404 });
    const { error } = await supabaseAdmin
      .from("community_feedback_replies")
      .update(
        reaction
          ? { seen_at: now, seen_by: auth.userId, seen_reaction: reaction }
          : { seen_at: null, seen_by: null, seen_reaction: null }
      )
      .eq("id", reply.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const coachWrote = reply.created_by === report.created_by && !reply.as_ava;
    if (coachWrote) whatsappMessageId = (reply.whatsapp_message_id as string | null) ?? null;
  } else {
    const { error } = await supabaseAdmin
      .from("community_feedback_reports")
      .update(
        reaction
          ? { opening_seen_at: now, opening_seen_by: auth.userId, opening_seen_reaction: reaction }
          : { opening_seen_at: null, opening_seen_by: null, opening_seen_reaction: null }
      )
      .eq("id", ticketId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!supportChatOpenedByBca(report)) {
      whatsappMessageId = (report.whatsapp_message_id as string | null) ?? null;
    }
  }

  if (!whatsappMessageId) return NextResponse.json({ ok: true, whatsapp: null });
  const sent = await reactOnSupportWhatsApp({ whatsappMessageId, reaction });
  if (!sent.ok) {
    console.warn("support whatsapp reaction:", sent.error);
    return NextResponse.json({ ok: true, whatsapp: "failed", error: sent.error });
  }
  return NextResponse.json({ ok: true, whatsapp: "sent" });
}
