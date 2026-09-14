/** Initial thread paint: newest messages only, then walk backward. */
export const THREAD_MESSAGE_PAGE_SIZE = 10;
export const THREAD_MESSAGE_MAX_LIMIT = 50;
export const THREAD_AUTO_FILL_MAX = 30;
export const THREAD_RECENT_MS = 14 * 24 * 60 * 60 * 1000;
export const THREAD_LIST_FAST_LIMIT = 40;
export const THREAD_LIST_MAX = 250;
export const THREAD_PREFETCH_COUNT = 3;

export const THREAD_MESSAGE_COLUMNS =
  "id, channel, direction, status, subject, body_text, body_html, from_address, to_address, bird_message_id, provider_error, metadata, created_at";

export function clampInt(
  raw: string | number | null | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const n =
    typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function clampThreadMessageLimit(
  raw: string | number | null | undefined
): number {
  return clampInt(raw, THREAD_MESSAGE_PAGE_SIZE, 1, THREAD_MESSAGE_MAX_LIMIT);
}

export function clampConversationListLimit(
  raw: string | number | null | undefined
): number {
  return clampInt(raw, THREAD_LIST_MAX, 1, THREAD_LIST_MAX);
}

export function parseBeforeCursor(
  raw: string | null | undefined
): string | null {
  const t = (raw || "").trim();
  if (!t) return null;
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

export type ThreadMessageLike = { id: string; created_at: string };

export function mergeMessagesChronological<T extends ThreadMessageLike>(
  existing: T[],
  incoming: T[]
): T[] {
  const map = new Map<string, T>();
  for (const row of existing) map.set(row.id, row);
  for (const row of incoming) map.set(row.id, row);
  return [...map.values()].sort((a, b) => {
    const dt = Date.parse(a.created_at) - Date.parse(b.created_at);
    if (dt !== 0) return dt;
    return a.id.localeCompare(b.id);
  });
}

export function sliceNewestPage<T>(
  newestFirst: T[],
  limit: number
): { rows: T[]; hasOlder: boolean } {
  if (newestFirst.length > limit) {
    return { rows: newestFirst.slice(0, limit), hasOlder: true };
  }
  return { rows: newestFirst, hasOlder: false };
}

export function toChronological<T>(newestFirst: T[]): T[] {
  return [...newestFirst].reverse();
}

/** Keep loading older pages while still inside the recent window. */
export function shouldAutoloadOlder(
  messages: ThreadMessageLike[],
  hasOlder: boolean,
  now = Date.now()
): boolean {
  if (!hasOlder || messages.length === 0) return false;
  if (messages.length >= THREAD_AUTO_FILL_MAX) return false;
  const oldestAt = Date.parse(messages[0]!.created_at);
  if (!Number.isFinite(oldestAt)) return false;
  return now - oldestAt < THREAD_RECENT_MS;
}

export function prioritizeUnipileChats<T>(
  items: T[],
  chatIdOf: (item: T) => string,
  priorityChatIds: string[]
): T[] {
  const priority = [
    ...new Set(priorityChatIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (!priority.length) return items;
  const rank = new Map(priority.map((id, i) => [id, i]));
  const first: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    const id = chatIdOf(item);
    if (rank.has(id)) first.push(item);
    else rest.push(item);
  }
  first.sort(
    (a, b) => (rank.get(chatIdOf(a)) ?? 0) - (rank.get(chatIdOf(b)) ?? 0)
  );
  return [...first, ...rest];
}
