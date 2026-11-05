/** A chat's longest name, in the Inbox list and the chat's header. */
export const CHAT_TITLE_MAX = 80;

/**
 * A new chat's first name: the first line of its first message, cut to fit.
 * Shown at once, then replaced by the AI's short name (5 Nov) unless the coach
 * has renamed it by then.
 */
export function topicFrom(body: string): string {
  const line = body.trim().split("\n")[0]?.trim() ?? "";
  return line.length > CHAT_TITLE_MAX ? `${line.slice(0, CHAT_TITLE_MAX - 3).trimEnd()}…` : line || "Chat with BCA";
}
