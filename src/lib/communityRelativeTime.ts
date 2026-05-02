const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Relative post time: under 1h as minutes, under 24h as hours, 1–30d as days, else calendar date. */
export function formatCommunityPostTimestamp(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";

  const diff = Math.max(0, now - t);

  if (diff < HOUR_MS) {
    const m = Math.floor(diff / 60_000);
    return `${Math.max(1, m)}m`;
  }

  if (diff < 24 * HOUR_MS) {
    const h = Math.floor(diff / HOUR_MS);
    return `${Math.max(1, h)}h`;
  }

  const days = Math.floor(diff / DAY_MS);
  if (days >= 1 && days <= 30) {
    return `${days}d`;
  }

  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
