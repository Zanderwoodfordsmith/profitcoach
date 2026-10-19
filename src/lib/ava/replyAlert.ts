import { runAutopilot } from "@/lib/ava/autopilot";
import { sendAlertWhatsApp } from "@/lib/ava/alertsWhatsApp";
import { getAvaSettings, inQuietHours, type AvaSettings } from "@/lib/ava/settings";
import { loadCoachTimezone } from "@/lib/booking/bookingService";
import { notifyCoach } from "@/lib/coachWatch/fire";
import { sendPushToUser } from "@/lib/push/webPush";
import { isReplyCopilotChannel } from "@/lib/messaging/replyCopilot";
import { draftReplyForConversation } from "@/lib/messaging/replyDraft";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  NEXT_STEP_LABELS,
  TRIAGE_MODEL,
  steerForNextStep,
  triageReply,
  type TriageMessage,
  type TriageResult,
} from "@/lib/ava/replyTriage";

/**
 * Ava copilot for replies: when a prospect replies, classify it, draft the
 * coach's answer and alert the coach so they can send it fast.
 *
 * Copilot (default) never sends to the prospect. Autopilot (lib/ava/autopilot)
 * replies only when the global switch, BCA's per-coach allow and the coach's
 * own choice are all on, and Ava is confident the prospect wants a call.
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
      triage.nextStep === "nurture" ||
      triage.nextStep === "confirm_time");
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

  const live = input.alert !== false;
  const settings = await getAvaSettings(input.coachId);
  let alerted = false;
  let autopilotText: string | null = null;

  if (live && settings.reply_mode !== "off") {
    // Autopilot first: if it replies, the alert tells the coach what Ava sent.
    if (settings.reply_mode === "autopilot") {
      try {
        const auto = await runAutopilot({
          coachId: input.coachId,
          conversationId: input.conversationId,
          contactId: (conv.contact_id as string | null) ?? null,
          prospectName: (conv.prospect_name as string | null) ?? null,
          triage,
          channel: channelRaw,
          live,
          inboundAt: latestInbound.created_at as string | null,
        });
        if (auto.scheduled) {
          autopilotText = auto.text;
          await supabaseAdmin
            .from("ava_reply_triage")
            .update({
              mode: "autopilot",
              status: "autopilot_scheduled",
              offered_slots: auto.offered,
              scheduled_message_id: auto.scheduledMessageId,
              sent_text: auto.text,
              updated_at: new Date().toISOString(),
            })
            .eq("id", inserted.id);
        } else {
          await supabaseAdmin.from("ava_reply_triage").update({ mode: `copilot (${auto.reason})` }).eq("id", inserted.id);
        }
      } catch (err) {
        console.error("ava autopilot:", err instanceof Error ? err.message : err);
      }
    } else {
      await supabaseAdmin.from("ava_reply_triage").update({ mode: "copilot" }).eq("id", inserted.id);
    }

    const worthAlert =
      Boolean(autopilotText) ||
      triage.disposition === "interested" ||
      triage.nextStep === "answer" ||
      triage.nextStep === "human" ||
      triage.nextStep === "confirm_time";
    if (worthAlert) {
      const channels = await sendCoachAlert({
        coachId: input.coachId,
        conversationId: input.conversationId,
        settings,
        prospectName: (conv.prospect_name as string | null)?.trim() || "A prospect",
        inboundText: String(latestInbound.body_text || ""),
        triage,
        draft,
        autopilotText,
      });
      alerted = channels.length > 0;
      if (alerted) {
        await supabaseAdmin
          .from("ava_reply_triage")
          .update({ alert_sent_at: new Date().toISOString(), alert_channels: channels })
          .eq("id", inserted.id);
      }
    }
  }

  return { done: true, triageId: inserted.id as string, disposition: triage.disposition, nextStep: triage.nextStep, alerted };
}

/** Copilot alert: phone push, BCA WhatsApp (outside quiet hours) and, if chosen, email. */
export async function sendCoachAlert(input: {
  coachId: string;
  conversationId: string;
  settings: AvaSettings;
  prospectName: string;
  inboundText: string;
  triage: TriageResult;
  draft: string | null;
  autopilotText: string | null;
}): Promise<string[]> {
  const { triage } = input;
  const said = input.inboundText.trim().replace(/\s+/g, " ").slice(0, 220);
  const title = input.autopilotText
    ? `Ava replied to ${input.prospectName}`
    : triage.nextStep === "confirm_time"
      ? `${input.prospectName} picked a time`
      : triage.disposition === "interested"
        ? `${input.prospectName} is interested`
        : `${input.prospectName} replied`;
  const url = `/coach/conversations?conversation=${input.conversationId}`;
  const channels: string[] = [];

  if (input.settings.notify_push) {
    const pushed = await sendPushToUser(input.coachId, {
      title,
      body: input.autopilotText ? `Sent in about a minute: ${input.autopilotText.slice(0, 160)}` : `"${said}" · Ava: ${NEXT_STEP_LABELS[triage.nextStep]}`,
      url,
      tag: `reply-${input.conversationId}`,
    });
    if (pushed > 0) channels.push("push");
  }

  const longBody = [
    title,
    `They said: "${said}"`,
    input.autopilotText
      ? `Ava is replying for you in about a minute:\n${input.autopilotText}\n\nTo stop it, open the conversation and cancel the scheduled message.`
      : `Ava suggests: ${NEXT_STEP_LABELS[triage.nextStep]}.${input.draft ? `\n\nDraft reply:\n${input.draft}` : ""}`,
    `Open it: ${APP_BASE}${url}`,
    input.autopilotText ? null : "Replies within 30 minutes book far more calls.",
  ]
    .filter(Boolean)
    .join("\n\n");

  if (input.settings.notify_whatsapp) {
    const tz = await loadCoachTimezone(input.coachId).catch(() => "Europe/London");
    if (!inQuietHours(input.settings, tz)) {
      const { data: profile } = await supabaseAdmin.from("profiles").select("phone").eq("id", input.coachId).maybeSingle();
      if (await sendAlertWhatsApp(profile?.phone as string | null, longBody)) channels.push("whatsapp");
    }
  }

  if (input.settings.notify_email) {
    const sent = await notifyCoach({ coachId: input.coachId, subject: title, body: longBody, email: true, whatsapp: false });
    if (sent.email) channels.push("email");
  }
  return channels;
}

export function triageLatestInboundSafe(input: { coachId: string; conversationId: string }): void {
  void triageLatestInbound(input).catch((err) => {
    console.error("ava reply triage:", err instanceof Error ? err.message : err);
  });
}
