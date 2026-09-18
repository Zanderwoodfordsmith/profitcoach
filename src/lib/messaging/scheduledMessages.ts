import {
  MAX_MESSAGING_ATTACHMENTS,
  parseMessagingAttachments,
  signMessagingAttachments,
  type MessagingAttachmentMeta,
} from "@/lib/messaging/messageAttachments";
import { replyUnipileConversation } from "@/lib/unipile/inboxSync";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type MessagingScheduledMessageRow = {
  id: string;
  conversation_id: string;
  coach_id: string;
  channel: string;
  body_text: string | null;
  attachments: MessagingAttachmentMeta[];
  scheduled_for: string;
  status: string;
  attempts: number;
  last_error: string | null;
};

export async function scheduleMessagingReply(input: {
  conversationId: string;
  coachId: string;
  channel: string;
  bodyText: string;
  scheduledFor: string;
  attachments: MessagingAttachmentMeta[];
}) {
  if (input.attachments.length > MAX_MESSAGING_ATTACHMENTS) {
    throw new Error(
      `You can attach at most ${MAX_MESSAGING_ATTACHMENTS} files.`
    );
  }
  const when = new Date(input.scheduledFor);
  if (Number.isNaN(when.getTime())) {
    throw new Error("Invalid schedule time.");
  }
  if (when.getTime() < Date.now() + 60_000) {
    throw new Error("Schedule at least one minute in the future.");
  }

  const { data, error } = await supabaseAdmin
    .from("messaging_scheduled_messages")
    .insert({
      conversation_id: input.conversationId,
      coach_id: input.coachId,
      channel: input.channel,
      body_text: input.bodyText || null,
      attachments: input.attachments,
      scheduled_for: when.toISOString(),
      status: "scheduled",
    })
    .select(
      "id, conversation_id, coach_id, channel, body_text, attachments, scheduled_for, status, attempts, last_error, created_at"
    )
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message || "Could not schedule message.");
  }
  return data;
}

export async function processDueScheduledMessages(limit = 20): Promise<{
  processed: number;
  sent: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}> {
  const now = new Date().toISOString();
  const { data: due, error } = await supabaseAdmin
    .from("messaging_scheduled_messages")
    .select(
      "id, conversation_id, coach_id, channel, body_text, attachments, scheduled_for, status, attempts, last_error"
    )
    .eq("status", "scheduled")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  let sent = 0;
  let failed = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const row of due ?? []) {
    const id = row.id as string;
    const { data: claimed } = await supabaseAdmin
      .from("messaging_scheduled_messages")
      .update({
        status: "sending",
        attempts: ((row.attempts as number) || 0) + 1,
      })
      .eq("id", id)
      .eq("status", "scheduled")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    try {
      const attachments = parseMessagingAttachments(row.attachments);
      const msg = await replyUnipileConversation({
        coachId: row.coach_id as string,
        conversationId: row.conversation_id as string,
        text: (row.body_text as string) || "",
        channel: row.channel as string,
        attachmentMeta: attachments,
      });

      await supabaseAdmin
        .from("messaging_scheduled_messages")
        .update({
          status: "sent",
          sent_message_id: msg?.id ?? null,
          last_error: null,
        })
        .eq("id", id);
      sent += 1;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Scheduled send failed.";
      await supabaseAdmin
        .from("messaging_scheduled_messages")
        .update({
          status: "failed",
          last_error: message.slice(0, 500),
        })
        .eq("id", id);
      failed += 1;
      errors.push({ id, error: message });
    }
  }

  return {
    processed: (due ?? []).length,
    sent,
    failed,
    errors,
  };
}

const SCHEDULED_SELECT =
  "id, conversation_id, coach_id, channel, body_text, attachments, scheduled_for, status, attempts, last_error, created_at";

export type MessagingScheduledMessagePublic = {
  id: string;
  conversation_id: string;
  channel: string;
  body_text: string | null;
  attachments: MessagingAttachmentMeta[];
  scheduled_for: string;
  status: string;
  last_error: string | null;
  created_at: string;
};

function asPublicRow(
  row: Record<string, unknown>,
  attachments: MessagingAttachmentMeta[]
): MessagingScheduledMessagePublic {
  return {
    id: String(row.id),
    conversation_id: String(row.conversation_id),
    channel: String(row.channel || ""),
    body_text: (row.body_text as string | null) ?? null,
    attachments,
    scheduled_for: String(row.scheduled_for),
    status: String(row.status || "scheduled"),
    last_error: (row.last_error as string | null) ?? null,
    created_at: String(row.created_at || row.scheduled_for),
  };
}

export async function listScheduledForConversation(input: {
  conversationId: string;
  coachId: string;
}): Promise<MessagingScheduledMessagePublic[]> {
  const { data, error } = await supabaseAdmin
    .from("messaging_scheduled_messages")
    .select(SCHEDULED_SELECT)
    .eq("conversation_id", input.conversationId)
    .eq("coach_id", input.coachId)
    .in("status", ["scheduled", "failed"])
    .order("scheduled_for", { ascending: true });
  if (error) throw new Error(error.message);

  return Promise.all(
    (data ?? []).map(async (row) => {
      const rec = row as Record<string, unknown>;
      const attachments = await signMessagingAttachments(
        parseMessagingAttachments(rec.attachments)
      );
      return asPublicRow(rec, attachments);
    })
  );
}

async function loadOwnedScheduled(input: {
  id: string;
  conversationId: string;
  coachId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("messaging_scheduled_messages")
    .select(SCHEDULED_SELECT)
    .eq("id", input.id)
    .eq("conversation_id", input.conversationId)
    .eq("coach_id", input.coachId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Record<string, unknown> | null;
}

export async function updateScheduledMessage(input: {
  id: string;
  conversationId: string;
  coachId: string;
  bodyText?: string;
  scheduledFor?: string;
}): Promise<MessagingScheduledMessagePublic> {
  const existing = await loadOwnedScheduled(input);
  if (!existing) throw new Error("Scheduled message not found.");
  const status = String(existing.status || "");
  if (status !== "scheduled" && status !== "failed") {
    throw new Error("Only upcoming scheduled messages can be edited.");
  }

  const patch: Record<string, unknown> = {};
  if (input.bodyText !== undefined) {
    patch.body_text = input.bodyText;
  }
  if (input.scheduledFor !== undefined) {
    const when = new Date(input.scheduledFor);
    if (Number.isNaN(when.getTime())) {
      throw new Error("Invalid schedule time.");
    }
    if (when.getTime() < Date.now() + 60_000) {
      throw new Error("Schedule at least one minute in the future.");
    }
    patch.scheduled_for = when.toISOString();
  }
  if (!Object.keys(patch).length) {
    const attachments = await signMessagingAttachments(
      parseMessagingAttachments(existing.attachments)
    );
    return asPublicRow(existing, attachments);
  }

  patch.status = "scheduled";
  patch.last_error = null;

  const { data, error } = await supabaseAdmin
    .from("messaging_scheduled_messages")
    .update(patch)
    .eq("id", input.id)
    .eq("conversation_id", input.conversationId)
    .select(SCHEDULED_SELECT)
    .maybeSingle();
  if (error || !data) {
    throw new Error(error?.message || "Could not update scheduled message.");
  }
  const rec = data as Record<string, unknown>;
  const attachments = await signMessagingAttachments(
    parseMessagingAttachments(rec.attachments)
  );
  return asPublicRow(rec, attachments);
}

export async function cancelScheduledMessage(input: {
  id: string;
  conversationId: string;
  coachId: string;
}): Promise<void> {
  const existing = await loadOwnedScheduled(input);
  if (!existing) throw new Error("Scheduled message not found.");
  const status = String(existing.status || "");
  if (status !== "scheduled" && status !== "failed") {
    throw new Error("Only upcoming scheduled messages can be deleted.");
  }
  const { error } = await supabaseAdmin
    .from("messaging_scheduled_messages")
    .update({ status: "cancelled" })
    .eq("id", input.id)
    .eq("conversation_id", input.conversationId);
  if (error) throw new Error(error.message);
}
