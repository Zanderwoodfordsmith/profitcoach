import { emailNeedsBodyFetch, unipileEmailBodyText } from "@/lib/messaging/emailBody";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getUnipileEmail } from "@/lib/unipile/client";

const MAX_HYDRATE_PER_THREAD = 8;

function subjectOf(message: Record<string, unknown>): string {
  const column = typeof message.subject === "string" ? message.subject : "";
  const metadata = message.metadata;
  const fromMeta =
    metadata &&
    typeof metadata === "object" &&
    typeof (metadata as { subject?: unknown }).subject === "string"
      ? (metadata as { subject: string }).subject
      : "";
  return (column || fromMeta).trim();
}

/**
 * Fill subject-only email rows from Unipile when a thread is opened.
 * Confirmed-empty mail (calendar RSVPs) is marked resolved so sync stops
 * spending its body-fetch budget on them.
 */
export async function hydratePlaceholderEmailBodies(input: {
  conversationId: string;
  messages: Record<string, unknown>[];
}): Promise<void> {
  const pending = input.messages.filter(
    (message) =>
      String(message.channel || "").toLowerCase() === "email" &&
      emailNeedsBodyFetch({
        bodyText: typeof message.body_text === "string" ? message.body_text : null,
        subject: subjectOf(message),
        metadata: message.metadata,
      })
  );
  if (!pending.length) return;

  const ids = pending
    .map((message) => String(message.id || ""))
    .filter(Boolean)
    .slice(0, MAX_HYDRATE_PER_THREAD);
  if (!ids.length) return;

  const [{ data: conversation }, { data: rows }] = await Promise.all([
    supabaseAdmin
      .from("messaging_conversations")
      .select("unipile_account_id")
      .eq("id", input.conversationId)
      .maybeSingle(),
    supabaseAdmin
      .from("messaging_messages")
      .select("id, unipile_message_id, metadata, body_text")
      .in("id", ids),
  ]);
  const accountId =
    (conversation?.unipile_account_id as string | null | undefined) ?? null;
  if (!accountId) return;

  const byId = new Map(
    (rows ?? []).map((row) => [String(row.id), row])
  );

  for (const message of pending) {
    const row = byId.get(String(message.id || ""));
    const emailId = String(row?.unipile_message_id || "").trim();
    if (!row || !emailId) continue;
    const full = await getUnipileEmail(emailId, accountId);
    if (!full.ok || !full.data) {
      if (full.status !== 404) continue;
      const metadata =
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : {};
      const nextMeta = { ...metadata, body_resolved: true };
      await supabaseAdmin
        .from("messaging_messages")
        .update({ metadata: nextMeta })
        .eq("id", row.id);
      message.metadata = nextMeta;
      continue;
    }
    const text = unipileEmailBodyText(full.data);
    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {};
    if (!text) {
      const nextMeta = { ...metadata, body_resolved: true };
      await supabaseAdmin
        .from("messaging_messages")
        .update({ metadata: nextMeta })
        .eq("id", row.id);
      message.metadata = nextMeta;
      continue;
    }
    await supabaseAdmin
      .from("messaging_messages")
      .update({ body_text: text })
      .eq("id", row.id);
    message.body_text = text;
  }
}
