import {
  sendUnipileChatMessage,
  startUnipileChat,
} from "@/lib/unipile/client";
import {
  downloadCampaignStepMedia,
  isOwnedCampaignStepMediaPath,
} from "@/lib/unipile/campaignStepMedia";
import { messageMediaFrom } from "@/lib/unipile/campaignStepTypes";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
