import { after, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { deleteUnipileMessage, editUnipileMessage } from "@/lib/unipile/client";

export const runtime = "nodejs";

/**
 * BCA edited or is deleting one of its own replies that went out on WhatsApp
 * (19 Nov): try the same on WhatsApp. Best effort and silent. WhatsApp only
 * takes edits for about 15 minutes, and Unipile only deletes for everyone.
 * Call it after an edit is saved, and before a delete (the row holds the id).
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
    replyId?: string;
    action?: string;
  };
  const action = body.action === "delete" ? "delete" : body.action === "edit" ? "edit" : null;
  const replyId = body.replyId?.trim();
  if (!action || !replyId) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const { data: reply } = await supabaseAdmin
    .from("community_feedback_replies")
    .select("id, body, created_by, as_ava, whatsapp_message_id, report:community_feedback_reports!inner(created_by)")
    .eq("id", replyId)
    .eq("report_id", ticketId)
    .maybeSingle();
  const messageId = (reply?.whatsapp_message_id as string | null) ?? null;
  if (!reply || !messageId) return NextResponse.json({ ok: true, whatsapp: null });

  // Only BCA's own messages: WhatsApp can't edit or delete the coach's.
  const report = (Array.isArray(reply.report) ? reply.report[0] : reply.report) as { created_by: string } | null;
  const coachWrote = reply.created_by === report?.created_by && !reply.as_ava;
  if (coachWrote) return NextResponse.json({ ok: true, whatsapp: null });

  const text = String(reply.body || "").trim();
  if (action === "edit" && !text) return NextResponse.json({ ok: true, whatsapp: null });

  after(async () => {
    const result =
      action === "edit"
        ? await editUnipileMessage({ message_id: messageId, text })
        : await deleteUnipileMessage(messageId);
    if (!result.ok) console.warn(`support whatsapp ${action}:`, result.error);
  });
  return NextResponse.json({ ok: true, whatsapp: "queued" });
}
