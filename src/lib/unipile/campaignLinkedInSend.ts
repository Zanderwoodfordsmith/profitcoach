import {
  listUnipileChatMessages,
  sendUnipileChatMessage,
  startUnipileChat,
  unipileFetch,
} from "@/lib/unipile/client";
import {
  isUnipileReactionEvent,
  parseUnipileMessageFlags,
} from "@/lib/messaging/messageReactions";
import {
  downloadCampaignStepMedia,
  isOwnedCampaignStepMediaPath,
} from "@/lib/unipile/campaignStepMedia";
import { messageMediaFrom } from "@/lib/unipile/campaignStepTypes";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * True when the person has ever written to the coach in their one-to-one
 * LinkedIn chat. Catches replies from before the lead was imported (the inbox
 * only stops a sequence on replies it sees arrive). With no saved chat, the
 * chat is looked up by the person's LinkedIn id, since a send would reuse it.
 * Throws when the chat can't be read, so nothing goes out unchecked.
 */
export async function leadHasWrittenInChat(input: {
  chatId: string | null;
  providerId: string | null;
  accountId: string;
}): Promise<boolean> {
  let chatId = input.chatId;
  if (!chatId && input.providerId) {
    const found = await unipileFetch<{ items?: Array<Record<string, unknown>> }>(
      "GET",
      `/api/v1/chat_attendees/${encodeURIComponent(input.providerId)}/chats?account_id=${encodeURIComponent(input.accountId)}&limit=10`
    );
    if (!found.ok && found.status !== 404) {
      throw new Error(found.error || "Could not check the LinkedIn chat before sending.");
    }
    const oneToOne = (found.data?.items ?? []).find((c) => Number(c.type) === 0 && c.id);
    chatId = oneToOne ? String(oneToOne.id) : null;
  }
  if (!chatId) return false;
  const res = await listUnipileChatMessages({ chat_id: chatId, limit: 100 });
  if (!res.ok) {
    throw new Error(res.error || "Could not check the LinkedIn chat before sending.");
  }
  return (res.data?.items ?? []).some((m) => {
    if (m.is_sender) return false;
    const flags = parseUnipileMessageFlags(m);
    if (flags.isEvent || flags.hidden || isUnipileReactionEvent(flags)) return false;
    const files = Array.isArray(m.attachments) ? m.attachments.length : 0;
    return Boolean(flags.text) || files > 0;
  });
}

export async function sendCampaignLinkedInMessage(input: {
  coachId: string;
  campaignId: string;
  accountId: string;
  providerId: string;
  lead: Record<string, unknown>;
  text: string;
  stepConfig?: unknown;
}): Promise<{ chatId: string | null; messageId: string | null }> {
  const media = messageMediaFrom(input.stepConfig);
  if (
    media &&
    !isOwnedCampaignStepMediaPath(input.coachId, input.campaignId, media.path)
  ) {
    throw new Error("Voice or video file is missing.");
  }
  const text = input.text.trim();
  if (!text && !media) throw new Error("Empty message body.");

  let chatId = (input.lead.unipile_chat_id as string | null) ?? null;
  let startedWithText = false;

  if (!chatId) {
    const startText = text || " ";
    const res = await startUnipileChat({
      account_id: input.accountId,
      attendees_ids: [input.providerId],
      text: startText,
    });
    if (!res.ok) throw new Error(res.error || "Start chat failed");
    chatId = res.data?.chat_id ?? null;
    startedWithText = Boolean(text);
    if (chatId) {
      await supabaseAdmin
        .from("linkedin_campaign_leads")
        .update({ unipile_chat_id: chatId })
        .eq("id", input.lead.id);
    }
    if (!media) {
      return { chatId, messageId: res.data?.message_id ?? null };
    }
  }

  if (!chatId) throw new Error("Start chat failed");

  if (!media) {
    const res = await sendUnipileChatMessage({
      chat_id: chatId,
      text,
      account_id: input.accountId,
    });
    if (!res.ok) throw new Error(res.error || "Send message failed");
    return { chatId, messageId: res.data?.message_id ?? null };
  }

  const file = await downloadCampaignStepMedia(media);
  const payload =
    media.kind === "voice"
      ? { voice_message: file }
      : { video_message: file };
  const res = await sendUnipileChatMessage({
    chat_id: chatId,
    text: startedWithText ? undefined : text || undefined,
    account_id: input.accountId,
    ...payload,
  });
  if (!res.ok) throw new Error(res.error || "Send message failed");
  return { chatId, messageId: res.data?.message_id ?? null };
}
