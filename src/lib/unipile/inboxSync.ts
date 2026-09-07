import { findContactByIdentity } from "@/lib/contacts/identity";
import {
  linkedInIdentityIncomplete,
  normalizeLinkedInProviderId,
  parseLinkedInIdentity,
  preferLinkedInUrl,
  resolveLinkedInIdentityPair,
} from "@/lib/contacts/linkedinIdentity";
import {
  isChannelOnlySubject,
  isGenericConversationName,
  looksLikePersonName,
} from "@/lib/messaging/conversationDisplay";
import {
  downloadMessagingAttachments,
  uploadMessagingAttachment,
} from "@/lib/messaging/messageAttachments";
import type { MessagingAttachmentMeta } from "@/lib/messaging/messageAttachments";
import {
  resolveAccountIdForChannel,
  startFirstUnipileMessage,
} from "@/lib/messaging/startConversation";
import {
  channelRequiresKnownContact,
  loadKnownContactIndex,
  matchKnownContact,
} from "@/lib/messaging/knownContacts";
import { conversationActivityPatch } from "@/lib/messaging/conversationActivity";
import {
  applyReactionToParentMessage,
  extractReactionEmoji,
  formatReactionPreview,
  isUnipileReactionEvent,
  parseUnipileMessageFlags,
  patchMessageReactionsByUnipileId,
} from "@/lib/messaging/messageReactions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  counterpartForChat,
  counterpartFromAttendees,
  indexAttendeesByProviderId,
  leadDisplayName,
  parseUnipileAttendee,
  type ChatCounterpart,
  type UnipileChatAttendee,
} from "@/lib/unipile/chatCounterpart";
import { whatsappPhoneDigits } from "@/lib/unipile/whatsappIdentity";
import { markContactWhatsAppOn } from "@/lib/unipile/checkWhatsAppOn";
import {
  listUnipileAttendees,
  listUnipileChatAttendees,
  listUnipileChatMessages,
  listUnipileChats,
  listUnipileEmails,
  sendUnipileChatMessage,
  sendUnipileEmail,
} from "@/lib/unipile/client";
import {
  isMailingProvider,
  isMessagingProvider,
  normalizeUnipileProvider,
  providerToAppChannel,
  type UnipileAppChannel,
} from "@/lib/unipile/providers";

/** Cap Unipile profile lookups per soft sync to stay under provider limits. */
const MAX_LINKEDIN_PAIR_RESOLVES_PER_SYNC = 12;

function previewOf(text: string | null | undefined) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  return t.slice(0, 160);
}

function emailThreadKey(threadId: string | null | undefined, emailId: string) {
  const tid = (threadId || "").trim();
  if (tid) return `email_thread:${tid}`;
  return `email:${emailId}`;
}

/** Soft syncs (inbox open) skip if last run was within this window. Cron/force bypass. */
export const LINKEDIN_INBOX_SOFT_SYNC_MS = 2 * 60 * 60 * 1000;
export const UNIPILE_INBOX_SOFT_SYNC_MS = LINKEDIN_INBOX_SOFT_SYNC_MS;

async function upsertChatMessage(input: {
  conversationId: string;
  coachId: string;
  channel: UnipileAppChannel;
  messageId: string;
  text: string;
  direction: "inbound" | "outbound";
  createdAt: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("messaging_messages").upsert(
    {
      conversation_id: input.conversationId,
      coach_id: input.coachId,
      channel: input.channel,
      direction: input.direction,
      status: "delivered",
      body_text: input.text,
      unipile_message_id: input.messageId,
      metadata: input.metadata ?? {},
      created_at: input.createdAt,
    },
    { onConflict: "unipile_message_id", ignoreDuplicates: true }
  );
  if (error && error.code !== "23505") {
    await supabaseAdmin.from("messaging_messages").insert({
      conversation_id: input.conversationId,
      coach_id: input.coachId,
      channel: input.channel,
      direction: input.direction,
      status: "delivered",
      body_text: input.text,
      unipile_message_id: input.messageId,
      metadata: input.metadata ?? {},
      created_at: input.createdAt,
    });
  }
  return !error || error.code === "23505";
}

async function loadAttendeesByProviderId(
  unipileAccountId: string
): Promise<Map<string, UnipileChatAttendee>> {
  const listed = await listUnipileAttendees({
    account_id: unipileAccountId,
    limit: 250,
  });
  const attendees = (listed.data?.items ?? [])
    .map(parseUnipileAttendee)
    .filter((a): a is UnipileChatAttendee => Boolean(a));
  return indexAttendeesByProviderId(attendees);
}

async function resolveChatCounterpart(input: {
  chat: Record<string, unknown>;
  chatId: string;
  channel: UnipileAppChannel;
  attendeesByProviderId: Map<string, UnipileChatAttendee>;
  leadName: string | null;
  fetchIfMissing?: boolean;
}): Promise<ChatCounterpart> {
  const fromList = counterpartForChat(
    input.chat,
    input.attendeesByProviderId,
    input.channel
  );
  let counterpart = fromList;
  if (!counterpart.name && input.fetchIfMissing !== false) {
    const fetched = await listUnipileChatAttendees({ chat_id: input.chatId });
    if (fetched.ok) {
      const attendees = (fetched.data?.items ?? [])
        .map(parseUnipileAttendee)
        .filter((a): a is UnipileChatAttendee => Boolean(a));
      const fromChat = counterpartFromAttendees(attendees);
      counterpart = {
        ...counterpart,
        name: fromChat.name || counterpart.name,
        pictureUrl: fromChat.pictureUrl || counterpart.pictureUrl,
        profileUrl: fromChat.profileUrl || counterpart.profileUrl,
        occupation: fromChat.occupation || counterpart.occupation,
        email: fromChat.email || counterpart.email,
        providerId: fromChat.providerId || counterpart.providerId,
        phone: fromChat.phone || counterpart.phone,
      };
    }
  }
  if (!counterpart.name && input.leadName) {
    counterpart = { ...counterpart, name: input.leadName };
  }
  return counterpart;
}

async function backfillUnnamedChatIdentities(input: {
  coachId: string;
  channel: UnipileAppChannel;
}): Promise<void> {
  const { data: rows } = await supabaseAdmin
    .from("messaging_conversations")
    .select("id, unipile_chat_id, prospect_name, subject, prospect_avatar_url, prospect_linkedin_url")
    .eq("coach_id", input.coachId)
    .eq("last_channel", input.channel)
    .not("unipile_chat_id", "is", null)
    .limit(80);

  let fetched = 0;
  for (const row of rows ?? []) {
    const existingName = (row.prospect_name as string | null) ?? null;
    const existingAvatar = (row.prospect_avatar_url as string | null) ?? null;
    const existingLinkedIn = (row.prospect_linkedin_url as string | null) ?? null;
    if (looksLikePersonName(existingName) && existingAvatar && existingLinkedIn)
      continue;
    const chatId = String(row.unipile_chat_id || "");
    if (!chatId) continue;
    if (fetched >= 25) break;

    const listed = await listUnipileChatAttendees({ chat_id: chatId });
    fetched += 1;
    if (!listed.ok) continue;
    const attendees = (listed.data?.items ?? [])
      .map(parseUnipileAttendee)
      .filter((a): a is UnipileChatAttendee => Boolean(a));
    const counterpart = counterpartFromAttendees(attendees);
    if (!counterpart.name && !counterpart.pictureUrl) continue;

    const patch = identityPatch({
      channel: input.channel,
      counterpart,
      existingName,
      existingSubject: (row.subject as string | null) ?? null,
      linkedinUrl: counterpart.profileUrl,
      linkedinProviderId: counterpart.providerId,
    });
    if (
      !patch.prospect_name &&
      !patch.prospect_avatar_url &&
      !patch.prospect_linkedin_url &&
      !patch.prospect_linkedin_provider_id
    )
      continue;
    await supabaseAdmin
      .from("messaging_conversations")
      .update(patch)
      .eq("id", row.id);
  }
}

function identityPatch(input: {
  channel: UnipileAppChannel;
  counterpart: ChatCounterpart;
  leadContactId?: string | null;
  existingName?: string | null;
  existingSubject?: string | null;
  linkedinUrl?: string | null;
  linkedinProviderId?: string | null;
}): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    last_channel: input.channel,
  };
  const resolvedName = input.counterpart.name;
  if (resolvedName && looksLikePersonName(resolvedName)) {
    patch.prospect_name = resolvedName.slice(0, 200);
  }
  if (input.counterpart.pictureUrl) {
    patch.prospect_avatar_url = input.counterpart.pictureUrl;
  }
  if (input.channel !== "whatsapp") {
    const liUrl =
      input.linkedinUrl || input.counterpart.profileUrl || null;
    if (liUrl) patch.prospect_linkedin_url = liUrl;
    const providerId =
      normalizeLinkedInProviderId(input.linkedinProviderId) ||
      normalizeLinkedInProviderId(input.counterpart.providerId);
    if (providerId) patch.prospect_linkedin_provider_id = providerId;
  }
  if (input.counterpart.email) {
    patch.prospect_email = input.counterpart.email;
  }
  if (input.channel === "whatsapp" && input.counterpart.phone) {
    patch.prospect_phone = input.counterpart.phone;
  }
  const occupation = input.counterpart.occupation;
  if (
    occupation &&
    (!input.existingSubject ||
      isChannelOnlySubject(input.existingSubject, input.channel))
  ) {
    patch.subject = occupation.slice(0, 200);
  }
  if (input.leadContactId) patch.contact_id = input.leadContactId;
  return patch;
}

async function syncMessagingAccount(input: {
  coachId: string;
  unipileAccountId: string;
  channel: UnipileAppChannel;
  /** Full history pull. Soft visits skip unchanged chats. */
  includeMessages?: boolean;
  /** Soft open: only fetch messages when Unipile shows newer activity. */
  messagesOnlyIfStale?: boolean;
  /** Cap expensive LinkedIn vanity↔provider resolves (0 = skip). */
  maxLinkedInPairResolves?: number;
}): Promise<{ chats: number; messages: number }> {
  let chats = 0;
  let messages = 0;
  const listed = await listUnipileChats({
    account_id: input.unipileAccountId,
    limit: 80,
  });
  if (!listed.ok) return { chats, messages };
  const items = listed.data?.items ?? [];
  const attendeesByProviderId = await loadAttendeesByProviderId(
    input.unipileAccountId
  );
  const includeMessages = input.includeMessages !== false;
  const messagesOnlyIfStale = Boolean(input.messagesOnlyIfStale);
  const requireKnown = channelRequiresKnownContact(input.channel);
  const knownContacts = requireKnown
    ? await loadKnownContactIndex(input.coachId)
    : null;
  const maxPairResolves =
    input.maxLinkedInPairResolves ??
    (includeMessages && !messagesOnlyIfStale
      ? MAX_LINKEDIN_PAIR_RESOLVES_PER_SYNC
      : 0);
  let linkedInPairResolves = 0;

  for (const chat of items) {
    const chatId = String(chat.id || chat.chat_id || "");
    if (!chatId) continue;

    let { data: lead } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select(
        "id, contact_id, campaign_id, first_name, last_name, linkedin_url, linkedin_provider_id"
      )
      .eq("coach_id", input.coachId)
      .eq("unipile_chat_id", chatId)
      .maybeSingle();

    if (!lead) {
      const providerId = String(chat.attendee_provider_id || "").trim();
      if (providerId) {
        const { data: byProvider } = await supabaseAdmin
          .from("linkedin_campaign_leads")
          .select(
            "id, contact_id, campaign_id, first_name, last_name, linkedin_url, linkedin_provider_id"
          )
          .eq("coach_id", input.coachId)
          .eq("linkedin_provider_id", providerId)
          .maybeSingle();
        if (byProvider?.id) {
          lead = byProvider;
          await supabaseAdmin
            .from("linkedin_campaign_leads")
            .update({ unipile_chat_id: chatId })
            .eq("id", byProvider.id)
            .is("unipile_chat_id", null);
        }
      }
    }

    const counterpart = await resolveChatCounterpart({
      chat,
      chatId,
      channel: input.channel,
      attendeesByProviderId,
      leadName: leadDisplayName(lead),
      fetchIfMissing: true,
    });
    const prospectName = counterpart.name || "Unknown contact";

    let conversationId: string | null = null;
    const { data: existingConv } = await supabaseAdmin
      .from("messaging_conversations")
      .select(
        "id, prospect_name, subject, prospect_avatar_url, contact_id, prospect_linkedin_url, prospect_linkedin_provider_id, last_message_at, unread_count, last_preview"
      )
      .eq("coach_id", input.coachId)
      .eq("unipile_chat_id", chatId)
      .maybeSingle();

    let linkedInPair = parseLinkedInIdentity({
      linkedinUrl:
        input.channel === "linkedin"
          ? counterpart.profileUrl ||
            (lead?.linkedin_url as string | null) ||
            (existingConv?.prospect_linkedin_url as string | null)
          : null,
      providerId:
        input.channel === "linkedin"
          ? counterpart.providerId ||
            (lead?.linkedin_provider_id as string | null) ||
            (existingConv?.prospect_linkedin_provider_id as string | null)
          : null,
    });
    if (
      input.channel === "linkedin" &&
      linkedInIdentityIncomplete(linkedInPair) &&
      linkedInPairResolves < maxPairResolves &&
      (linkedInPair.providerId || linkedInPair.linkedinUrl)
    ) {
      linkedInPairResolves += 1;
      linkedInPair = await resolveLinkedInIdentityPair({
        linkedinUrl: linkedInPair.linkedinUrl,
        providerId: linkedInPair.providerId,
        publicIdentifier: linkedInPair.publicIdentifier,
        unipileAccountId: input.unipileAccountId,
      });
    }

    const waPhoneDigits =
      input.channel === "whatsapp"
        ? whatsappPhoneDigits({
            phoneNumber: counterpart.phone,
            publicIdentifier: String(chat.attendee_public_identifier || ""),
            providerId:
              counterpart.providerId ||
              String(chat.attendee_provider_id || ""),
            name: counterpart.name,
          })
        : null;
    const known =
      requireKnown && knownContacts
        ? matchKnownContact(knownContacts, {
            email: counterpart.email,
            phone: waPhoneDigits,
          })
        : null;

    let linkedContactId =
      (lead?.contact_id as string | null) ||
      (existingConv?.contact_id as string | null) ||
      known?.id ||
      null;

    if (!linkedContactId && input.channel === "linkedin") {
      const matched = await findContactByIdentity(input.coachId, {
        linkedinUrl: linkedInPair.linkedinUrl,
        linkedinProviderId: linkedInPair.providerId,
        email: counterpart.email,
      });
      if (matched?.id) linkedContactId = matched.id;
    }

    if (
      linkedContactId &&
      input.channel === "linkedin" &&
      (linkedInPair.providerId || linkedInPair.hasVanity)
    ) {
      // Absorb blanks / upgrade ACo → vanity on the matched contact.
      const { data: existingContact } = await supabaseAdmin
        .from("contacts")
        .select("linkedin_url, linkedin_provider_id")
        .eq("id", linkedContactId)
        .maybeSingle();
      if (existingContact) {
        const nextUrl = preferLinkedInUrl(
          existingContact.linkedin_url as string | null,
          linkedInPair.linkedinUrl
        );
        const patch: Record<string, unknown> = {};
        if (
          nextUrl &&
          nextUrl !== (existingContact.linkedin_url as string | null)
        ) {
          patch.linkedin_url = nextUrl;
        }
        if (
          linkedInPair.providerId &&
          !existingContact.linkedin_provider_id
        ) {
          patch.linkedin_provider_id = linkedInPair.providerId;
        }
        if (Object.keys(patch).length) {
          const { error: contactUpdateError } = await supabaseAdmin
            .from("contacts")
            .update(patch)
            .eq("id", linkedContactId);
          // Unique conflict on vanity URL usually means another contact
          // already holds it — leave merge to the coach UI.
          if (
            contactUpdateError &&
            contactUpdateError.code !== "23505"
          ) {
            console.error(
              "inbox sync contact linkedin bridge:",
              contactUpdateError.message
            );
          }
        }
      }
    }

    if (
      lead?.id &&
      input.channel === "linkedin" &&
      (linkedInPair.providerId || linkedInPair.hasVanity)
    ) {
      const leadPatch: Record<string, unknown> = {};
      if (
        linkedInPair.providerId &&
        linkedInPair.providerId !== (lead.linkedin_provider_id as string | null)
      ) {
        leadPatch.linkedin_provider_id = linkedInPair.providerId;
      }
      const nextLeadUrl = preferLinkedInUrl(
        lead.linkedin_url as string | null,
        linkedInPair.linkedinUrl
      );
      if (
        nextLeadUrl &&
        nextLeadUrl !== (lead.linkedin_url as string | null)
      ) {
        leadPatch.linkedin_url = nextLeadUrl;
      }
      if (linkedContactId && !lead.contact_id) {
        leadPatch.contact_id = linkedContactId;
      }
      if (Object.keys(leadPatch).length) {
        await supabaseAdmin
          .from("linkedin_campaign_leads")
          .update(leadPatch)
          .eq("id", lead.id);
      }
    }

    if (requireKnown && !linkedContactId) {
      // Personal channel — do not pull private chats into Conversations.
      continue;
    }

    chats += 1;

    const identity = identityPatch({
      channel: input.channel,
      counterpart,
      leadContactId: linkedContactId,
      existingName: (existingConv?.prospect_name as string | null) ?? null,
      existingSubject: (existingConv?.subject as string | null) ?? null,
      linkedinUrl:
        input.channel === "linkedin" ? linkedInPair.linkedinUrl : null,
      linkedinProviderId:
        input.channel === "linkedin" ? linkedInPair.providerId : null,
    });
    if (waPhoneDigits && input.channel === "whatsapp") {
      identity.prospect_phone = `+${waPhoneDigits}`;
    }
    if (input.channel === "whatsapp") {
      // Clear accidental LinkedIn URLs built from WhatsApp JIDs.
      identity.prospect_linkedin_url = null;
      identity.prospect_linkedin_provider_id = null;
    }
    if (known?.full_name && !looksLikePersonName(prospectName)) {
      identity.prospect_name = known.full_name;
    }

    if (
      input.channel === "whatsapp" &&
      linkedContactId &&
      waPhoneDigits
    ) {
      void markContactWhatsAppOn({
        coachId: input.coachId,
        contactId: linkedContactId,
        phone: waPhoneDigits,
      }).catch(() => {
        /* best-effort */
      });
    }

    if (existingConv?.id) {
      conversationId = existingConv.id as string;
      const chatTimestamp = String(
        chat.timestamp || chat.last_message_at || ""
      ).trim();
      const remoteUnread = Number(chat.unread_count);
      const metaPatch: Record<string, unknown> = { ...identity };
      if (chatTimestamp) {
        const remoteAt = new Date(chatTimestamp).getTime();
        const localAt = existingConv.last_message_at
          ? new Date(existingConv.last_message_at as string).getTime()
          : 0;
        if (Number.isFinite(remoteAt) && remoteAt > localAt) {
          metaPatch.last_message_at = new Date(remoteAt).toISOString();
        }
      }
      if (Number.isFinite(remoteUnread) && remoteUnread >= 0) {
        metaPatch.unread_count = remoteUnread;
      }
      await supabaseAdmin
        .from("messaging_conversations")
        .update(metaPatch)
        .eq("id", conversationId);
    } else {
      const { data: created } = await supabaseAdmin
        .from("messaging_conversations")
        .insert({
          coach_id: input.coachId,
          contact_id: linkedContactId,
          prospect_name: known?.full_name || prospectName,
          prospect_email: counterpart.email || known?.email || null,
          prospect_phone: waPhoneDigits
            ? `+${waPhoneDigits}`
            : known?.phone || null,
          prospect_avatar_url: counterpart.pictureUrl,
          prospect_linkedin_url:
            input.channel === "whatsapp" ? null : linkedInPair.linkedinUrl,
          prospect_linkedin_provider_id:
            input.channel === "whatsapp" ? null : linkedInPair.providerId,
          subject: counterpart.occupation || null,
          unipile_chat_id: chatId,
          unipile_account_id: input.unipileAccountId,
          last_channel: input.channel,
          last_message_at: String(chat.timestamp || "").trim()
            ? new Date(String(chat.timestamp)).toISOString()
            : new Date().toISOString(),
          unread_count: Number(chat.unread_count) || 0,
        })
        .select("id")
        .maybeSingle();
      conversationId = (created?.id as string) ?? null;
    }
    if (!conversationId) continue;

    let shouldPullMessages = includeMessages;
    if (includeMessages && messagesOnlyIfStale) {
      if (!existingConv?.id) {
        shouldPullMessages = true;
      } else {
        const chatTimestamp = String(
          chat.timestamp || chat.last_message_at || ""
        ).trim();
        const remoteAt = chatTimestamp
          ? new Date(chatTimestamp).getTime()
          : 0;
        const localAt = existingConv.last_message_at
          ? new Date(existingConv.last_message_at as string).getTime()
          : 0;
        const remoteUnread = Number(chat.unread_count) || 0;
        const localUnread = Number(existingConv.unread_count) || 0;
        shouldPullMessages =
          (Number.isFinite(remoteAt) && remoteAt > localAt + 1000) ||
          remoteUnread > localUnread ||
          !(existingConv.last_preview as string | null)?.trim();
      }
    }

    if (!shouldPullMessages) continue;

    const msgs = await listUnipileChatMessages({ chat_id: chatId, limit: 30 });
    if (!msgs.ok) continue;

    let latestAt: string | null = null;
    let latestPreview: string | null = null;
    let latestDirection: "inbound" | "outbound" | null = null;
    let inboundSeen = false;

    for (const msg of msgs.data?.items ?? []) {
      const messageId = String(msg.id || msg.message_id || "");
      if (!messageId) continue;
      const flags = parseUnipileMessageFlags(msg as Record<string, unknown>);
      const text = flags.text;
      const isSender =
        Boolean(msg.is_sender) ||
        String(msg.folder || "").toLowerCase() === "sent" ||
        String(msg.direction || "").toLowerCase() === "outbound";
      const direction = isSender ? "outbound" : "inbound";
      const createdAt =
        (msg.timestamp as string) ||
        (msg.sent_at as string) ||
        (msg.date as string) ||
        new Date().toISOString();

      if (isUnipileReactionEvent(flags)) {
        const emoji = extractReactionEmoji(text);
        let attached = false;
        if (flags.parentId) {
          attached = await applyReactionToParentMessage({
            conversationId,
            parentUnipileMessageId: flags.parentId,
            reaction: {
              value: emoji,
              is_sender: isSender,
            },
          });
        }
        if (!attached) {
          // Keep a lightweight row so coaches still see engagement if parent
          // isn't in the last-N sync window — UI renders this as a system line.
          const ok = await upsertChatMessage({
            conversationId,
            coachId: input.coachId,
            channel: input.channel,
            messageId,
            text: formatReactionPreview(emoji, { isSender }),
            direction,
            createdAt,
            metadata: {
              chat_id: chatId,
              kind: "reaction_event",
              is_event: true,
              event_type: flags.eventType,
              parent_unipile_message_id: flags.parentId,
              reaction: emoji,
              hidden: true,
            },
          });
          if (ok) messages += 1;
        }
        if (!latestAt || new Date(createdAt) >= new Date(latestAt)) {
          latestAt = createdAt;
          latestPreview = formatReactionPreview(emoji, { isSender });
          latestDirection = direction;
        }
        continue;
      }

      const ok = await upsertChatMessage({
        conversationId,
        coachId: input.coachId,
        channel: input.channel,
        messageId,
        text,
        direction,
        createdAt,
        metadata: {
          chat_id: chatId,
          ...(flags.reactions.length ? { reactions: flags.reactions } : {}),
        },
      });
      if (ok) messages += 1;
      if (flags.reactions.length) {
        await patchMessageReactionsByUnipileId({
          conversationId,
          unipileMessageId: messageId,
          reactions: flags.reactions,
        });
      }

      if (!latestAt || new Date(createdAt) >= new Date(latestAt)) {
        latestAt = createdAt;
        latestPreview = previewOf(text);
        latestDirection = direction;
      }
      if (direction === "inbound") inboundSeen = true;
    }

    if (latestAt) {
      await supabaseAdmin
        .from("messaging_conversations")
        .update({
          ...identity,
          ...conversationActivityPatch({
            lastChannel: input.channel,
            lastDirection: latestDirection || "inbound",
            lastMessageAt: latestAt,
            lastPreview: latestPreview,
          }),
        })
        .eq("id", conversationId);
    }

    if (inboundSeen && lead?.id) {
      const { data: campaign } = await supabaseAdmin
        .from("linkedin_campaigns")
        .select("stop_on_reply")
        .eq("id", lead.campaign_id)
        .maybeSingle();
      if (campaign?.stop_on_reply !== false) {
        await supabaseAdmin
          .from("linkedin_campaign_leads")
          .update({ status: "replied", next_action_at: null })
          .eq("id", lead.id)
          .neq("status", "replied");
        const { cancelOpenSendJobs } = await import("@/lib/unipile/remindQueue");
        await cancelOpenSendJobs(lead.id as string, "Lead replied");
      }
    }
  }

  await backfillUnnamedChatIdentities({
    coachId: input.coachId,
    channel: input.channel,
  });

  return { chats, messages };
}

async function syncMailingAccount(input: {
  coachId: string;
  unipileAccountId: string;
  /** Soft visit: list headers only when the API supports it. */
  metaOnly?: boolean;
}): Promise<{ chats: number; messages: number }> {
  let chats = 0;
  let messages = 0;
  const listed = await listUnipileEmails({
    account_id: input.unipileAccountId,
    limit: input.metaOnly ? 30 : 50,
    meta_only: Boolean(input.metaOnly),
  });
  if (!listed.ok) return { chats, messages };

  const knownContacts = await loadKnownContactIndex(input.coachId);

  const byThread = new Map<string, Array<Record<string, unknown>>>();
  for (const email of listed.data?.items ?? []) {
    const id = String(email.id || "");
    if (!id) continue;
    const role = String(email.role || "").toLowerCase();
    if (role === "trash" || role === "spam" || role === "drafts") continue;
    const key = emailThreadKey(
      (email.thread_id as string) || null,
      id
    );
    const list = byThread.get(key) ?? [];
    list.push(email);
    byThread.set(key, list);
  }

  for (const [threadKey, emails] of byThread) {
    emails.sort((a, b) => {
      const da = new Date(String(a.date || 0)).getTime();
      const db = new Date(String(b.date || 0)).getTime();
      return da - db;
    });
    const latest = emails[emails.length - 1];
    const from = latest.from_attendee as
      | { display_name?: string; identifier?: string }
      | undefined;
    const to0 = (latest.to_attendees as Array<{ identifier?: string }>)?.[0];
    const role = String(latest.role || "").toLowerCase();
    const isSent = role === "sent" || Boolean(latest.is_sender);
    const prospectEmail = isSent
      ? to0?.identifier || null
      : from?.identifier || null;
    const prospectName =
      (isSent ? to0?.identifier : from?.display_name || from?.identifier) ||
      "Email";
    const subject = String(latest.subject || "Email").slice(0, 200);

    let conversationId: string | null = null;
    const { data: existingConv } = await supabaseAdmin
      .from("messaging_conversations")
      .select("id, contact_id")
      .eq("coach_id", input.coachId)
      .eq("unipile_chat_id", threadKey)
      .maybeSingle();

    const known = matchKnownContact(knownContacts, { email: prospectEmail });
    const linkedContactId =
      (existingConv?.contact_id as string | null) || known?.id || null;
    if (!linkedContactId) {
      // Only sync mail with known CRM contacts.
      continue;
    }

    chats += 1;

    if (existingConv?.id) {
      conversationId = existingConv.id as string;
      await supabaseAdmin
        .from("messaging_conversations")
        .update({
          contact_id: linkedContactId,
          prospect_email: prospectEmail || known?.email || undefined,
          prospect_name: known?.full_name || undefined,
        })
        .eq("id", conversationId);
    } else {
      const { data: created } = await supabaseAdmin
        .from("messaging_conversations")
        .insert({
          coach_id: input.coachId,
          contact_id: linkedContactId,
          prospect_name:
            known?.full_name || String(prospectName).slice(0, 200),
          prospect_email: prospectEmail || known?.email || null,
          subject,
          unipile_chat_id: threadKey,
          unipile_account_id: input.unipileAccountId,
          last_channel: "email",
          last_message_at:
            (latest.date as string) || new Date().toISOString(),
          last_preview: previewOf(
            (latest.body_plain as string) ||
              (latest.subject as string) ||
              ""
          ),
        })
        .select("id")
        .maybeSingle();
      conversationId = (created?.id as string) ?? null;
    }
    if (!conversationId) continue;

    let latestAt: string | null = null;
    let latestPreview: string | null = null;
    let latestDirection: "inbound" | "outbound" | null = null;

    for (const email of emails) {
      const messageId = String(email.id || "");
      if (!messageId) continue;
      const text =
        (email.body_plain as string) ||
        String(email.subject || "") ||
        "";
      const emailRole = String(email.role || "").toLowerCase();
      const direction =
        emailRole === "sent" || Boolean(email.is_sender)
          ? "outbound"
          : "inbound";
      const createdAt =
        (email.date as string) || new Date().toISOString();

      const ok = await upsertChatMessage({
        conversationId,
        coachId: input.coachId,
        channel: "email",
        messageId,
        text,
        direction,
        createdAt,
        metadata: {
          thread_id: email.thread_id,
          provider_id: email.provider_id,
          subject: email.subject,
        },
      });
      if (ok) messages += 1;

      if (!latestAt || new Date(createdAt) >= new Date(latestAt)) {
        latestAt = createdAt;
        latestPreview = previewOf(text);
        latestDirection = direction;
      }
    }

    if (latestAt) {
      await supabaseAdmin
        .from("messaging_conversations")
        .update({
          ...conversationActivityPatch({
            lastChannel: "email",
            lastDirection: latestDirection || "inbound",
            lastMessageAt: latestAt,
            lastPreview: latestPreview,
          }),
          subject,
          prospect_email: prospectEmail || undefined,
          prospect_name: String(prospectName).slice(0, 200),
        })
        .eq("id", conversationId);
    }
  }

  return { chats, messages };
}

/**
 * Pull Unipile chats (LI/WA/IG/Messenger) and emails (Gmail/Outlook) into
 * messaging_* for this coach.
 */
export async function syncUnipileInboxForCoach(
  coachId: string,
  options?: { force?: boolean; minIntervalMs?: number }
): Promise<{
  chats: number;
  messages: number;
  skipped?: boolean;
  reason?: string;
  last_synced_at?: string | null;
}> {
  const { data: accounts } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select("id, unipile_account_id, provider, last_synced_at")
    .eq("coach_id", coachId)
    .eq("status", "OK");

  if (!accounts?.length) {
    return {
      chats: 0,
      messages: 0,
      skipped: true,
      reason: "no_account",
      last_synced_at: null,
    };
  }

  const lastSyncedAt = accounts.reduce<string | null>((latest, row) => {
    const at = row.last_synced_at as string | null;
    if (!at) return latest;
    if (!latest || new Date(at) > new Date(latest)) return at;
    return latest;
  }, null);

  const minIntervalMs =
    options?.minIntervalMs ??
    (options?.force ? 60_000 : UNIPILE_INBOX_SOFT_SYNC_MS);
  if (
    lastSyncedAt &&
    Date.now() - new Date(lastSyncedAt).getTime() < minIntervalMs
  ) {
    const { data: genericRows } = await supabaseAdmin
      .from("messaging_conversations")
      .select("id, last_channel, prospect_name")
      .eq("coach_id", coachId)
      .in("last_channel", ["linkedin", "whatsapp", "instagram", "messenger"])
      .limit(40);
    const needsIdentity = (genericRows ?? []).some((row) =>
      isGenericConversationName(
        row.prospect_name as string | null,
        row.last_channel as string | null
      )
    );
    if (needsIdentity) {
      let chats = 0;
      for (const account of accounts) {
        const provider = normalizeUnipileProvider(account.provider as string);
        if (!isMessagingProvider(provider)) continue;
        const result = await syncMessagingAccount({
          coachId,
          unipileAccountId: account.unipile_account_id as string,
          channel: providerToAppChannel(provider),
          includeMessages: false,
        });
        chats += result.chats;
      }
      return {
        chats,
        messages: 0,
        skipped: true,
        reason: "cooldown",
        last_synced_at: lastSyncedAt,
      };
    }
    return {
      chats: 0,
      messages: 0,
      skipped: true,
      reason: "cooldown",
      last_synced_at: lastSyncedAt,
    };
  }

  let chats = 0;
  let messages = 0;
  const force = Boolean(options?.force);
  // Soft page-open: refresh chat metadata + only pull messages for chats that
  // look newer/unread. Force/cron: full message history for listed chats.
  const softVisit = !force;

  for (const account of accounts) {
    const provider = normalizeUnipileProvider(account.provider as string);
    let result = { chats: 0, messages: 0 };
    if (isMailingProvider(provider)) {
      result = await syncMailingAccount({
        coachId,
        unipileAccountId: account.unipile_account_id as string,
        metaOnly: softVisit,
      });
    } else if (isMessagingProvider(provider)) {
      result = await syncMessagingAccount({
        coachId,
        unipileAccountId: account.unipile_account_id as string,
        channel: providerToAppChannel(provider),
        includeMessages: true,
        messagesOnlyIfStale: softVisit,
        maxLinkedInPairResolves: softVisit ? 3 : undefined,
      });
    }
    chats += result.chats;
    messages += result.messages;

    await supabaseAdmin
      .from("linkedin_outreach_accounts")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", account.id);
  }

  return { chats, messages, last_synced_at: new Date().toISOString() };
}

/** @deprecated Alias — multi-channel sync. */
export async function syncLinkedInInboxForCoach(
  coachId: string,
  options?: { force?: boolean; minIntervalMs?: number }
) {
  return syncUnipileInboxForCoach(coachId, options);
}

export async function replyUnipileConversation(input: {
  coachId: string;
  conversationId: string;
  text: string;
  channel?: string;
  /** Force a specific Unipile mailbox/chat account (e.g. Gmail vs Outlook). */
  accountId?: string | null;
  attachments?: Array<{ blob: Blob; filename: string; mime?: string }>;
  voiceMessage?: { blob: Blob; filename: string; mime?: string };
  videoMessage?: { blob: Blob; filename: string; mime?: string };
  /** Already-uploaded storage refs (e.g. scheduled send). Skips re-upload. */
  attachmentMeta?: Array<{
    path: string;
    mime: string;
    size: number;
    filename: string;
    kind?: "file" | "voice" | "video";
  }>;
}) {
  const text = input.text.trim();
  const rawAttachments = input.attachments ?? [];
  const existingMeta = input.attachmentMeta ?? [];
  const hasVoice = Boolean(input.voiceMessage);
  const hasVideo = Boolean(input.videoMessage);
  if (
    !text &&
    rawAttachments.length === 0 &&
    existingMeta.length === 0 &&
    !hasVoice &&
    !hasVideo
  ) {
    throw new Error("Message is empty.");
  }

  const { data: conv } = await supabaseAdmin
    .from("messaging_conversations")
    .select(
      "id, coach_id, unipile_chat_id, unipile_account_id, contact_id, prospect_email, prospect_phone, prospect_linkedin_url, subject, last_channel"
    )
    .eq("id", input.conversationId)
    .eq("coach_id", input.coachId)
    .maybeSingle();
  if (!conv) throw new Error("Conversation not found.");

  const channel = (
    input.channel ||
    conv.last_channel ||
    "linkedin"
  ).toLowerCase() as UnipileAppChannel;

  if (channel === "email") {
    if (rawAttachments.length || existingMeta.length || hasVoice || hasVideo) {
      throw new Error("Email attachments are not supported yet.");
    }
    if (!text) throw new Error("Message is empty.");
    const preferredAccountId = input.accountId?.trim() || null;
    if (
      preferredAccountId &&
      preferredAccountId !== conv.unipile_account_id
    ) {
      conv.unipile_account_id = preferredAccountId;
      await supabaseAdmin
        .from("messaging_conversations")
        .update({ unipile_account_id: preferredAccountId })
        .eq("id", conv.id);
    }
    if (!conv.unipile_account_id) {
      const accountId = await resolveAccountIdForChannel(input.coachId, "email");
      if (accountId) {
        conv.unipile_account_id = accountId;
        await supabaseAdmin
          .from("messaging_conversations")
          .update({ unipile_account_id: accountId })
          .eq("id", conv.id);
      }
    }
    if (!conv.unipile_account_id) {
      throw new Error("This conversation is not linked to a connected mailbox.");
    }
    const to = (conv.prospect_email || "").trim();
    if (!to) throw new Error("No recipient email on this conversation.");

    const { data: lastMsg } = await supabaseAdmin
      .from("messaging_messages")
      .select("unipile_message_id, metadata")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const replyTo =
      (lastMsg?.unipile_message_id as string) ||
      ((lastMsg?.metadata as { provider_id?: string } | null)?.provider_id) ||
      undefined;

    const res = await sendUnipileEmail({
      account_id: conv.unipile_account_id as string,
      to: [{ identifier: to }],
      subject: conv.subject
        ? conv.subject.startsWith("Re:")
          ? conv.subject
          : `Re: ${conv.subject}`
        : undefined,
      body: text.replace(/\n/g, "<br/>"),
      reply_to: replyTo,
    });
    if (!res.ok) throw new Error(res.error || "Email send failed.");

    const { data: msg, error } = await supabaseAdmin
      .from("messaging_messages")
      .insert({
        conversation_id: conv.id,
        coach_id: input.coachId,
        channel: "email",
        direction: "outbound",
        status: "accepted",
        body_text: text,
        unipile_message_id: res.data?.tracking_id ?? null,
        metadata: {
          provider_id: res.data?.provider_id,
          via: "unipile",
          account_id: conv.unipile_account_id,
        },
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("messaging_conversations")
      .update({
        ...conversationActivityPatch({
          lastChannel: "email",
          lastDirection: "outbound",
          lastMessageAt: new Date().toISOString(),
          lastPreview: previewOf(text),
        }),
        unipile_account_id: conv.unipile_account_id,
      })
      .eq("id", conv.id);

    return msg;
  }

  if (!conv.unipile_chat_id) {
    if (rawAttachments.length || existingMeta.length || hasVoice || hasVideo) {
      throw new Error(
        "Send the first message as text. You can attach files on the next one."
      );
    }
    if (!text) throw new Error("Message is empty.");
    const started = await startFirstUnipileMessage({
      coachId: input.coachId,
      conversationId: conv.id as string,
      channel,
      text,
      contactId: (conv.contact_id as string | null) ?? null,
      prospectPhone: (conv.prospect_phone as string | null) ?? null,
      prospectLinkedInUrl:
        (conv.prospect_linkedin_url as string | null) ?? null,
      unipileAccountId: (conv.unipile_account_id as string | null) ?? null,
    });
    conv.unipile_chat_id = started.chatId;
    conv.unipile_account_id = started.accountId;

    const { data: firstMsg, error: firstErr } = await supabaseAdmin
      .from("messaging_messages")
      .insert({
        conversation_id: conv.id,
        coach_id: input.coachId,
        channel,
        direction: "outbound",
        status: "accepted",
        body_text: text,
        unipile_message_id: started.messageId,
        metadata: { chat_id: started.chatId, via: "unipile_start" },
      })
      .select("*")
      .maybeSingle();
    if (firstErr) throw new Error(firstErr.message);

    await supabaseAdmin
      .from("messaging_conversations")
      .update({
        ...conversationActivityPatch({
          lastChannel: channel,
          lastDirection: "outbound",
          lastMessageAt: new Date().toISOString(),
          lastPreview: previewOf(text),
        }),
      })
      .eq("id", conv.id);

    return firstMsg;
  }

  const attachmentMeta: MessagingAttachmentMeta[] = [];
  const unipileFiles: Array<{ blob: Blob; filename: string }> = [];
  let voicePayload: { blob: Blob; filename: string } | undefined;
  let videoPayload: { blob: Blob; filename: string } | undefined;

  if (existingMeta.length) {
    for (const meta of existingMeta) {
      attachmentMeta.push(meta);
      const [file] = await downloadMessagingAttachments([meta]);
      if (!file) continue;
      if (meta.kind === "voice" || meta.mime.startsWith("audio/")) {
        voicePayload = file;
      } else if (meta.kind === "video" || meta.mime.startsWith("video/")) {
        // LinkedIn uses video_message; WhatsApp prefers attachments.
        if (channel === "whatsapp") {
          unipileFiles.push(file);
        } else {
          videoPayload = file;
        }
      } else {
        unipileFiles.push(file);
      }
    }
  } else {
    for (const file of rawAttachments) {
      const meta = await uploadMessagingAttachment({
        coachId: input.coachId,
        conversationId: conv.id as string,
        blob: file.blob,
        filename: file.filename,
        mime: file.mime || file.blob.type || "application/octet-stream",
        kind: "file",
      });
      attachmentMeta.push(meta);
      unipileFiles.push({ blob: file.blob, filename: meta.filename });
    }
    if (input.voiceMessage) {
      const meta = await uploadMessagingAttachment({
        coachId: input.coachId,
        conversationId: conv.id as string,
        blob: input.voiceMessage.blob,
        filename: input.voiceMessage.filename,
        mime:
          input.voiceMessage.mime ||
          input.voiceMessage.blob.type ||
          "audio/webm",
        kind: "voice",
      });
      attachmentMeta.push(meta);
      voicePayload = {
        blob: input.voiceMessage.blob,
        filename: meta.filename,
      };
    }
    if (input.videoMessage) {
      const meta = await uploadMessagingAttachment({
        coachId: input.coachId,
        conversationId: conv.id as string,
        blob: input.videoMessage.blob,
        filename: input.videoMessage.filename,
        mime:
          input.videoMessage.mime ||
          input.videoMessage.blob.type ||
          "video/mp4",
        kind: "video",
      });
      attachmentMeta.push(meta);
      if (channel === "whatsapp") {
        unipileFiles.push({
          blob: input.videoMessage.blob,
          filename: meta.filename,
        });
      } else {
        videoPayload = {
          blob: input.videoMessage.blob,
          filename: meta.filename,
        };
      }
    }
  }

  const res = await sendUnipileChatMessage({
    chat_id: conv.unipile_chat_id as string,
    text: text || undefined,
    account_id: (conv.unipile_account_id as string) || undefined,
    attachments: unipileFiles.length ? unipileFiles : undefined,
    voice_message: voicePayload,
    video_message: videoPayload,
  });
  if (!res.ok) {
    if (res.status === 415) {
      throw new Error(
        res.error ||
          "That media type isn’t supported on this channel. Try an image, PDF, or shorter voice note."
      );
    }
    throw new Error(res.error || "Send failed.");
  }

  const voiceOrVideo = attachmentMeta.find(
    (a) => a.kind === "voice" || a.kind === "video"
  );
  const preview =
    previewOf(text) ||
    (voiceOrVideo?.kind === "voice"
      ? "🎤 Voice note"
      : voiceOrVideo?.kind === "video"
        ? "🎬 Video"
        : attachmentMeta[0]
          ? `📎 ${attachmentMeta[0].filename}`
          : "Attachment");

  const { data: msg, error } = await supabaseAdmin
    .from("messaging_messages")
    .insert({
      conversation_id: conv.id,
      coach_id: input.coachId,
      channel,
      direction: "outbound",
      status: "accepted",
      body_text: text || null,
      unipile_message_id: res.data?.message_id ?? null,
      metadata: {
        chat_id: conv.unipile_chat_id,
        ...(attachmentMeta.length ? { attachments: attachmentMeta } : {}),
      },
    })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from("messaging_conversations")
    .update({
      ...conversationActivityPatch({
        lastChannel: channel,
        lastDirection: "outbound",
        lastMessageAt: new Date().toISOString(),
        lastPreview: preview,
      }),
    })
    .eq("id", conv.id);

  return msg;
}

export async function replyLinkedInConversation(input: {
  coachId: string;
  conversationId: string;
  text: string;
}) {
  return replyUnipileConversation({ ...input, channel: "linkedin" });
}
