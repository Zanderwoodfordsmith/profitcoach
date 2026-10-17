import { loadCoachFreeSlots } from "@/lib/ava/freeSlots";
import { pickOfferSlots, zoneShortName, type OfferedSlot } from "@/lib/ava/slotPicker";
import { getAvaSettings, isAutopilotGloballyOn, type AvaSettings } from "@/lib/ava/settings";
import type { TriageResult } from "@/lib/ava/replyTriage";
import { draftReplyForConversation } from "@/lib/messaging/replyDraft";
import { scheduleMessagingReply } from "@/lib/messaging/scheduledMessages";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Ava autopilot: when an interested prospect asks to talk, reply within a
 * minute or two offering two real free times (booking-times.md), with the
 * booking link as the fallback. Sends through the scheduled-message queue so
 * the coach can still cancel it from Conversations before it goes.
 *
 * Runs only when ALL are true: the global switch is on, BCA allowed it for the
 * coach, the coach chose autopilot, and Ava is confident the prospect wants a
 * call. Anything else stays copilot (alert + draft).
 */

export const AUTOPILOT_SEND_DELAY_MS = 75_000;
/** Autopilot only answers fresh replies; older ones get a copilot alert instead. */
export const MAX_REPLY_AGE_MS = 2 * 60 * 60 * 1000;

export type AutopilotDecision =
  | { run: false; reason: string }
  | { run: true; settings: AvaSettings };

export function autopilotEligible(input: {
  globalOn: boolean;
  settings: AvaSettings;
  triage: TriageResult;
  channel: string;
  live: boolean;
  recentAutopilot: boolean;
  /** How long ago the prospect's reply arrived. */
  replyAgeMs: number;
}): AutopilotDecision {
  const { settings, triage } = input;
  if (!input.live) return { run: false, reason: "not a live reply" };
  if (input.replyAgeMs > MAX_REPLY_AGE_MS) return { run: false, reason: "reply is over 2 hours old" };
  if (!input.globalOn) return { run: false, reason: "autopilot is off for everyone" };
  if (!settings.autopilot_allowed) return { run: false, reason: "not allowed for this coach" };
  if (settings.reply_mode !== "autopilot") return { run: false, reason: "coach uses copilot" };
  if (input.channel !== "linkedin") return { run: false, reason: "LinkedIn only for now" };
  if (input.recentAutopilot) return { run: false, reason: "Ava already replied in this thread" };
  if (triage.disposition !== "interested" || triage.nextStep !== "calendar") {
    return { run: false, reason: "not a clear request to talk" };
  }
  if (triage.confidence < settings.autopilot_min_confidence) return { run: false, reason: "not confident enough" };
  return { run: true, settings };
}

export function firstNameOf(name: string | null | undefined): string {
  const first = (name || "").trim().split(/\s+/)[0] || "";
  return /^[A-Za-zÀ-ÿ'-]{2,}$/.test(first) ? first : "";
}

/** The fallback wording when the AI draft can't be trusted to name the times. */
export function composeTimeOffer(input: {
  firstName: string;
  offered: OfferedSlot[];
  zone: string;
  link: string | null;
}): string | null {
  const hi = input.firstName ? `Great, ${input.firstName}.` : "Great.";
  const [a, b] = input.offered;
  if (a && b) {
    return `${hi} Would ${a.label} or ${b.label} (${input.zone}) work for a 20-minute call?${input.link ? `\n\nIf neither suits, grab any time that works here: ${input.link}` : ""}`;
  }
  if (a) {
    return `${hi} Would ${a.label} (${input.zone}) work for a 20-minute call?${input.link ? `\n\nIf not, grab any time that works here: ${input.link}` : ""}`;
  }
  if (input.link) return `${hi} Here's my diary, grab whatever time suits you for a 20-minute call: ${input.link}`;
  return null;
}

/** A draft is only used if it names every offered time and the link, word for word. */
export function draftNamesOffer(draft: string, offered: OfferedSlot[], link: string | null): boolean {
  const text = draft.toLowerCase();
  if (link && !draft.includes(link)) return false;
  return offered.every((o) => text.includes(o.label.toLowerCase()));
}

export async function runAutopilot(input: {
  coachId: string;
  conversationId: string;
  contactId: string | null;
  prospectName: string | null;
  triage: TriageResult;
  channel: string;
  live: boolean;
  inboundAt: string | null;
}): Promise<
  | { scheduled: false; reason: string }
  | { scheduled: true; text: string; offered: OfferedSlot[]; scheduledMessageId: string; sendAt: string }
> {
  const [globalOn, settings, recent] = await Promise.all([
    isAutopilotGloballyOn(),
    getAvaSettings(input.coachId),
    supabaseAdmin
      .from("ava_reply_triage")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", input.conversationId)
      .in("status", ["autopilot_scheduled", "autopilot_sent"])
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
  ]);
  const decision = autopilotEligible({
    globalOn,
    settings,
    triage: input.triage,
    channel: input.channel,
    live: input.live,
    recentAutopilot: (recent.count ?? 0) > 0,
    replyAgeMs: input.inboundAt ? Date.now() - new Date(input.inboundAt).getTime() : Number.POSITIVE_INFINITY,
  });
  if (!decision.run) return { scheduled: false, reason: decision.reason };

  const slots = await loadCoachFreeSlots(input.coachId);
  if (!slots) return { scheduled: false, reason: "calendar could not be read" };
  const offered = pickOfferSlots({ slots: slots.slots, timeZone: slots.timeZone });
  const zone = zoneShortName(slots.timeZone);
  const fallback = composeTimeOffer({
    firstName: firstNameOf(input.prospectName),
    offered,
    zone,
    link: slots.bookingUrl,
  });
  if (!fallback) return { scheduled: false, reason: "no free times and no booking link" };

  // Let the copilot write it in the coach's voice, but only keep it if it names the exact times.
  let text = fallback;
  if (offered.length) {
    const steer = `Offer exactly these times and nothing else: ${offered.map((o) => o.label).join(" or ")} (${zone}). Ask which suits for a 20-minute call. ${slots.bookingUrl ? `Then say if neither suits they can pick any time here: ${slots.bookingUrl}` : ""} Two or three short sentences. Use the times word for word.`;
    const draft = await draftReplyForConversation({
      conversationId: input.conversationId,
      coachId: input.coachId,
      contactId: input.contactId,
      channel: "linkedin",
      steer,
    });
    if (draft.ok && draftNamesOffer(draft.suggestion, offered, slots.bookingUrl)) text = draft.suggestion;
  }

  const sendAt = new Date(Date.now() + AUTOPILOT_SEND_DELAY_MS).toISOString();
  const scheduled = await scheduleMessagingReply({
    conversationId: input.conversationId,
    coachId: input.coachId,
    channel: "linkedin",
    bodyText: text,
    scheduledFor: sendAt,
    attachments: [],
  });
  return { scheduled: true, text, offered, scheduledMessageId: scheduled.id as string, sendAt };
}
