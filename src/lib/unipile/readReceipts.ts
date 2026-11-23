import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { markCoachReadFromWhatsApp, supportWhatsAppLineForUnipileAccount } from "@/lib/support/whatsapp";

/**
 * Unipile `message_read`: the other person read a message we sent. Reading one
 * message means they read everything we sent before it in that chat, so all
 * of ours up to it get "Seen". A read of one of *their* messages (us reading
 * it) finds no message of ours and changes nothing.
 */
export async function handleUnipileMessageRead(
  body: Record<string, unknown>
): Promise<string> {
  const accountId = String(body.account_id || "").trim();
  const messageId = String(body.message_id || body.id || "").trim();
  if (!accountId || !messageId) return "missing_ids";
  const readAt = new Date().toISOString();

  // BCA's own WhatsApp (Support): mark BCA's replies to the coach.
  const line = await supportWhatsAppLineForUnipileAccount(accountId);
  if (line) {
    const { data: reply } = await supabaseAdmin
      .from("community_feedback_replies")
      .select("id, report_id, created_by, as_ava, created_at, report:community_feedback_reports!inner(created_by)")
      .eq("whatsapp_message_id", messageId)
      .maybeSingle();
    if (!reply) return "support_not_ours";
    const report = (Array.isArray(reply.report) ? reply.report[0] : reply.report) as { created_by: string } | null;
    const coachId = report?.created_by ?? null;
    if (!coachId) return "no_coach";
    if (reply.created_by === coachId && !reply.as_ava) return "support_coach_message";
    await supabaseAdmin
      .from("community_feedback_replies")
      .update({ whatsapp_read_at: readAt })
      .eq("report_id", reply.report_id)
      .not("whatsapp_message_id", "is", null)
      .is("whatsapp_read_at", null)
      .lte("created_at", reply.created_at)
      .or(`created_by.neq.${coachId},as_ava.eq.true`);
    // Read on WhatsApp counts as read in the app too: no unread badge.
    await markCoachReadFromWhatsApp({ reportId: reply.report_id, coachId, seenAt: reply.created_at });
    return "support_read";
  }

  // A coach's LinkedIn / WhatsApp: mark the coach's messages to the prospect.
  const { data: msg } = await supabaseAdmin
    .from("messaging_messages")
    .select("id, conversation_id, direction, created_at")
    .eq("unipile_message_id", messageId)
    .maybeSingle();
  if (!msg) return "not_found";
  if (msg.direction !== "outbound") return "their_message";
  await supabaseAdmin
    .from("messaging_messages")
    .update({ read_at: readAt })
    .eq("conversation_id", msg.conversation_id)
    .eq("direction", "outbound")
    .neq("channel", "system")
    .is("read_at", null)
    .lte("created_at", msg.created_at);
  return "read";
}
