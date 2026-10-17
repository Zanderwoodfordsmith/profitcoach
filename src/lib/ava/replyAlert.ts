import { notifyCoach } from "@/lib/coachWatch/fire";
import { isReplyCopilotChannel } from "@/lib/messaging/replyCopilot";
import { draftReplyForConversation } from "@/lib/messaging/replyDraft";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  NEXT_STEP_LABELS,
  TRIAGE_MODEL,
  steerForNextStep,
  triageReply,
  type TriageMessage,
} from "@/lib/ava/replyTriage";

/**
 * Ava copilot for replies: when a prospect replies, classify it, draft the
 * coach's answer and alert the coach so they can send it fast.
 *
 * This NEVER sends to the prospect. Autopilot is deliberately not built until
 * admins have labelled enough rows in /admin/ava/replies to trust it.
 */

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const APP_BASE = (process.env.APP_BASE_URL || "https://app.theprofitcoach.com").replace(/\/$/, "");

export type TriageOutcome =
  | { done: false; reason: string }
  | { done: true; triageId: string; disposition: string; nextStep: string; alerted: boolean };

export async function triageLatestInbound(input: {
  coachId: string;
  conversationId: string;
  /** Alert the coach. Off for historical backfills. */
  alert?: boolean;
  /** Draft a reply. Off for cheap historical backfills. */
  draft?: boolean;
  /** Ignore the 7-day freshness window (backfills). */
  anyAge?: boolean;
  /** Triage even if the coach already answered (backfills for admin review). */
  includeAnswered?: boolean;
}): Promise<TriageOutcome> {
  const { data: conv } = await supabaseAdmin
    .from("messaging_conversations")
    .select("id, coach_id, contact_id, prospect_name, last_channel, hidden_at")
    .eq("id", input.conversationId)
    .eq("coach_id", input.coachId)
    .maybeSingle();
  if (!conv || conv.hidden_at) return { done: false, reason: "conversation missing" };

  const { data: rows } = await supabaseAdmin
    .from("messaging_messages")
    .select("id, direction, body_text, created_at, channel, metadata")
    .eq("conversation_id", input.conversationId)
    .order("created_at", { ascending: false })
    .limit(20);
  const messages = (rows ?? [])
    .filter((m) => !(m.metadata && typeof m.metadata === "object" && (m.metadata as Record<string, unknown>).is_event))
    .reverse();
  const latestInbound = [...messages].reverse().find((m) => m.direction === "inbound" && (m.body_text || "").trim());
  if (!latestInbound) return { done: false, reason: "no inbound text" };

  const last = messages[messages.length - 1];
  if (!input.includeAnswered && last && last.direction === "outbound") {
    return { done: false, reason: "coach already replied" };
  }

  const at = latestInbound.created_at ? new Date(latestInbound.created_at).getTime() : 0;
  if (!input.anyAge && Date.now() - at > MAX_AGE_MS) return { done: false, reason: "too old" };

  const { data: existing } = await supabaseAdmin
    .from("ava_reply_triage")
    .select("id")
    .eq("conversation_id", input.conversationId)
    .eq("message_id", latestInbound.id)
    .maybeSingle();
  if (existing) return { done: false, reason: "already triaged" };

  // Judge the reply as it stood when it arrived: drop anything after it.
  const cutoff = messages.findIndex((m) => m.id === latestInbound.id);
  const thread: TriageMessage[] = messages
    .slice(0, cutoff + 1)
    .filter((m) => (m.body_text || "").trim())
    .map((m) => ({
      direction: m.direction === "inbound" ? "inbound" : "outbound",
      text: String(m.body_text),
      at: m.created_at,
    }));
  const triage = await triageReply(thread);
  if (!triage) return { done: false, reason: "triage failed" };

  const channelRaw = String(latestInbound.channel || conv.last_channel || "linkedin").toLowerCase();
  let draft: string | null = null;
  const wantsDraft =
    input.draft !== false &&
    triage.disposition !== "not_interested" &&
    (triage.nextStep === "calendar" ||
      triage.nextStep === "scorecard" ||
      triage.nextStep === "answer" ||
      triage.nextStep === "nurture");
  if (wantsDraft && isReplyCopilotChannel(channelRaw)) {
    const result = await draftReplyForConversation({
      conversationId: input.conversationId,
      coachId: input.coachId,
      contactId: (conv.contact_id as string | null) ?? null,
      channel: channelRaw,
      steer: steerForNextStep(triage.nextStep),
    });
    if (result.ok) draft = result.suggestion;
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("ava_reply_triage")
    .insert({
      coach_id: input.coachId,
      conversation_id: input.conversationId,
      message_id: latestInbound.id,
      channel: channelRaw,
      inbound_text: String(latestInbound.body_text || "").slice(0, 4000),
      inbound_at: latestInbound.created_at,
      disposition: triage.disposition,
      situation: triage.situation,
      next_step: triage.nextStep,
      confidence: triage.confidence,
      reason: triage.reason,
      draft,
      model: TRIAGE_MODEL,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    // Unique violation = another sync run got there first.
    if (error?.code !== "23505") console.error("triage insert:", error?.message);
    return { done: false, reason: "insert failed" };
  }

  let alerted = false;
  const worthAlert = triage.disposition === "interested" || triage.nextStep === "answer" || triage.nextStep === "human";
  if (input.alert !== false && worthAlert) {
    const who = (conv.prospect_name as string | null)?.trim() || "A prospect";
    const subject =
      triage.disposition === "interested" ? `${who} is interested. Reply now` : `${who} replied`;
    const body = [
      subject,
      `They said: "${String(latestInbound.body_text).trim().slice(0, 500)}"`,
      `Ava suggests: ${NEXT_STEP_LABELS[triage.nextStep]}.`,
      draft ? `Draft reply:\n${draft}` : null,
      `Open Conversations: ${APP_BASE}/coach/conversations`,
      "Replies sent within 30 minutes book far more calls.",
    ]
      .filter(Boolean)
      .join("\n\n");
    const sent = await notifyCoach({ coachId: input.coachId, subject, body, email: true, whatsapp: true });
    alerted = sent.email || sent.whatsapp;
    if (alerted) {
      await supabaseAdmin
        .from("ava_reply_triage")
        .update({ alert_sent_at: new Date().toISOString() })
        .eq("id", inserted.id);
    }
  }

  return { done: true, triageId: inserted.id as string, disposition: triage.disposition, nextStep: triage.nextStep, alerted };
}

export function triageLatestInboundSafe(input: { coachId: string; conversationId: string }): void {
  void triageLatestInbound(input).catch((err) => {
    console.error("ava reply triage:", err instanceof Error ? err.message : err);
  });
}
