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

/**
 * Same buckets as post timestamps. Appends " ago" only for minute/hour/day buckets;
 * older activity uses the calendar date without " ago".
 */
export function formatCommunityRelativeActivityAgo(
  iso: string,
  now = Date.now()
): string {
  const inner = formatCommunityPostTimestamp(iso, now);
  if (!inner) return "";
  if (/^\d+[mhd]$/.test(inner)) return `${inner} ago`;
  return inner;
}

/** Relative future label in long form (e.g. "15 minutes", "2 days"). */
export function formatCommunityRelativeFutureLong(
  iso: string,
  now = Date.now()
): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Math.max(0, t - now);

  if (diff < HOUR_MS) {
    const minutes = Math.max(1, Math.floor(diff / 60_000));
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }

  if (diff < DAY_MS) {
    const hours = Math.max(1, Math.floor(diff / HOUR_MS));
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }

  const days = Math.max(1, Math.floor(diff / DAY_MS));
  return `${days} ${days === 1 ? "day" : "days"}`;
}
