import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { sendSupportOpeningOnWhatsApp, sendSupportReplyOnWhatsApp } from "@/lib/support/whatsapp";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Send a reply BCA just saved on this ticket to the coach's WhatsApp. */
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
    replyId?: string;
    opening?: boolean;
  };

  // New ticket: the first message is on the ticket itself, not a reply.
  if (body.opening) {
    const sent = await sendSupportOpeningOnWhatsApp({ reportId: ticketId, adminId: auth.userId });
    if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 502 });
    return NextResponse.json({ ok: true, from: sent.fromName });
  }

  const replyId = body.replyId?.trim();
  if (!replyId) return NextResponse.json({ error: "Which reply?" }, { status: 400 });

  const { data: reply } = await supabaseAdmin
    .from("community_feedback_replies")
    .select("id")
    .eq("id", replyId)
    .eq("report_id", ticketId)
    .maybeSingle();
  if (!reply) return NextResponse.json({ error: "Reply not found." }, { status: 404 });

  const sent = await sendSupportReplyOnWhatsApp({ replyId, adminId: auth.userId });
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 502 });
  return NextResponse.json({ ok: true, from: sent.fromName });
}
