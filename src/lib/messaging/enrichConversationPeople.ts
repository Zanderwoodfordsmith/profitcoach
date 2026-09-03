import {
  inboundReplyChannels,
  isChannelOnlySubject,
  looksLikePersonName,
} from "@/lib/messaging/conversationDisplay";
import { leadDisplayName } from "@/lib/unipile/chatCounterpart";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ConversationPersonRow = {
  id?: string;
  contact_id?: string | null;
  unipile_chat_id?: string | null;
  prospect_name?: string | null;
  prospect_email?: string | null;
  prospect_avatar_url?: string | null;
  prospect_linkedin_url?: string | null;
  last_channel?: string | null;
  subject?: string | null;
  reply_channels?: string[];
};

/**
 * Fill generic Unipile titles ("LinkedIn chat") and missing avatars from
 * linked contacts and campaign leads.
 */
export async function enrichMessagingConversationPeople<
  T extends ConversationPersonRow,
>(rows: T[]): Promise<T[]> {
  if (!rows.length) return rows;

  const contactIds = new Set<string>();
  const chatIds: string[] = [];
  for (const row of rows) {
    if (row.contact_id) contactIds.add(row.contact_id);
    if (row.unipile_chat_id) chatIds.push(row.unipile_chat_id);
  }

  const leadsByChat = new Map<
    string,
    {
      first_name: string | null;
      last_name: string | null;
      contact_id: string | null;
      linkedin_url: string | null;
    }
  >();
  if (chatIds.length) {
    const { data: leads } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("unipile_chat_id, first_name, last_name, contact_id, linkedin_url")
      .in("unipile_chat_id", chatIds);
    for (const lead of leads ?? []) {
      const chatId = lead.unipile_chat_id as string | null;
      if (!chatId || leadsByChat.has(chatId)) continue;
      leadsByChat.set(chatId, {
        first_name: (lead.first_name as string | null) ?? null,
        last_name: (lead.last_name as string | null) ?? null,
        contact_id: (lead.contact_id as string | null) ?? null,
        linkedin_url: (lead.linkedin_url as string | null) ?? null,
      });
      if (lead.contact_id) contactIds.add(lead.contact_id as string);
    }
  }

  const contactsById = new Map<
    string,
    { full_name: string | null; photo_url: string | null; linkedin_url: string | null }
  >();
  if (contactIds.size) {
    const { data: contacts } = await supabaseAdmin
      .from("contacts")
      .select("id, full_name, photo_url, linkedin_url")
      .in("id", [...contactIds]);
    for (const contact of contacts ?? []) {
      contactsById.set(contact.id as string, {
        full_name: (contact.full_name as string | null) ?? null,
        photo_url: (contact.photo_url as string | null) ?? null,
        linkedin_url: (contact.linkedin_url as string | null) ?? null,
      });
    }
  }

  const named = rows.map((row) => {
    const contact = row.contact_id
      ? contactsById.get(row.contact_id)
      : undefined;
    const lead = row.unipile_chat_id
      ? leadsByChat.get(row.unipile_chat_id)
      : undefined;
    const leadContact = lead?.contact_id
      ? contactsById.get(lead.contact_id)
      : undefined;
    const leadName = leadDisplayName(lead);

    let prospect_name = row.prospect_name ?? null;
    if (!looksLikePersonName(prospect_name)) {
      const better =
        (contact?.full_name || "").trim() ||
        leadName ||
        (leadContact?.full_name || "").trim() ||
        null;
      if (better) prospect_name = better;
    }

    const prospect_avatar_url =
      row.prospect_avatar_url ||
      contact?.photo_url ||
      leadContact?.photo_url ||
      null;
    const prospect_linkedin_url =
      row.prospect_linkedin_url ||
      contact?.linkedin_url ||
      leadContact?.linkedin_url ||
      lead?.linkedin_url ||
      null;

    let subject = row.subject ?? null;
    if (isChannelOnlySubject(subject, row.last_channel)) {
      subject = null;
    }

    return {
      ...row,
      prospect_name,
      prospect_avatar_url,
      prospect_linkedin_url,
      subject,
    };
  });

  return attachInboundReplyChannels(named);
}

async function attachInboundReplyChannels<T extends ConversationPersonRow>(
  rows: T[]
): Promise<(T & { reply_channels: string[] })[]> {
  const ids = rows
    .map((row) => row.id)
    .filter((id): id is string => Boolean(id));
  const latest = new Map<string, { channel: string; at: number }[]>();
  if (ids.length) {
    const { data: messages } = await supabaseAdmin
      .from("messaging_messages")
      .select("conversation_id, channel, created_at")
      .in("conversation_id", ids)
      .eq("direction", "inbound");
    for (const message of messages ?? []) {
      const convId = message.conversation_id as string | null;
      const channel = (message.channel as string | null) ?? null;
      if (!convId || !channel) continue;
      const list = latest.get(convId) ?? [];
      list.push({
        channel,
        at: message.created_at ? new Date(message.created_at).getTime() : 0,
      });
      latest.set(convId, list);
    }
  }

  return rows.map((row) => {
    const inbound = inboundReplyChannels(
      (latest.get(row.id || "") ?? []).map((item) => ({
        channel: item.channel,
        direction: "inbound",
        created_at: new Date(item.at).toISOString(),
      })),
      row.last_channel
    );
    return { ...row, reply_channels: inbound };
  });
}
