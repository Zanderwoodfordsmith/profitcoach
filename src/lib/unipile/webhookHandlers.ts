import { conversationActivityPatch } from "@/lib/messaging/conversationActivity";
import {
  applyReactionToParentMessage,
  extractReactionEmoji,
  formatReactionPreview,
  isUnipileReactionEvent,
  normalizeReactions,
  parseUnipileMessageFlags,
} from "@/lib/messaging/messageReactions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { advanceLeadAfterInviteAccepted } from "@/lib/unipile/worker";
import {
  identityFromUnipileWebhook,
} from "@/lib/unipile/chatCounterpart";
import {
  isGenericConversationName,
} from "@/lib/messaging/conversationDisplay";
import {
  allowPersonalChannelIngest,
} from "@/lib/messaging/knownContacts";
import {
  normalizeUnipileProvider,
  providerToAppChannel,
  type UnipileAppChannel,
} from "@/lib/unipile/providers";
import { whatsappPhoneDigits } from "@/lib/unipile/whatsappIdentity";

function previewOf(text: string | null | undefined) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  return t.slice(0, 160);
}

async function accountForUnipileId(
  unipileAccountId: string | null | undefined
): Promise<{ coach_id: string; provider: string } | null> {
  if (!unipileAccountId) return null;
  const { data } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select("coach_id, provider")
    .eq("unipile_account_id", unipileAccountId)
    .maybeSingle();
  if (!data?.coach_id) return null;
  return {
    coach_id: data.coach_id as string,
    provider: normalizeUnipileProvider(data.provider as string),
  };
}

async function coachIdForUnipileAccount(
  unipileAccountId: string | null | undefined
): Promise<string | null> {
  const row = await accountForUnipileId(unipileAccountId);
  return row?.coach_id ?? null;
}

/** Invite accepted → mark lead connected and advance past invite (starts wait / next message). */
export async function handleUnipileNewRelation(
  body: Record<string, unknown>
): Promise<string> {
  const accountId = String(body.account_id || "").trim();
  const providerId = String(
    body.user_provider_id || body.provider_id || ""
  ).trim();
  const publicId = String(body.user_public_identifier || "").trim();
  const profileUrl = String(body.user_profile_url || "").trim();

  const coachId = await coachIdForUnipileAccount(accountId);
  if (!coachId) return "no_account";

  const { data: candidates } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select(
      "id, campaign_id, coach_id, status, current_step_position, linkedin_provider_id, linkedin_url, invitation_id"
    )
    .eq("coach_id", coachId)
    .in("status", ["invited", "queued"])
    .limit(200);
  const leads = candidates ?? [];

  const matched =
    leads.find(
      (l) =>
        providerId &&
        l.linkedin_provider_id &&
        l.linkedin_provider_id === providerId
    ) ||
    leads.find((l) => {
      if (!publicId || !l.linkedin_url) return false;
      return l.linkedin_url.toLowerCase().includes(publicId.toLowerCase());
    }) ||
    leads.find((l) => {
      if (!profileUrl || !l.linkedin_url) return false;
      return (
        l.linkedin_url.replace(/\/$/, "").toLowerCase() ===
        profileUrl.replace(/\/$/, "").toLowerCase()
      );
    });

  if (!matched) return "no_lead";

  if (matched.status === "invited" || matched.status === "queued") {
    await advanceLeadAfterInviteAccepted({
      lead: matched,
      campaignId: matched.campaign_id as string,
      coachId,
      providerId: providerId || (matched.linkedin_provider_id as string) || null,
    });
    return `advanced:${matched.id}`;
  }

  return "already_handled";
}

/** Inbound DM → messaging tables + stop campaign on reply. */
export async function handleUnipileMessageReceived(
  body: Record<string, unknown>
): Promise<string> {
  const accountId = String(body.account_id || "").trim();
  const chatId = String(body.chat_id || "").trim();
  const messageId = String(body.message_id || body.id || "").trim();
  const text = String(body.message || body.text || body.body || "").trim();
  const isSender = Boolean(body.is_sender);
  const account = await accountForUnipileId(accountId);
  if (!account || !chatId) return "missing_ids";
  const coachId = account.coach_id;
  const channel: UnipileAppChannel = providerToAppChannel(
    String(body.account_type || account.provider)
  );
  const identity = identityFromUnipileWebhook(body, channel);
  const prospectName = identity.name || "Unknown contact";
  const waPhone =
    channel === "whatsapp"
      ? whatsappPhoneDigits({
          phoneNumber: identity.phone,
          providerId: identity.providerId,
          profileUrl: identity.profileUrl,
          name: identity.name,
        })
      : null;

  let conversationId: string | null = null;
  const { data: existingConv } = await supabaseAdmin
    .from("messaging_conversations")
    .select(
      "id, prospect_name, prospect_avatar_url, prospect_linkedin_url, contact_id"
    )
    .eq("coach_id", coachId)
    .eq("unipile_chat_id", chatId)
    .maybeSingle();

  const gate = await allowPersonalChannelIngest({
    coachId,
    channel,
    email: identity.email,
    phone: waPhone,
    existingContactId: (existingConv?.contact_id as string | null) ?? null,
  });
  if (!gate.allowed) return "unknown_contact";

  if (existingConv?.id) {
    conversationId = existingConv.id as string;
  } else {
    const { data: created } = await supabaseAdmin
      .from("messaging_conversations")
      .insert({
        coach_id: coachId,
        contact_id: gate.contact?.id ?? null,
        prospect_name: gate.contact?.full_name || prospectName,
        prospect_email: identity.email || gate.contact?.email || null,
        prospect_phone: waPhone
          ? `+${waPhone}`
          : gate.contact?.phone || null,
        prospect_avatar_url: identity.pictureUrl,
        prospect_linkedin_url:
          channel === "whatsapp" ? null : identity.profileUrl,
        subject: identity.occupation || null,
        unipile_chat_id: chatId,
        unipile_account_id: accountId || null,
        ...conversationActivityPatch({
          lastChannel: channel,
          lastDirection: isSender ? "outbound" : "inbound",
          lastMessageAt: new Date().toISOString(),
          lastPreview: previewOf(text),
        }),
        unread_count: isSender ? 0 : 1,
      })
      .select("id")
      .maybeSingle();
    conversationId = (created?.id as string) ?? null;
  }
  if (!conversationId) return "no_conversation";

  if (gate.contact?.id && !existingConv?.contact_id) {
    await supabaseAdmin
      .from("messaging_conversations")
      .update({ contact_id: gate.contact.id })
      .eq("id", conversationId);
  }

  const flags = parseUnipileMessageFlags(body);
  const reactionEvent = isUnipileReactionEvent(flags);
  // Dedicated reaction webhooks put the emoji in `reaction` and parent in message_id.
  const dedicatedReaction =
    Boolean(body.reaction) &&
    (String(body.event || "")
      .toLowerCase()
      .includes("reaction") ||
      Boolean(body.reaction_sender));

  if (reactionEvent || dedicatedReaction) {
    const emoji = dedicatedReaction
      ? String(body.reaction || "").trim() || extractReactionEmoji(text)
      : extractReactionEmoji(text);
    const parentId =
      flags.parentId ||
      (dedicatedReaction
        ? String(body.message_id || body.id || "").trim()
        : "") ||
      null;
    const eventMessageId = dedicatedReaction
      ? String(body.event_id || body.reaction_id || `${parentId}:${emoji}`).trim()
      : messageId;

    let attached = false;
    if (parentId) {
      attached = await applyReactionToParentMessage({
        conversationId,
        parentUnipileMessageId: parentId,
        reaction: {
          value: emoji,
          sender_id: String(
            body.reaction_sender || body.sender_id || ""
          ).trim() || undefined,
          is_sender: isSender,
        },
      });
    }

    if (!attached && eventMessageId) {
      await supabaseAdmin.from("messaging_messages").upsert(
        {
          conversation_id: conversationId,
          coach_id: coachId,
          channel,
          direction: isSender ? "outbound" : "inbound",
          status: "delivered",
          body_text: formatReactionPreview(emoji, { isSender }),
          unipile_message_id: eventMessageId,
          metadata: {
            chat_id: chatId,
            webhook: true,
            kind: "reaction_event",
            is_event: true,
            event_type: flags.eventType,
            parent_unipile_message_id: parentId,
            reaction: emoji,
            hidden: true,
          },
        },
        { onConflict: "unipile_message_id", ignoreDuplicates: true }
      );
    }

    const identityUpdate: Record<string, unknown> = {
      ...conversationActivityPatch({
        lastChannel: channel,
        lastDirection: isSender ? "outbound" : "inbound",
        lastMessageAt: new Date().toISOString(),
        lastPreview: formatReactionPreview(emoji, { isSender }),
      }),
    };
    if (
      identity.name &&
      (!existingConv?.prospect_name ||
        isGenericConversationName(
          existingConv.prospect_name as string | null,
          channel
        ))
    ) {
      identityUpdate.prospect_name = identity.name.slice(0, 200);
    }
    if (identity.pictureUrl && !existingConv?.prospect_avatar_url) {
      identityUpdate.prospect_avatar_url = identity.pictureUrl;
    }
    await supabaseAdmin
      .from("messaging_conversations")
      .update(identityUpdate)
      .eq("id", conversationId);
    return attached ? "reaction_attached" : "reaction_event";
  }

  const inboundReactions = normalizeReactions(
    body.reactions || flags.reactions
  );

  if (messageId) {
    await supabaseAdmin.from("messaging_messages").upsert(
      {
        conversation_id: conversationId,
        coach_id: coachId,
        channel,
        direction: isSender ? "outbound" : "inbound",
        status: "delivered",
        body_text: text,
        unipile_message_id: messageId,
        metadata: {
          chat_id: chatId,
          webhook: true,
          ...(inboundReactions.length ? { reactions: inboundReactions } : {}),
        },
      },
      { onConflict: "unipile_message_id", ignoreDuplicates: true }
    );
  }

  const identityUpdate: Record<string, unknown> = {
    ...conversationActivityPatch({
      lastChannel: channel,
      lastDirection: isSender ? "outbound" : "inbound",
      lastMessageAt: new Date().toISOString(),
      lastPreview: previewOf(text),
    }),
  };
  if (
    identity.name &&
    (!existingConv?.prospect_name ||
      isGenericConversationName(
        existingConv.prospect_name as string | null,
        channel
      ))
  ) {
    identityUpdate.prospect_name = identity.name.slice(0, 200);
  }
  if (identity.pictureUrl && !existingConv?.prospect_avatar_url) {
    identityUpdate.prospect_avatar_url = identity.pictureUrl;
  }
  if (channel === "whatsapp") {
    if (waPhone) identityUpdate.prospect_phone = `+${waPhone}`;
    // Never keep WhatsApp JIDs masquerading as LinkedIn URLs.
    identityUpdate.prospect_linkedin_url = null;
    identityUpdate.prospect_linkedin_provider_id = null;
  } else {
    if (identity.profileUrl && !existingConv?.prospect_linkedin_url) {
      identityUpdate.prospect_linkedin_url = identity.profileUrl;
    }
    if (identity.providerId) {
      identityUpdate.prospect_linkedin_provider_id = identity.providerId;
    }
  }
  if (identity.occupation && !existingConv?.id) {
    identityUpdate.subject = identity.occupation.slice(0, 200);
  }

  await supabaseAdmin
    .from("messaging_conversations")
    .update(identityUpdate)
    .eq("id", conversationId);

  if (!isSender) {
    const { data: conv } = await supabaseAdmin
      .from("messaging_conversations")
      .select("unread_count")
      .eq("id", conversationId)
      .maybeSingle();
    await supabaseAdmin
      .from("messaging_conversations")
      .update({ unread_count: (conv?.unread_count ?? 0) + 1 })
      .eq("id", conversationId);

    const { data: lead } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("id, campaign_id")
      .eq("coach_id", coachId)
      .eq("unipile_chat_id", chatId)
      .maybeSingle();

    if (lead?.id) {
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

  return `message:${conversationId}`;
}

function emailThreadKey(threadId: string | null | undefined, emailId: string) {
  const tid = (threadId || "").trim();
  if (tid) return `email_thread:${tid}`;
  return `email:${emailId}`;
}

/** Gmail / Outlook inbound (and outbound mirror) via Unipile email webhooks. */
export async function handleUnipileMailReceived(
  body: Record<string, unknown>
): Promise<string> {
  const accountId = String(body.account_id || "").trim();
  const emailId = String(
    body.email_id || body.id || body.deprecated_id || ""
  ).trim();

  // Defense in depth: Support mailbox must never write Conversations.
  try {
    const { platformAccountForUnipileId, handleSupportMailReceived } =
      await import("@/lib/support/mailbox");
    const support = await platformAccountForUnipileId(accountId);
    if (support?.purpose === "support") {
      return handleSupportMailReceived(body);
    }
  } catch {
    /* continue to CRM path */
  }

  const account = await accountForUnipileId(accountId);
  if (!account || !emailId) return "missing_ids";
  const coachId = account.coach_id;

  const threadKey = emailThreadKey(
    (body.thread_id as string) || null,
    emailId
  );
  const from = body.from_attendee as
    | { display_name?: string; identifier?: string }
    | undefined;
  const to0 = (body.to_attendees as Array<{ identifier?: string }>)?.[0];
  const role = String(body.role || "").toLowerCase();
  const isSent = role === "sent" || String(body.origin || "") === "unipile";
  const text =
    String(body.body_plain || "").trim() ||
    String(body.subject || "").trim();
  const subject = String(body.subject || "Email").slice(0, 200);
  const prospectEmail = isSent
    ? to0?.identifier || null
    : from?.identifier || null;
  const prospectName =
    (isSent ? to0?.identifier : from?.display_name || from?.identifier) ||
    "Email";

  let conversationId: string | null = null;
  const { data: existingConv } = await supabaseAdmin
    .from("messaging_conversations")
    .select("id, contact_id")
    .eq("coach_id", coachId)
    .eq("unipile_chat_id", threadKey)
    .maybeSingle();

  const gate = await allowPersonalChannelIngest({
    coachId,
    channel: "email",
    email: prospectEmail,
    existingContactId: (existingConv?.contact_id as string | null) ?? null,
  });
  if (!gate.allowed) return "unknown_contact";

  if (existingConv?.id) {
    conversationId = existingConv.id as string;
  } else {
    const { data: created } = await supabaseAdmin
      .from("messaging_conversations")
      .insert({
        coach_id: coachId,
        contact_id: gate.contact?.id ?? null,
        prospect_name:
          gate.contact?.full_name || String(prospectName).slice(0, 200),
        prospect_email: prospectEmail || gate.contact?.email || null,
        subject,
        unipile_chat_id: threadKey,
        unipile_account_id: accountId,
        ...conversationActivityPatch({
          lastChannel: "email",
          lastDirection: isSent ? "outbound" : "inbound",
          lastMessageAt: String(body.date || "") || new Date().toISOString(),
          lastPreview: previewOf(text),
        }),
        unread_count: isSent ? 0 : 1,
      })
      .select("id")
      .maybeSingle();
    conversationId = (created?.id as string) ?? null;
  }
  if (!conversationId) return "no_conversation";

  if (gate.contact?.id && !existingConv?.contact_id) {
    await supabaseAdmin
      .from("messaging_conversations")
      .update({ contact_id: gate.contact.id })
      .eq("id", conversationId);
  }

  await supabaseAdmin.from("messaging_messages").upsert(
    {
      conversation_id: conversationId,
      coach_id: coachId,
      channel: "email",
      direction: isSent ? "outbound" : "inbound",
      status: "delivered",
      body_text: text,
      subject,
      unipile_message_id: emailId,
      metadata: {
        thread_id: body.thread_id,
        provider_id: body.provider_id,
        webhook: true,
      },
    },
    { onConflict: "unipile_message_id", ignoreDuplicates: true }
  );

  await supabaseAdmin
    .from("messaging_conversations")
    .update({
      ...conversationActivityPatch({
        lastChannel: "email",
        lastDirection: isSent ? "outbound" : "inbound",
        lastMessageAt: String(body.date || "") || new Date().toISOString(),
        lastPreview: previewOf(text),
      }),
      subject,
      prospect_email: prospectEmail || undefined,
    })
    .eq("id", conversationId);

  if (!isSent) {
    const { data: conv } = await supabaseAdmin
      .from("messaging_conversations")
      .select("unread_count")
      .eq("id", conversationId)
      .maybeSingle();
    await supabaseAdmin
      .from("messaging_conversations")
      .update({ unread_count: (conv?.unread_count ?? 0) + 1 })
      .eq("id", conversationId);
  }

  return `mail:${conversationId}`;
}

export async function handleUnipileAccountStatusEvent(
  body: Record<string, unknown>
): Promise<string> {
  const accountId = String(
    body.account_id || body.AccountId || body.id || ""
  ).trim();
  if (!accountId) return "no_account_id";

  const event = String(body.event || body.status || body.AccountStatus || "")
    .trim()
    .toUpperCase();

  let status = "OK";
  if (
    ["ERROR", "CREDENTIALS", "PERMISSIONS", "STOPPED", "DELETED"].includes(
      event
    )
  ) {
    status = event === "DELETED" ? "STOPPED" : event;
  } else if (
    ["OK", "CREATION_SUCCESS", "RECONNECTED", "SYNC_SUCCESS"].includes(event)
  ) {
    status = "OK";
  } else if (event === "CONNECTING") {
    status = "CONNECTING";
  }

  await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .update({
      status,
      last_synced_at: new Date().toISOString(),
    })
    .eq("unipile_account_id", accountId);

  // Also update dedicated Support mailbox row when present (no CRM side effects).
  try {
    const { updatePlatformAccountStatus } = await import(
      "@/lib/support/mailbox"
    );
    await updatePlatformAccountStatus(accountId, status);
  } catch {
    /* ignore — table may not exist yet during deploy */
  }

  if (status !== "OK") {
    const { data: accounts } = await supabaseAdmin
      .from("linkedin_outreach_accounts")
      .select("id, coach_id, provider")
      .eq("unipile_account_id", accountId);
    for (const acc of accounts ?? []) {
      if (normalizeUnipileProvider(acc.provider as string) !== "LINKEDIN") {
        continue;
      }
      await supabaseAdmin
        .from("linkedin_campaigns")
        .update({ status: "paused" })
        .eq("coach_id", acc.coach_id)
        .eq("outreach_account_id", acc.id)
        .eq("status", "running");
    }
  }

  return `status:${status}`;
}
