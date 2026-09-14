import { mergeMessagesChronological, type ThreadMessageLike } from "@/lib/messaging/threadWindow";

/**
 * In-memory only. Message bodies are PII — never localStorage / sessionStorage.
 * AuthZ still happens on every network fetch; this is a paint cache.
 */
const TTL_MS = 5 * 60 * 1000;

export type CachedThread<T extends ThreadMessageLike> = {
  messages: T[];
  hasOlder: boolean;
  at: number;
};

const cache = new Map<string, CachedThread<ThreadMessageLike>>();

export function clearThreadCache() {
  cache.clear();
}

export function readThreadCache<T extends ThreadMessageLike>(
  conversationId: string
): CachedThread<T> | null {
  const id = conversationId.trim();
  if (!id) return null;
  const entry = cache.get(id);
  if (!entry) return null;
  if (Date.now() - entry.at > TTL_MS) {
    cache.delete(id);
    return null;
  }
  return entry as CachedThread<T>;
}

export function writeThreadCache<T extends ThreadMessageLike>(
  conversationId: string,
  messages: T[],
  hasOlder?: boolean,
  mode: "replace" | "merge" = "merge"
) {
  const id = conversationId.trim();
  if (!id) return;
  const prev = cache.get(id);
  const nextMessages =
    mode === "replace" || !prev
      ? mergeMessagesChronological([], messages)
      : mergeMessagesChronological(prev.messages as T[], messages);
  cache.set(id, {
    messages: nextMessages,
    hasOlder: hasOlder ?? prev?.hasOlder ?? false,
    at: Date.now(),
  });
}
