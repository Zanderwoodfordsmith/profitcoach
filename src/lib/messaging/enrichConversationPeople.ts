import {
  inboundReplyChannels,
  isChannelOnlySubject,
  looksLikePersonName,
} from "@/lib/messaging/conversationDisplay";
import { phoneMatchKey } from "@/lib/messaging/knownContacts";
import {
  linkedInProviderIdFromUrl,
  normalizeLinkedInProviderId,
  parseLinkedInIdentity,
  preferLinkedInUrl,
} from "@/lib/contacts/linkedinIdentity";
import { normalizeContactLinkedInUrl } from "@/lib/contacts/identity";
import { leadDisplayName } from "@/lib/unipile/chatCounterpart";
import {
  isPollutedWhatsAppLinkedInUrl,
  phoneDigitsFromPollutedLinkedInUrl,
} from "@/lib/unipile/whatsappIdentity";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ConversationPersonRow = {
  id?: string;
  coach_id?: string | null;
  contact_id?: string | null;
  unipile_chat_id?: string | null;
  prospect_name?: string | null;
  prospect_email?: string | null;
  prospect_phone?: string | null;
  prospect_avatar_url?: string | null;
  prospect_linkedin_url?: string | null;
  prospect_linkedin_provider_id?: string | null;
  last_channel?: string | null;
  subject?: string | null;
  reply_channels?: string[];
};

type LinkedInBridge = {
  /** provider id → preferred vanity (or any) URL */
  urlByProvider: Map<string, string>;
  /** normalized linkedin URL → provider id */
  providerByUrl: Map<string, string>;
};

function addBridgePair(
  bridge: LinkedInBridge,
  url: string | null | undefined,
  providerId: string | null | undefined
) {
  const pair = parseLinkedInIdentity({ linkedinUrl: url, providerId });
  if (pair.providerId && pair.linkedinUrl) {
    const existing = bridge.urlByProvider.get(pair.providerId);
    bridge.urlByProvider.set(
      pair.providerId,
      preferLinkedInUrl(existing, pair.linkedinUrl) || pair.linkedinUrl
    );
  }
  if (pair.linkedinUrl) {
    const norm = normalizeContactLinkedInUrl(pair.linkedinUrl);
    if (norm && pair.providerId) {
      bridge.providerByUrl.set(norm, pair.providerId);
    }
  }
}

/**
 * Fill generic Unipile titles ("LinkedIn chat") and missing avatars from
 * linked contacts and campaign leads. Also repairs WhatsApp Linked IDs that
 * were mistakenly stored as prospect_phone / fake LinkedIn URLs, and bridges
 * LinkedIn vanity ↔ ACo… provider ids so inbox collapse can merge them.
 */
export async function enrichMessagingConversationPeople<
  T extends ConversationPersonRow,
>(rows: T[]): Promise<T[]> {
  if (!rows.length) return rows;

  const contactIds = new Set<string>();
  const chatIds: string[] = [];
  const coachIds = new Set<string>();
  for (const row of rows) {
    if (row.contact_id) contactIds.add(row.contact_id);
    if (row.unipile_chat_id) chatIds.push(row.unipile_chat_id);
    if (row.coach_id) coachIds.add(row.coach_id);
  }

  const leadsByChat = new Map<
    string,
    {
      first_name: string | null;
      last_name: string | null;
      contact_id: string | null;
      linkedin_url: string | null;
      linkedin_provider_id: string | null;
    }
  >();
  if (chatIds.length) {
    const { data: leads } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select(
        "unipile_chat_id, first_name, last_name, contact_id, linkedin_url, linkedin_provider_id"
      )
      .in("unipile_chat_id", chatIds);
    for (const lead of leads ?? []) {
      const chatId = lead.unipile_chat_id as string | null;
      if (!chatId || leadsByChat.has(chatId)) continue;
      leadsByChat.set(chatId, {
        first_name: (lead.first_name as string | null) ?? null,
        last_name: (lead.last_name as string | null) ?? null,
        contact_id: (lead.contact_id as string | null) ?? null,
        linkedin_url: (lead.linkedin_url as string | null) ?? null,
        linkedin_provider_id:
          (lead.linkedin_provider_id as string | null) ?? null,
      });
      if (lead.contact_id) contactIds.add(lead.contact_id as string);
    }
  }

  const contactsById = new Map<
    string,
    {
      full_name: string | null;
      email: string | null;
      phone: string | null;
      photo_url: string | null;
      linkedin_url: string | null;
      linkedin_provider_id: string | null;
    }
  >();
  if (contactIds.size) {
    const { data: contacts } = await supabaseAdmin
      .from("contacts")
      .select(
        "id, full_name, email, phone, photo_url, linkedin_url, linkedin_provider_id"
      )
      .in("id", [...contactIds]);
    for (const contact of contacts ?? []) {
      contactsById.set(contact.id as string, {
        full_name: (contact.full_name as string | null) ?? null,
        email: (contact.email as string | null) ?? null,
        phone: (contact.phone as string | null) ?? null,
        photo_url: (contact.photo_url as string | null) ?? null,
        linkedin_url: (contact.linkedin_url as string | null) ?? null,
        linkedin_provider_id:
          (contact.linkedin_provider_id as string | null) ?? null,
      });
    }
  }

  // Coach-wide LinkedIn bridge: any contact/lead that knows both forms
  // lets vanity threads and ACo… threads collapse together.
  const bridge: LinkedInBridge = {
    urlByProvider: new Map(),
    providerByUrl: new Map(),
  };
  for (const contact of contactsById.values()) {
    addBridgePair(bridge, contact.linkedin_url, contact.linkedin_provider_id);
  }
  for (const lead of leadsByChat.values()) {
    addBridgePair(bridge, lead.linkedin_url, lead.linkedin_provider_id);
  }
  if (coachIds.size) {
    const coachList = [...coachIds];
    const [{ data: bridgeContacts }, { data: bridgeLeads }] = await Promise.all([
      supabaseAdmin
        .from("contacts")
        .select("linkedin_url, linkedin_provider_id")
        .in("coach_id", coachList)
        .not("linkedin_provider_id", "is", null)
        .limit(2000),
      supabaseAdmin
        .from("linkedin_campaign_leads")
        .select("linkedin_url, linkedin_provider_id")
        .in("coach_id", coachList)
        .not("linkedin_provider_id", "is", null)
        .limit(2000),
    ]);
    for (const row of bridgeContacts ?? []) {
      addBridgePair(
        bridge,
        row.linkedin_url as string | null,
        row.linkedin_provider_id as string | null
      );
    }
    for (const row of bridgeLeads ?? []) {
      addBridgePair(
        bridge,
        row.linkedin_url as string | null,
        row.linkedin_provider_id as string | null
      );
    }
  }

  const stalePhoneUpdates: { id: string; phone: string }[] = [];
  const staleLinkedInClears: string[] = [];
  const staleLinkedInPatches: {
    id: string;
    prospect_linkedin_url?: string | null;
    prospect_linkedin_provider_id?: string | null;
  }[] = [];

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

    const rawLinkedIn = (row.prospect_linkedin_url || "").trim() || null;
    const recoveredWaDigits = phoneDigitsFromPollutedLinkedInUrl(rawLinkedIn);
    const contactLinkedIn =
      (contact?.linkedin_url || "").trim() ||
      (leadContact?.linkedin_url || "").trim() ||
      lead?.linkedin_url ||
      null;
    let prospect_linkedin_url = rawLinkedIn || contactLinkedIn;
    if (isPollutedWhatsAppLinkedInUrl(prospect_linkedin_url)) {
      prospect_linkedin_url = contactLinkedIn;
    }
    if (row.id && isPollutedWhatsAppLinkedInUrl(rawLinkedIn)) {
      staleLinkedInClears.push(row.id);
    }

    let prospect_linkedin_provider_id =
      normalizeLinkedInProviderId(row.prospect_linkedin_provider_id) ||
      normalizeLinkedInProviderId(contact?.linkedin_provider_id) ||
      normalizeLinkedInProviderId(leadContact?.linkedin_provider_id) ||
      normalizeLinkedInProviderId(lead?.linkedin_provider_id) ||
      linkedInProviderIdFromUrl(prospect_linkedin_url) ||
      null;

    const normUrl = normalizeContactLinkedInUrl(prospect_linkedin_url);
    if (!prospect_linkedin_provider_id && normUrl) {
      prospect_linkedin_provider_id =
        bridge.providerByUrl.get(normUrl) || null;
    }
    if (prospect_linkedin_provider_id) {
      const bridgedUrl = bridge.urlByProvider.get(prospect_linkedin_provider_id);
      prospect_linkedin_url = preferLinkedInUrl(
        prospect_linkedin_url,
        bridgedUrl
      );
    }
    prospect_linkedin_url = preferLinkedInUrl(
      prospect_linkedin_url,
      contactLinkedIn
    );

    if (
      row.id &&
      !isPollutedWhatsAppLinkedInUrl(rawLinkedIn) &&
      ((prospect_linkedin_provider_id &&
        prospect_linkedin_provider_id !==
          (row.prospect_linkedin_provider_id || null)) ||
        (prospect_linkedin_url &&
          prospect_linkedin_url !== (row.prospect_linkedin_url || null)))
    ) {
      staleLinkedInPatches.push({
        id: row.id,
        prospect_linkedin_url,
        prospect_linkedin_provider_id,
      });
    }

    const contactPhone = (contact?.phone || "").trim() || null;
    const contactDigits = phoneMatchKey(contactPhone);
    const rowDigits = phoneMatchKey(row.prospect_phone);
    const preferredPhone =
      (contactDigits ? contactPhone : null) ||
      (recoveredWaDigits ? `+${recoveredWaDigits}` : null);
    const preferredDigits = phoneMatchKey(preferredPhone);

    let prospect_phone = row.prospect_phone || contactPhone || null;
    if (
      preferredDigits &&
      rowDigits &&
      rowDigits !== preferredDigits &&
      (Boolean(recoveredWaDigits) || row.last_channel === "whatsapp")
    ) {
      prospect_phone = preferredPhone;
      if (row.id && preferredPhone) {
        stalePhoneUpdates.push({ id: row.id, phone: preferredPhone });
      }
    } else if (!rowDigits && preferredPhone) {
      prospect_phone = preferredPhone;
      if (row.id) {
        stalePhoneUpdates.push({ id: row.id, phone: preferredPhone });
      }
    } else if (recoveredWaDigits && rowDigits === recoveredWaDigits) {
      prospect_phone = `+${recoveredWaDigits}`;
    }

    const prospect_email =
      row.prospect_email || (contact?.email || "").trim() || null;

    let subject = row.subject ?? null;
    if (isChannelOnlySubject(subject, row.last_channel)) {
      subject = null;
    }

    return {
      ...row,
      prospect_name,
      prospect_email,
      prospect_phone,
      prospect_avatar_url,
      prospect_linkedin_url,
      prospect_linkedin_provider_id,
      subject,
    };
  });

  if (
    stalePhoneUpdates.length ||
    staleLinkedInClears.length ||
    staleLinkedInPatches.length
  ) {
    void Promise.all([
      ...stalePhoneUpdates.map(({ id, phone }) =>
        supabaseAdmin
          .from("messaging_conversations")
          .update({ prospect_phone: phone })
          .eq("id", id)
      ),
      ...staleLinkedInClears.map((id) =>
        supabaseAdmin
          .from("messaging_conversations")
          .update({
            prospect_linkedin_url: null,
            prospect_linkedin_provider_id: null,
          })
          .eq("id", id)
      ),
      ...staleLinkedInPatches.map((patch) =>
        supabaseAdmin
          .from("messaging_conversations")
          .update({
            prospect_linkedin_url: patch.prospect_linkedin_url,
            prospect_linkedin_provider_id: patch.prospect_linkedin_provider_id,
          })
          .eq("id", patch.id)
      ),
    ]).catch(() => {
      /* best-effort */
    });
  }

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
