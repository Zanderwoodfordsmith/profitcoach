import { normalizePhoneE164 } from "@/lib/bird/client";
import { enrichMessagingConversationPeople } from "@/lib/messaging/enrichConversationPeople";
import { listOutreachAccounts } from "@/lib/unipile/accounts";
import { resolveUnipileUser, startUnipileChat } from "@/lib/unipile/client";
import { linkedInPublicIdentifier } from "@/lib/unipile/linkedinUrl";
import {
  isMailingProvider,
  providerToAppChannel,
  type UnipileAppChannel,
} from "@/lib/unipile/providers";
import { selectContactsWithOptionalPhone } from "@/lib/contactsSchemaSafeSelect";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const CONVERSATION_SELECT =
  "id, coach_id, contact_id, booking_id, subject, prospect_name, prospect_email, prospect_phone, prospect_avatar_url, prospect_linkedin_url, prospect_business_name, last_message_at, created_at, starred, unread_count, last_preview, last_channel, unipile_chat_id, hidden_at";

type ContactRow = {
  id: string;
  coach_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  business_name: string | null;
  linkedin_url: string | null;
  photo_url: string | null;
};

export async function findOrCreateConversationForContact(
  coachId: string,
  contactId: string
) {
  const { data: contacts, error: contactError } =
    await selectContactsWithOptionalPhone<ContactRow>(
      async (columns) =>
        supabaseAdmin
          .from("contacts")
          .select(columns)
          .eq("id", contactId)
          .eq("coach_id", coachId),
      "id, coach_id, full_name, email, business_name",
      ["linkedin_url", "photo_url"]
    );

  if (contactError) throw new Error(contactError.message || "Contact lookup failed.");
  const contact = contacts[0];
  if (!contact) throw new Error("Contact not found.");

  const { data: existingRows } = await supabaseAdmin
    .from("messaging_conversations")
    .select(CONVERSATION_SELECT)
    .eq("coach_id", coachId)
    .eq("contact_id", contactId)
    .order("last_message_at", { ascending: false })
    .limit(1);
  const existing = existingRows?.[0];

  if (existing?.id) {
    if (existing.hidden_at) {
      await supabaseAdmin
        .from("messaging_conversations")
        .update({ hidden_at: null })
        .eq("id", existing.id);
      existing.hidden_at = null;
    }
    const [enriched] = await enrichMessagingConversationPeople([existing]);
    return { conversation: enriched, created: false };
  }

  const mailingAccountId = await firstAccountIdForChannel(coachId, "email");
  const insert = {
    coach_id: coachId,
    contact_id: contact.id,
    prospect_name: (contact.full_name as string | null)?.trim() || null,
    prospect_email: (contact.email as string | null)?.trim() || null,
    prospect_phone: (contact.phone as string | null)?.trim() || null,
    prospect_business_name:
      (contact.business_name as string | null)?.trim() || null,
    prospect_linkedin_url:
      (contact.linkedin_url as string | null)?.trim() || null,
    prospect_avatar_url: (contact.photo_url as string | null)?.trim() || null,
    last_message_at: new Date().toISOString(),
    last_preview: null,
    last_channel: inferDefaultChannel(contact as ContactRow),
    unread_count: 0,
    unipile_account_id: mailingAccountId,
  };

  const { data: created, error: insertError } = await supabaseAdmin
    .from("messaging_conversations")
    .insert(insert)
    .select(CONVERSATION_SELECT)
    .maybeSingle();

  if (insertError || !created) {
    throw new Error(insertError?.message || "Could not start conversation.");
  }

  const [enriched] = await enrichMessagingConversationPeople([created]);
  return { conversation: enriched, created: true };
}

function inferDefaultChannel(contact: ContactRow): string | null {
  if (contact.linkedin_url?.trim()) return "linkedin";
  if (contact.email?.trim()) return "email";
  if (contact.phone?.trim()) return "whatsapp";
  return null;
}

async function firstAccountIdForChannel(
  coachId: string,
  channel: UnipileAppChannel
): Promise<string | null> {
  const accounts = await listOutreachAccounts(coachId);
  const match = accounts.find((row) => {
    if ((row.status || "").toUpperCase() !== "OK") return false;
    if (channel === "email") return isMailingProvider(row.provider);
    return providerToAppChannel(row.provider) === channel;
  });
  return match?.unipile_account_id ?? null;
}

export async function resolveAccountIdForChannel(
  coachId: string,
  channel: UnipileAppChannel
): Promise<string | null> {
  return firstAccountIdForChannel(coachId, channel);
}

/** First outbound on a new thread: Unipile creates the chat with this text. */
export async function startFirstUnipileMessage(input: {
  coachId: string;
  conversationId: string;
  channel: UnipileAppChannel;
  text: string;
  contactId?: string | null;
  prospectPhone?: string | null;
  prospectLinkedInUrl?: string | null;
  unipileAccountId?: string | null;
}): Promise<{ chatId: string; accountId: string; messageId: string | null }> {
  const text = input.text.trim();
  if (!text) throw new Error("Message is empty.");

  // Prefer an account for this channel. Conversation may still be linked to
  // Gmail/etc from an earlier email thread — that id must not be reused for WhatsApp.
  const accountId =
    (await firstAccountIdForChannel(input.coachId, input.channel)) ||
    input.unipileAccountId ||
    null;
  if (!accountId) {
    throw new Error(
      `Connect ${input.channel} in Settings before starting a new chat.`
    );
  }

  const attendeeId = await resolveAttendeeId({
    coachId: input.coachId,
    accountId,
    channel: input.channel,
    contactId: input.contactId ?? null,
    prospectPhone: input.prospectPhone ?? null,
    prospectLinkedInUrl: input.prospectLinkedInUrl ?? null,
  });
  if (!attendeeId) {
    throw new Error(
      input.channel === "linkedin"
        ? "This person needs a LinkedIn profile URL before you can start a chat."
        : "This person needs a phone number before you can start a chat."
    );
  }

  const started = await startUnipileChat({
    account_id: accountId,
    attendees_ids: [attendeeId],
    text,
  });
  if (!started.ok || !started.data?.chat_id) {
    throw new Error(started.error || "Could not start that chat.");
  }

  const chatId = started.data.chat_id;
  await supabaseAdmin
    .from("messaging_conversations")
    .update({
      unipile_chat_id: chatId,
      unipile_account_id: accountId,
    })
    .eq("id", input.conversationId);

  return {
    chatId,
    accountId,
    messageId: started.data.message_id ?? null,
  };
}

async function resolveAttendeeId(input: {
  coachId: string;
  accountId: string;
  channel: UnipileAppChannel;
  contactId: string | null;
  prospectPhone: string | null;
  prospectLinkedInUrl: string | null;
}): Promise<string | null> {
  if (input.channel === "whatsapp") {
    const e164 = normalizePhoneE164(input.prospectPhone);
    if (!e164) return null;
    return e164.replace(/^\+/, "");
  }

  if (input.channel !== "linkedin") return null;

  if (input.contactId) {
    const { data: lead } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("linkedin_provider_id")
      .eq("coach_id", input.coachId)
      .eq("contact_id", input.contactId)
      .not("linkedin_provider_id", "is", null)
      .limit(1)
      .maybeSingle();
    const fromLead = (lead?.linkedin_provider_id as string | null)?.trim();
    if (fromLead) return fromLead;
  }

  const pub = input.prospectLinkedInUrl
    ? linkedInPublicIdentifier(input.prospectLinkedInUrl)
    : null;
  if (!pub) return null;

  const resolved = await resolveUnipileUser(pub, input.accountId);
  if (!resolved.ok || !resolved.data) return null;
  const data = resolved.data as Record<string, unknown>;
  return (
    (typeof data.provider_id === "string" && data.provider_id) ||
    (typeof data.id === "string" && data.id) ||
    null
  );
}
