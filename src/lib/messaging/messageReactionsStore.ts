import {
  mergeReactions,
  normalizeReactions,
  type MessageReaction,
} from "@/lib/messaging/messageReactions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/* Server-side reaction writes, kept apart from the pure helpers in
   messageReactions.ts so the inbox doesn't bundle the admin client. */

/** Attach a reaction onto the parent message row (by Unipile message id). */
export async function applyReactionToParentMessage(input: {
  conversationId: string;
  parentUnipileMessageId: string;
  reaction: MessageReaction;
}): Promise<boolean> {
  const parentId = input.parentUnipileMessageId.trim();
  if (!parentId) return false;

  const { data: parent } = await supabaseAdmin
    .from("messaging_messages")
    .select("id, metadata")
    .eq("conversation_id", input.conversationId)
    .eq("unipile_message_id", parentId)
    .maybeSingle();

  if (!parent?.id) return false;

  const meta = (parent.metadata as Record<string, unknown> | null) || {};
  const next = mergeReactions(normalizeReactions(meta.reactions), [
    input.reaction,
  ]);
  await supabaseAdmin
    .from("messaging_messages")
    .update({ metadata: { ...meta, reactions: next } })
    .eq("id", parent.id);
  return true;
}

/** Patch reactions onto an existing message when Unipile returns reactions[]. */
export async function patchMessageReactionsByUnipileId(input: {
  conversationId: string;
  unipileMessageId: string;
  reactions: MessageReaction[];
}): Promise<void> {
  if (!input.reactions.length) return;
  const { data: row } = await supabaseAdmin
    .from("messaging_messages")
    .select("id, metadata")
    .eq("conversation_id", input.conversationId)
    .eq("unipile_message_id", input.unipileMessageId)
    .maybeSingle();
  if (!row?.id) return;
  const meta = (row.metadata as Record<string, unknown> | null) || {};
  const next = mergeReactions(normalizeReactions(meta.reactions), input.reactions);
  // Avoid no-op writes when already in sync.
  const prev = normalizeReactions(meta.reactions);
  if (
    prev.length === next.length &&
    prev.every(
      (p, i) =>
        p.value === next[i]?.value &&
        p.sender_id === next[i]?.sender_id &&
        Boolean(p.is_sender) === Boolean(next[i]?.is_sender)
    )
  ) {
    return;
  }
  await supabaseAdmin
    .from("messaging_messages")
    .update({ metadata: { ...meta, reactions: next } })
    .eq("id", row.id);
}
