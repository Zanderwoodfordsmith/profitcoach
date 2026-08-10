import {
  birdAddressEmails,
  birdGetInboundBody,
  birdGetInboundMessage,
  birdListInboundMessages,
  isBirdConfigured,
  parseConversationIdFromAddress,
  type BirdInboundMessageMeta,
} from "@/lib/bird/client";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function fromEmailOf(meta: BirdInboundMessageMeta): string | null {
  const emails = birdAddressEmails(meta.from);
  return emails[0] || null;
}

function displayFrom(meta: BirdInboundMessageMeta): string {
  const from = meta.from;
  if (!from) return fromEmailOf(meta) || "unknown";
  if (typeof from === "string") return from;
  if (from.name && from.email) return `${from.name} <${from.email}>`;
  return from.email || from.name || "unknown";
}

async function findConversationId(
  meta: BirdInboundMessageMeta
): Promise<string | null> {
  const recipients = [
    ...birdAddressEmails(meta.to),
    ...birdAddressEmails(meta.cc),
  ];
  for (const addr of recipients) {
    const id = parseConversationIdFromAddress(addr);
    if (id) {
      const { data } = await supabaseAdmin
        .from("messaging_conversations")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      if (data?.id) return data.id as string;
    }
  }

  const from = fromEmailOf(meta);
  if (from) {
    const { data } = await supabaseAdmin
      .from("messaging_conversations")
      .select("id")
      .ilike("prospect_email", from)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  return null;
}

/**
 * Ingest one Bird inbound email into messaging_* tables.
 * Dedupes on bird_message_id.
 */
export async function ingestBirdInboundMessage(
  inboundId: string
): Promise<{
  ok: boolean;
  skipped?: boolean;
  conversationId?: string;
  messageId?: string;
  error?: string;
}> {
  if (!isBirdConfigured()) {
    return { ok: false, error: "Bird not configured." };
  }

  const { data: existing } = await supabaseAdmin
    .from("messaging_messages")
    .select("id, conversation_id")
    .eq("bird_message_id", inboundId)
    .maybeSingle();
  if (existing?.id) {
    return {
      ok: true,
      skipped: true,
      conversationId: existing.conversation_id as string,
      messageId: existing.id as string,
    };
  }

  const got = await birdGetInboundMessage(inboundId);
  if (!got.ok || !got.meta) {
    return { ok: false, error: got.error || "Could not load inbound message." };
  }
  const meta = got.meta;

  const conversationId = await findConversationId(meta);
  if (!conversationId) {
    return {
      ok: false,
      error: `No conversation matched inbound ${inboundId} from ${fromEmailOf(meta) || "?"}.`,
    };
  }

  const { data: conversation } = await supabaseAdmin
    .from("messaging_conversations")
    .select("id, coach_id, unread_count")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation) {
    return { ok: false, error: "Conversation missing." };
  }

  const body = await birdGetInboundBody(inboundId);
  const text =
    (body.text || "").trim() ||
    (body.html
      ? body.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : "") ||
    "(empty)";
  const preview = text.replace(/\s+/g, " ").trim().slice(0, 160);
  const toAddrs = birdAddressEmails(meta.to);
  const unread =
    typeof conversation.unread_count === "number"
      ? conversation.unread_count
      : 0;

  const { data: msg, error } = await supabaseAdmin
    .from("messaging_messages")
    .insert({
      conversation_id: conversationId,
      coach_id: conversation.coach_id,
      channel: "email",
      direction: "inbound",
      status: "received",
      subject: meta.subject || null,
      body_text: text,
      body_html: body.html || null,
      from_address: displayFrom(meta),
      to_address: toAddrs[0] || null,
      bird_message_id: inboundId,
      metadata: {
        kind: "inbound_email",
        message_id: meta.message_id || null,
        in_reply_to: meta.in_reply_to || null,
        authentication: meta.authentication || null,
        raw_meta: meta,
      },
    })
    .select("id")
    .maybeSingle();

  if (error || !msg?.id) {
    // Race: another worker inserted the same bird id.
    if (error?.code === "23505") {
      return { ok: true, skipped: true, conversationId };
    }
    console.error("inbound message insert:", error);
    return { ok: false, error: error?.message || "Insert failed." };
  }

  await supabaseAdmin
    .from("messaging_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_preview: preview || meta.subject || null,
      last_channel: "email",
      unread_count: unread + 1,
      ...(meta.subject ? { subject: meta.subject } : {}),
    })
    .eq("id", conversationId);

  return { ok: true, conversationId, messageId: msg.id as string };
}

/** Poll Bird for recent inbound mail and ingest any new ones. */
export async function processRecentBirdInbound(limit = 25): Promise<{
  scanned: number;
  ingested: number;
  skipped: number;
  errors: number;
}> {
  if (!isBirdConfigured()) {
    return { scanned: 0, ingested: 0, skipped: 0, errors: 0 };
  }

  const listed = await birdListInboundMessages(limit);
  if (!listed.ok) {
    console.error("processRecentBirdInbound list:", listed.error);
    return { scanned: 0, ingested: 0, skipped: 0, errors: 1 };
  }

  let ingested = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of listed.messages) {
    if (!item.id) continue;
    const result = await ingestBirdInboundMessage(item.id);
    if (result.ok && result.skipped) skipped += 1;
    else if (result.ok) ingested += 1;
    else {
      errors += 1;
      console.warn("inbound ingest:", result.error);
    }
  }

  return {
    scanned: listed.messages.length,
    ingested,
    skipped,
    errors,
  };
}
