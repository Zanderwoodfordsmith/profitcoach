export type MessageDirection = "inbound" | "outbound";

/** Fields stamped whenever a conversation's latest activity changes. */
export function conversationActivityPatch(input: {
  lastChannel: string;
  lastDirection: MessageDirection;
  lastPreview?: string | null;
  lastMessageAt?: string;
}): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    last_channel: input.lastChannel,
    last_direction: input.lastDirection,
  };
  if (input.lastPreview !== undefined) {
    patch.last_preview = input.lastPreview;
  }
  if (input.lastMessageAt !== undefined) {
    patch.last_message_at = input.lastMessageAt;
  }
  return patch;
}
