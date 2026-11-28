import { after } from "next/server";
import { conversationActivityPatch } from "@/lib/messaging/conversationActivity";
import { unipileEmailBodyText } from "@/lib/messaging/emailBody";
import { getUnipileEmail, unipileFetch } from "@/lib/unipile/client";
import { linkedInPublicIdentifier } from "@/lib/unipile/linkedinUrl";
import {
  extractReactionEmoji,
  formatReactionPreview,
  isUnipileReactionEvent,
  normalizeReactions,
  parseUnipileMessageFlags,
} from "@/lib/messaging/messageReactions";
import {
  applyReactionToParentMessage,
} from "@/lib/messaging/messageReactionsStore";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { advanceLeadAfterInviteAccepted } from "@/lib/unipile/worker";
import {
  identityFromUnipileWebhook,
} from "@/lib/unipile/chatCounterpart";
import {
  isGenericConversationName,
  looksLikePersonName,
  personNameFromDisplayName,
} from "@/lib/messaging/conversationDisplay";
import { mailboxPersonName } from "@/lib/messaging/threadIdentity";
import {
  allowPersonalChannelIngest,
} from "@/lib/messaging/knownContacts";
import {
  normalizeUnipileProvider,
  providerToAppChannel,
  type UnipileAppChannel,
} from "@/lib/unipile/providers";
import {
  phoneDigitsFromWhatsAppJid,
  whatsAppChatPhone,
} from "@/lib/unipile/whatsappIdentity";
import { markContactRepliedOnInbound } from "@/lib/prospects/markContactReplied";

function previewOf(text: string | null | undefined) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  return t.slice(0, 160);
}

/**
 * Throw before the conversation's last_message_at is bumped: a fresh-looking
 * thread with no stored message makes soft sync skip the pull that would fix it.
 * The webhook route returns 500 so Unipile retries.
 */
function throwIfMessageInsertFailed(
  error: { code?: string; message: string } | null
) {
  if (!error || error.code === "23505") return;
  throw new Error(`messaging_messages insert failed: ${error.message}`);
}

async function findExistingMailConversation(opts: {
  coachId: string;
  accountId: string;
  threadKey: string;
  emailId: string;
  prospectEmail: string | null;
}): Promise<{ id: string; contact_id: string | null } | null> {
  const { data: byThread } = await supabaseAdmin
    .from("messaging_conversations")
    .select("id, contact_id")
    .eq("coach_id", opts.coachId)
    .eq("unipile_chat_id", opts.threadKey)
    .maybeSingle();
  if (byThread?.id) {
    return {
      id: byThread.id as string,
      contact_id: (byThread.contact_id as string | null) ?? null,
    };
  }

  const { data: byMsg } = await supabaseAdmin
    .from("messaging_messages")
    .select("conversation_id")
    .eq("coach_id", opts.coachId)
    .eq("unipile_message_id", opts.emailId)
    .maybeSingle();
  if (byMsg?.conversation_id) {
    const { data: conv } = await supabaseAdmin
      .from("messaging_conversations")
      .select("id, contact_id")
      .eq("id", byMsg.conversation_id)
      .maybeSingle();
    if (conv?.id) {
      return {
        id: conv.id as string,
        contact_id: (conv.contact_id as string | null) ?? null,
      };
    }
  }

  const email = opts.prospectEmail?.trim().toLowerCase();
  if (!email) return null;

  const emailCandidates = Array.from(
    new Set(
      [email, opts.prospectEmail?.trim()].filter(
        (value): value is string => Boolean(value)
      )
    )
  );

  for (const candidate of emailCandidates) {
    const { data: byBooking } = await supabaseAdmin
      .from("messaging_conversations")
      .select("id, contact_id")
      .eq("coach_id", opts.coachId)
      .eq("prospect_email", candidate)
      .not("booking_id", "is", null)
      .is("unipile_chat_id", null)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byBooking?.id) {
      return {
        id: byBooking.id as string,
        contact_id: (byBooking.contact_id as string | null) ?? null,
      };
    }
  }

  const { data: waiting } = await supabaseAdmin
    .from("messaging_conversations")
    .select("id, contact_id")
    .eq("coach_id", opts.coachId)
    .eq("unipile_account_id", opts.accountId)
    .eq("prospect_email", email)
    .is("unipile_chat_id", null)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (waiting?.id) {
    return {
      id: waiting.id as string,
      contact_id: (waiting.contact_id as string | null) ?? null,
    };
  }

  return null;
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

  const matched = await findLeadForNewRelation(coachId, { providerId, publicId, profileUrl });
  if (!matched) return "no_lead";

  await advanceLeadAfterInviteAccepted({
    lead: matched,
    campaignId: matched.campaign_id as string,
    coachId,
    providerId: providerId || (matched.linkedin_provider_id as string) || null,
  });
  return `advanced:${matched.id}`;
}

/**
 * The coach's person waiting on this invite. Looked up directly: a coach can
 * have thousands waiting (Sales Robot imports), so scanning a page misses most.
 * The same person can sit in several campaigns: the running one wins.
 */
export async function findLeadForNewRelation(
  coachId: string,
  who: { providerId: string; publicId: string; profileUrl: string }
) {
  const open = () =>
    supabaseAdmin
      .from("linkedin_campaign_leads")
      .select(
        "id, campaign_id, coach_id, status, current_step_position, linkedin_provider_id, linkedin_url, invitation_id"
      )
      .eq("coach_id", coachId)
      .in("status", ["invited", "queued"]);

  let found: Array<Record<string, unknown> & { campaign_id: string }> = [];
  if (who.providerId) {
    const { data } = await open().eq("linkedin_provider_id", who.providerId).limit(50);
    found = data ?? [];
  }
  const slugs = [
    ...new Set(
      [who.publicId, linkedInPublicIdentifier(who.profileUrl)]
        .map((s) => (s || "").trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  for (const slug of slugs) {
    if (found.length) break;
    const { data } = await open()
      .ilike("linkedin_url", `%/in/${encodeURIComponent(slug)}%`)
      .limit(50);
    found = (data ?? []).filter(
      (l) => linkedInPublicIdentifier(String(l.linkedin_url ?? ""))?.toLowerCase() === slug
    );
  }
  if (found.length < 2) return found[0] ?? null;

  const { data: running } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id")
    .in("id", [...new Set(found.map((l) => l.campaign_id))])
    .eq("status", "running");
  const runningIds = new Set((running ?? []).map((r) => r.id as string));
  return found.find((l) => runningIds.has(l.campaign_id)) ?? found[0];
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
  const prospectName =
    personNameFromDisplayName(identity.name) ||
    identity.name ||
    "Unknown contact";
  // WhatsApp: the other person's number comes from the chat, never from the
  // message. A message's sender or attendees can be the coach (their own
  // messages, groups), which once saved personal chats under the coach's
  // own number. Groups have no number and stop here: nothing is stored.
  let waPhone: string | null = null;
  if (channel === "whatsapp") {
    const chat = await unipileFetch<Record<string, unknown>>(
      "GET",
      `/api/v1/chats/${encodeURIComponent(chatId)}`
    );
    if (!chat.ok || !chat.data) {
      if (chat.status === 404) return "chat_not_found";
      // Throw so the webhook returns 500 and Unipile retries.
      throw new Error(`whatsapp chat lookup failed (${chat.status})`);
    }
    waPhone = whatsAppChatPhone(chat.data);
    if (!waPhone) return "not_one_to_one";
  }

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
    ownPhones: [
      phoneDigitsFromWhatsAppJid(
        String((body.account_info as Record<string, unknown> | undefined)?.user_id || "")
      ),
    ],
  });
  if (!gate.allowed) return "unknown_contact";
  // WhatsApp threads take the prospect's name; the coach's own message
  // must not put the coach's photo on the thread.
  const nameForThread =
    (channel === "whatsapp" ? gate.contact?.full_name : null) || prospectName;
  const pictureForThread =
    channel === "whatsapp" && isSender ? null : identity.pictureUrl;

  if (existingConv?.id) {
    conversationId = existingConv.id as string;
  } else {
    const { data: created } = await supabaseAdmin
      .from("messaging_conversations")
      .insert({
        coach_id: coachId,
        contact_id: gate.contact?.id ?? null,
        prospect_name: gate.contact?.full_name || nameForThread,
        prospect_email: identity.email || gate.contact?.email || null,
        prospect_phone: waPhone
          ? `+${waPhone}`
          : gate.contact?.phone || null,
        prospect_avatar_url: pictureForThread,
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
      const { error: reactionInsertError } = await supabaseAdmin
        .from("messaging_messages")
        .upsert(
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
      throwIfMessageInsertFailed(reactionInsertError);
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
      identityUpdate.prospect_name = nameForThread.slice(0, 200);
    }
    if (pictureForThread && !existingConv?.prospect_avatar_url) {
      identityUpdate.prospect_avatar_url = pictureForThread;
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
    const { error: messageInsertError } = await supabaseAdmin
      .from("messaging_messages")
      .upsert(
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
    throwIfMessageInsertFailed(messageInsertError);
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
    identityUpdate.prospect_name = nameForThread.slice(0, 200);
  }
  if (pictureForThread && !existingConv?.prospect_avatar_url) {
    identityUpdate.prospect_avatar_url = pictureForThread;
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

    let { data: lead } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("id, campaign_id, contact_id")
      .eq("coach_id", coachId)
      .eq("unipile_chat_id", chatId)
      .maybeSingle();

    // A chat that starts when someone accepts an invite has no chat id on the
    // lead yet. Match by their LinkedIn id and save the chat id, or the reply
    // is missed (the hourly sync then skips the chat as already up to date).
    if (!lead && channel !== "whatsapp" && identity.providerId) {
      const { data: byProvider } = await supabaseAdmin
        .from("linkedin_campaign_leads")
        .select("id, campaign_id, contact_id")
        .eq("coach_id", coachId)
        .eq("linkedin_provider_id", identity.providerId)
        .order("updated_at", { ascending: false })
        .limit(1)
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

    if (lead?.id) {
      // Any reply stops that person's automatic follow-ups (28 Nov rule).
      if (lead.campaign_id) {
        const { data: updated } = await supabaseAdmin
          .from("linkedin_campaign_leads")
          .update({ status: "replied", next_action_at: null })
          .eq("id", lead.id)
          .neq("status", "replied")
          .select("first_name, last_name")
          .maybeSingle();
        const { cancelOpenSendJobs } = await import("@/lib/unipile/remindQueue");
        await cancelOpenSendJobs(lead.id as string, "Lead replied");
        if (updated) {
          const { fireCoachWatchRulesSafe } = await import(
            "@/lib/coachWatch/fire"
          );
          fireCoachWatchRulesSafe({
            coachId,
            scopeKind: "campaign",
            scopeId: String(lead.campaign_id),
            event: "replied",
            personName: [updated.first_name, updated.last_name]
              .filter(Boolean)
              .join(" "),
          });
        }
      }
    }

    await markContactRepliedOnInbound({
      coachId,
      contactId:
        gate.contact?.id ||
        (existingConv?.contact_id as string | null) ||
        (lead?.contact_id as string | null) ||
        null,
    });
  }

  if (!isSender && channel === "linkedin" && text) {
    scheduleAvaTriage(coachId, conversationId);
  }

  return `message:${conversationId}`;
}

/**
 * Run Ava (classify, draft, alert, maybe autopilot) straight after the webhook
 * responds, so alerts land within seconds instead of at the next inbox sync.
 */
function scheduleAvaTriage(coachId: string, conversationId: string): void {
  const run = async () => {
    const { triageLatestInbound } = await import("@/lib/ava/replyAlert");
    await triageLatestInbound({ coachId, conversationId }).catch((err) => {
      console.error("ava triage (webhook):", err instanceof Error ? err.message : err);
    });
  };
  try {
    after(run);
  } catch {
    // Outside a request (scripts, tests): run it without waiting.
    void run();
  }
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
  const to0 = (
    body.to_attendees as Array<{ identifier?: string; display_name?: string }>
  )?.[0];
  const role = String(body.role || "").toLowerCase();
  const isSent = role === "sent" || String(body.origin || "") === "unipile";
  let text = unipileEmailBodyText(body);
  let bodyResolved = false;
  if (!text) {
    const full = await getUnipileEmail(emailId, accountId);
    if (full.ok && full.data) {
      text = unipileEmailBodyText(full.data);
      bodyResolved = !text;
    } else if (!full.ok && full.status === 404) {
      bodyResolved = true;
    }
  }
  if (!text) text = String(body.subject || "").trim();
  const subject = String(body.subject || "Email").slice(0, 200);
  const prospectEmail = isSent
    ? to0?.identifier || null
    : from?.identifier || null;
  const headerName = mailboxPersonName({
    isSent,
    fromName: from?.display_name,
    toName: to0?.display_name,
  });

  let conversationId: string | null = null;
  const existingConv = await findExistingMailConversation({
    coachId,
    accountId,
    threadKey,
    emailId,
    prospectEmail,
  });

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
          (looksLikePersonName(gate.contact?.full_name)
            ? gate.contact?.full_name
            : null) ||
          headerName ||
          (prospectEmail ? String(prospectEmail).slice(0, 200) : "Email"),
        prospect_email: (prospectEmail || gate.contact?.email || null)
          ?.trim()
          .toLowerCase() || null,
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

  const { error: mailInsertError } = await supabaseAdmin
    .from("messaging_messages")
    .upsert(
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
          ...(bodyResolved ? { body_resolved: true } : {}),
        },
      },
      { onConflict: "unipile_message_id", ignoreDuplicates: true }
    );
  throwIfMessageInsertFailed(mailInsertError);

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
      unipile_chat_id: threadKey,
      unipile_account_id: accountId,
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

    await markContactRepliedOnInbound({
      coachId,
      contactId:
        gate.contact?.id ||
        (existingConv?.contact_id as string | null) ||
        null,
    });
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
