/** Consider a member “online” if their community heartbeat is within this window. */
export const COMMUNITY_ONLINE_WINDOW_MS = 5 * 60 * 1000;

export function isCommunityOnline(
  lastSeenAt: string | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!lastSeenAt) return false;
  const t = new Date(lastSeenAt).getTime();
  if (Number.isNaN(t)) return false;
  return nowMs - t <= COMMUNITY_ONLINE_WINDOW_MS;
}
