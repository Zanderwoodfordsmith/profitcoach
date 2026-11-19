/**
 * Reactions on Support messages (19 Nov). A reaction means "got it, no reply
 * needed", in place of the old "Seen" tick. One tap is 👍 (as in the
 * community); ❤️ 🙏 😂 ✅ 🔥 💪 sit behind it. On a WhatsApp chat it is also
 * sent on WhatsApp, as a reaction, never as a message.
 */
export const SUPPORT_REACTIONS = ["👍", "❤️", "🙏", "😂", "✅", "🔥", "💪"] as const;

export const DEFAULT_SUPPORT_REACTION = SUPPORT_REACTIONS[0];

/** What a reacted message shows: its emoji, or 👍 for an old "Seen" tick. */
export function shownReaction(reaction: string | null | undefined): string {
  return reaction?.trim() || DEFAULT_SUPPORT_REACTION;
}
