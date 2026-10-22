import { getAvaSettings, isAutopilotGloballyOn } from "@/lib/ava/settings";
import { firstNameOf } from "@/lib/ava/autopilot";
import { scheduleMessagingReply } from "@/lib/messaging/scheduledMessages";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bookingUrlForLead, leadIdForConversation } from "@/lib/booking/leadLink";

/**
 * Keep autopilot honest after the first reply:
 * 1. Mark offers sent or cancelled once the scheduled message settles.
 * 2. If a prospect hasn't answered a time offer after 48 hours, send ONE short
 *    nudge with the booking link (autopilot coaches only). Never more than one.
 */

const NUDGE_AFTER_MS = 48 * 60 * 60 * 1000;

export function nudgeText(firstName: string, link: string | null): string {
  const hi = firstName ? `Hi ${firstName},` : "Hi,";
  return link
    ? `${hi} did either of those times work? If not, pick whatever suits here: ${link}`
    : `${hi} did either of those times work? If not, send me a couple that suit you.`;
}

export async function processAvaFollowups(limit = 50): Promise<{ settled: number; nudged: number }> {
  let settled = 0;
  let nudged = 0;

  const { data: scheduled } = await supabaseAdmin
    .from("ava_reply_triage")
    .select("id, scheduled_message_id")
    .eq("status", "autopilot_scheduled")
    .not("scheduled_message_id", "is", null)
    .limit(limit);
  for (const row of scheduled ?? []) {
    const { data: msg } = await supabaseAdmin
      .from("messaging_scheduled_messages")
      .select("status, updated_at")
      .eq("id", row.scheduled_message_id)
      .maybeSingle();
    const status = msg?.status === "sent" ? "autopilot_sent" : msg?.status === "cancelled" || msg?.status === "failed" ? "autopilot_cancelled" : null;
    if (!status) continue;
    await supabaseAdmin.from("ava_reply_triage").update({ status, updated_at: new Date().toISOString() }).eq("id", row.id);
    settled += 1;
  }

  if (!(await isAutopilotGloballyOn())) return { settled, nudged };

  const cutoff = new Date(Date.now() - NUDGE_AFTER_MS).toISOString();
  const { data: due } = await supabaseAdmin
    .from("ava_reply_triage")
    .select("id, coach_id, conversation_id, updated_at")
    .eq("status", "autopilot_sent")
    .is("nudged_at", null)
    .lte("updated_at", cutoff)
    .limit(limit);
  for (const row of due ?? []) {
    const settings = await getAvaSettings(row.coach_id as string);
    // Mark first so a failure never turns into repeated nudges.
    await supabaseAdmin.from("ava_reply_triage").update({ nudged_at: new Date().toISOString() }).eq("id", row.id);
    if (settings.reply_mode !== "autopilot" || !settings.autopilot_allowed) continue;

    const { data: since } = await supabaseAdmin
      .from("messaging_messages")
      .select("id", { count: "exact", head: false })
      .eq("conversation_id", row.conversation_id)
      .eq("direction", "inbound")
      .gte("created_at", row.updated_at as string)
      .limit(1);
    if ((since ?? []).length) continue;

    const [{ data: conv }, { data: coach }] = await Promise.all([
      supabaseAdmin.from("messaging_conversations").select("prospect_name, hidden_at").eq("id", row.conversation_id).maybeSingle(),
      supabaseAdmin.from("coaches").select("slug").eq("id", row.coach_id).maybeSingle(),
    ]);
    if (!conv || conv.hidden_at) continue;
    const link = coach?.slug ? bookingUrlForLead(coach.slug as string, await leadIdForConversation(row.conversation_id as string)) : null;
    await scheduleMessagingReply({
      conversationId: row.conversation_id as string,
      coachId: row.coach_id as string,
      channel: "linkedin",
      bodyText: nudgeText(firstNameOf(conv.prospect_name as string | null), link),
      scheduledFor: new Date(Date.now() + 90_000).toISOString(),
      attachments: [],
    });
    nudged += 1;
  }
  return { settled, nudged };
}
