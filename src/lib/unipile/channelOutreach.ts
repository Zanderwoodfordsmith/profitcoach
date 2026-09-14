import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { selectContactsWithOptionalPhone } from "@/lib/contactsSchemaSafeSelect";
import {
  commentUnipilePost,
  followUnipileUser,
  listUnipileUserPosts,
  reactUnipilePost,
  resolveUnipileUser,
  sendUnipileChatMessage,
  sendUnipileEmail,
  sendUnipileInvitation,
  startUnipileChat,
} from "@/lib/unipile/client";
import { unpackEmailBody } from "@/lib/unipile/playbookSteps";
import { facebookProfileIdentifier } from "@/lib/unipile/facebookIdentity";
import { instagramUsername } from "@/lib/unipile/instagramIdentity";
import { resolveAccountIdForChannel } from "@/lib/messaging/startConversation";
import type { UnipileAppChannel } from "@/lib/unipile/providers";
import {
  mergeSocialUrls,
  socialUrlsFromUnknown,
  type SocialUrlFields,
} from "@/lib/unipile/socialUrls";

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Lead is missing the contact detail this channel needs — skip the step, don't fail the lead. */
export class MissingChannelContactError extends Error {
  readonly channel: "email" | "whatsapp";
  constructor(channel: "email" | "whatsapp", message: string) {
    super(message);
    this.name = "MissingChannelContactError";
    this.channel = channel;
  }
}

export function isMissingChannelContactError(
  err: unknown
): err is MissingChannelContactError {
  return err instanceof MissingChannelContactError;
}

async function loadContactSocialUrls(
  coachId: string,
  contactId: string | null
): Promise<SocialUrlFields> {
  if (!contactId) return { instagram_url: null, facebook_url: null };
  const { data } = await selectContactsWithOptionalPhone<{
    instagram_url: string | null;
    facebook_url: string | null;
  }>(
    async (columns) =>
      supabaseAdmin
        .from("contacts")
        .select(columns)
        .eq("id", contactId)
        .eq("coach_id", coachId),
    "id",
    ["instagram_url", "facebook_url"]
  );
  const row = data[0];
  return {
    instagram_url: asString(row?.instagram_url) ,
    facebook_url: asString(row?.facebook_url),
  };
}

async function existingChatId(
  coachId: string,
  contactId: string | null,
  channel: UnipileAppChannel
): Promise<string | null> {
  if (!contactId) return null;
  const { data } = await supabaseAdmin
    .from("messaging_conversations")
    .select("unipile_chat_id")
    .eq("coach_id", coachId)
    .eq("contact_id", contactId)
    .eq("last_channel", channel)
    .not("unipile_chat_id", "is", null)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return asString(data?.unipile_chat_id);
}

function profileField(
  data: Record<string, unknown>,
  key: string
): string | null {
  return asString(data[key]);
}

async function resolveInstagramIds(input: {
  accountId: string;
  username: string;
}): Promise<{
  username: string;
  providerId: string;
  messagingId: string;
}> {
  const resolved = await resolveUnipileUser(input.username, input.accountId);
  if (!resolved.ok || !resolved.data) {
    throw new Error(resolved.error || "Could not find that Instagram profile.");
  }
  const data = resolved.data as Record<string, unknown>;
  const providerId =
    profileField(data, "provider_id") || profileField(data, "id");
  const messagingId =
    profileField(data, "provider_messaging_id") ||
    profileField(data, "messaging_identifier") ||
    providerId;
  const username =
    profileField(data, "public_identifier") || input.username;
  if (!providerId || !messagingId) {
    throw new Error("Instagram profile is missing a messaging id.");
  }
  return { username, providerId, messagingId };
}

async function resolveMessengerAttendee(input: {
  accountId: string;
  identifier: string;
}): Promise<string> {
  const resolved = await resolveUnipileUser(input.identifier, input.accountId);
  if (resolved.ok && resolved.data) {
    const data = resolved.data as Record<string, unknown>;
    const id =
      profileField(data, "provider_id") ||
      profileField(data, "provider_messaging_id") ||
      profileField(data, "id") ||
      profileField(data, "public_identifier");
    if (id) return id;
  }
  return input.identifier;
}

function instagramPostId(post: Record<string, unknown> | undefined): string | null {
  if (!post) return null;
  return (
    profileField(post, "provider_id") ||
    profileField(post, "id") ||
    profileField(post, "social_id")
  );
}

export async function sendCampaignChannelMessage(input: {
  coachId: string;
  channel: "instagram" | "messenger";
  lead: {
    id: string;
    contact_id?: string | null;
    unipile_chat_id?: string | null;
    metadata?: Record<string, unknown> | null;
  };
  text: string;
}): Promise<{ chatId: string | null; messageId: string | null }> {
  const text = input.text.trim();
  if (!text) throw new Error("Empty message body.");

  const accountId = await resolveAccountIdForChannel(input.coachId, input.channel);
  if (!accountId) {
    throw new Error(
      input.channel === "instagram"
        ? "Connect Instagram in Settings before this step can send."
        : "Connect Facebook Messenger in Settings before this step can send."
    );
  }

  const meta = { ...(input.lead.metadata ?? {}) };
  const fromMeta = socialUrlsFromUnknown(meta);
  const fromContact = await loadContactSocialUrls(
    input.coachId,
    input.lead.contact_id ?? null
  );
  const socials = mergeSocialUrls(fromMeta, fromContact);

  const storedChat =
    (input.channel === "instagram"
      ? asString(meta.instagram_chat_id)
      : asString(meta.messenger_chat_id)) ||
    (await existingChatId(
      input.coachId,
      input.lead.contact_id ?? null,
      input.channel
    ));

  let chatId = storedChat;
  if (chatId) {
    const sent = await sendUnipileChatMessage({
      chat_id: chatId,
      account_id: accountId,
      text,
    });
    if (!sent.ok) throw new Error(sent.error || "Send message failed");
    return { chatId, messageId: sent.data?.message_id ?? null };
  }

  let attendeeId: string | null = null;
  if (input.channel === "instagram") {
    const username = instagramUsername(socials.instagram_url);
    if (!username) {
      throw new Error("This person needs an Instagram profile URL.");
    }
    const ids = await resolveInstagramIds({ accountId, username });
    attendeeId = ids.messagingId;
    Object.assign(meta, {
      instagram_url: socials.instagram_url,
      instagram_username: ids.username,
      instagram_messaging_id: ids.messagingId,
    });
  } else {
    const stored = asString(meta.facebook_provider_id);
    const identifier =
      stored || facebookProfileIdentifier(socials.facebook_url);
    if (!identifier) {
      throw new Error("This person needs a Facebook profile URL.");
    }
    attendeeId = await resolveMessengerAttendee({
      accountId,
      identifier,
    });
    Object.assign(meta, {
      facebook_url: socials.facebook_url,
      facebook_provider_id: attendeeId,
    });
  }

  const started = await startUnipileChat({
    account_id: accountId,
    attendees_ids: [attendeeId],
    text,
  });
  if (!started.ok) throw new Error(started.error || "Start chat failed");
  chatId = started.data?.chat_id ?? null;
  if (chatId) {
    if (input.channel === "instagram") meta.instagram_chat_id = chatId;
    else meta.messenger_chat_id = chatId;
  }
  await patchLeadMeta(input.lead.id, meta);
  return { chatId, messageId: started.data?.message_id ?? null };
}

export async function engageInstagramLatestPost(input: {
  coachId: string;
  lead: {
    id: string;
    contact_id?: string | null;
    metadata?: Record<string, unknown> | null;
  };
  mode: "react" | "comment";
  text?: string;
}): Promise<string> {
  const accountId = await resolveAccountIdForChannel(input.coachId, "instagram");
  if (!accountId) {
    throw new Error("Connect Instagram in Settings before this step can send.");
  }
  const meta = input.lead.metadata ?? {};
  const socials = mergeSocialUrls(
    socialUrlsFromUnknown(meta),
    await loadContactSocialUrls(input.coachId, input.lead.contact_id ?? null)
  );
  const username = instagramUsername(
    asString(meta.instagram_username) || socials.instagram_url
  );
  if (!username) {
    throw new Error("This person needs an Instagram profile URL.");
  }
  const ids = await resolveInstagramIds({ accountId, username });
  const posts = await listUnipileUserPosts({
    identifier: ids.username,
    account_id: accountId,
    limit: 5,
  });
  if (!posts.ok) throw new Error(posts.error || "Could not list Instagram posts.");
  const first = (posts.data?.items ?? [])[0] as Record<string, unknown> | undefined;
  const postId = instagramPostId(first);
  if (!postId) throw new Error("They have no recent Instagram posts to engage with.");

  if (input.mode === "react") {
    const res = await reactUnipilePost({
      account_id: accountId,
      post_id: postId,
      reaction_type: "like",
    });
    if (!res.ok) throw new Error(res.error || "Instagram like failed");
    return postId;
  }

  const text = (input.text ?? "").trim();
  if (!text) throw new Error("Empty comment body.");
  const res = await commentUnipilePost({
    post_id: postId,
    account_id: accountId,
    text,
  });
  if (!res.ok) throw new Error(res.error || "Instagram comment failed");
  return res.data?.comment_id ?? postId;
}

export async function followInstagramUser(input: {
  coachId: string;
  lead: {
    id: string;
    contact_id?: string | null;
    metadata?: Record<string, unknown> | null;
  };
}): Promise<string> {
  const accountId = await resolveAccountIdForChannel(input.coachId, "instagram");
  if (!accountId) {
    throw new Error("Connect Instagram in Settings before this step can send.");
  }
  const meta = input.lead.metadata ?? {};
  const socials = mergeSocialUrls(
    socialUrlsFromUnknown(meta),
    await loadContactSocialUrls(input.coachId, input.lead.contact_id ?? null)
  );
  const username = instagramUsername(
    asString(meta.instagram_username) || socials.instagram_url
  );
  if (!username) {
    throw new Error("This person needs an Instagram profile URL.");
  }
  const ids = await resolveInstagramIds({ accountId, username });
  const res = await sendUnipileInvitation({
    account_id: accountId,
    provider_id: ids.providerId,
  });
  if (!res.ok) {
    const already =
      String(res.error || "").includes("already") ||
      (res.raw as { type?: string } | undefined)?.type ===
        "errors/action_already_performed";
    if (already) return ids.providerId;
    throw new Error(res.error || "Instagram follow failed");
  }
  await patchLeadMeta(input.lead.id, {
    ...meta,
    instagram_url: socials.instagram_url,
    instagram_username: ids.username,
  });
  return res.data?.invitation_id ?? ids.providerId;
}

export async function sendCampaignEmail(input: {
  coachId: string;
  lead: {
    id: string;
    contact_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  };
  packedBody: string;
}): Promise<string | null> {
  const accountId = await resolveAccountIdForChannel(input.coachId, "email");
  if (!accountId) {
    throw new Error("Connect Gmail or Outlook in Settings before this step can send.");
  }
  if (!input.lead.contact_id) {
    throw new MissingChannelContactError(
      "email",
      "This person needs to be saved as a prospect with an email."
    );
  }
  const { data } = await selectContactsWithOptionalPhone<{
    email: string | null;
    full_name: string | null;
  }>(
    async (columns) =>
      supabaseAdmin
        .from("contacts")
        .select(columns)
        .eq("id", input.lead.contact_id)
        .eq("coach_id", input.coachId),
    "id, email, full_name",
    []
  );
  const email = asString(data[0]?.email);
  if (!email) {
    throw new MissingChannelContactError(
      "email",
      "This person needs an email address."
    );
  }
  const unpacked = unpackEmailBody(input.packedBody);
  const displayName =
    [input.lead.first_name, input.lead.last_name].filter(Boolean).join(" ") ||
    asString(data[0]?.full_name) ||
    undefined;
  const sent = await sendUnipileEmail({
    account_id: accountId,
    to: [{ identifier: email, display_name: displayName }],
    subject: unpacked.subject,
    body: unpacked.body,
  });
  if (!sent.ok) throw new Error(sent.error || "Email send failed");
  return sent.data?.tracking_id ?? sent.data?.provider_id ?? email;
}

export async function sendCampaignWhatsApp(input: {
  coachId: string;
  lead: {
    id: string;
    contact_id?: string | null;
    unipile_chat_id?: string | null;
    metadata?: Record<string, unknown> | null;
  };
  text: string;
}): Promise<{ chatId: string | null; messageId: string | null }> {
  const text = input.text.trim();
  if (!text) throw new Error("Empty WhatsApp body.");
  const accountId = await resolveAccountIdForChannel(input.coachId, "whatsapp");
  if (!accountId) {
    throw new Error("Connect WhatsApp in Settings before this step can send.");
  }
  const storedChat =
    asString(input.lead.metadata?.whatsapp_chat_id) ||
    (await existingChatId(input.coachId, input.lead.contact_id ?? null, "whatsapp"));
  if (storedChat) {
    const sent = await sendUnipileChatMessage({
      chat_id: storedChat,
      account_id: accountId,
      text,
    });
    if (!sent.ok) throw new Error(sent.error || "WhatsApp send failed");
    return { chatId: storedChat, messageId: sent.data?.message_id ?? null };
  }
  if (!input.lead.contact_id) {
    throw new MissingChannelContactError(
      "whatsapp",
      "This person needs a phone number on their prospect record."
    );
  }
  const { data } = await selectContactsWithOptionalPhone<{
    phone: string | null;
  }>(
    async (columns) =>
      supabaseAdmin
        .from("contacts")
        .select(columns)
        .eq("id", input.lead.contact_id)
        .eq("coach_id", input.coachId),
    "id",
    ["phone"]
  );
  const phone = asString(data[0]?.phone);
  if (!phone) {
    throw new MissingChannelContactError(
      "whatsapp",
      "This person needs a phone number."
    );
  }
  const started = await startUnipileChat({
    account_id: accountId,
    attendees_ids: [phone],
    text,
  });
  if (!started.ok) throw new Error(started.error || "WhatsApp send failed");
  const chatId = started.data?.chat_id ?? null;
  if (chatId) {
    await patchLeadMeta(input.lead.id, {
      ...(input.lead.metadata ?? {}),
      whatsapp_chat_id: chatId,
    });
  }
  return { chatId, messageId: started.data?.message_id ?? null };
}

export async function followLinkedInUser(input: {
  accountId: string;
  identifier: string;
}): Promise<string> {
  const res = await followUnipileUser({
    account_id: input.accountId,
    identifier: input.identifier,
  });
  if (!res.ok) {
    const already =
      String(res.error || "").includes("already") ||
      (res.raw as { type?: string } | undefined)?.type ===
        "errors/action_already_performed";
    if (already) return input.identifier;
    throw new Error(res.error || "LinkedIn follow failed");
  }
  return res.data?.invitation_id ?? input.identifier;
}

async function patchLeadMeta(
  leadId: string,
  metadata: Record<string, unknown>
) {
  await supabaseAdmin
    .from("linkedin_campaign_leads")
    .update({ metadata })
    .eq("id", leadId);
}
