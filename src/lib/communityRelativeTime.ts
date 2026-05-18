import { DateTime } from "luxon";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

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

function formatFutureMinutesHoursDays(diffMs: number): string {
  if (diffMs < HOUR_MS) {
    const minutes = Math.max(1, Math.floor(diffMs / 60_000));
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }

  if (diffMs < DAY_MS) {
    const hours = Math.max(1, Math.floor(diffMs / HOUR_MS));
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }

  const wholeDays = Math.floor(diffMs / DAY_MS);
  const remainderHours = Math.floor((diffMs % DAY_MS) / HOUR_MS);

  if (remainderHours === 0) {
    const days = Math.max(1, wholeDays);
    return `${days} ${days === 1 ? "day" : "days"}`;
  }

  // e.g. Sat 2pm → Mon 1pm (~47h): floor says "1 day" but people expect "2 days".
  if (remainderHours >= 12) {
    const days = wholeDays + 1;
    return `${days} ${days === 1 ? "day" : "days"}`;
  }

  if (wholeDays === 1) {
    return `1 day, ${remainderHours} ${remainderHours === 1 ? "hour" : "hours"}`;
  }

  return `${wholeDays} days, ${remainderHours} ${
    remainderHours === 1 ? "hour" : "hours"
  }`;
}

/** Relative future label in long form (e.g. "15 minutes", "2 days"). */
export function formatCommunityRelativeFutureLong(
  iso: string,
  now = Date.now()
): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  return formatFutureMinutesHoursDays(Math.max(0, t - now));
}

/**
 * Feed copy for an upcoming calendar event: "in 3 hours", "on Monday at 1:00 PM",
 * or "in 12 days" for events further out. Uses the event's display timezone so
 * "Monday at 1pm" matches what members see on the calendar.
 */
export function formatCommunityEventHappeningWhen(
  startsAtIso: string,
  displayTimezone: string,
  now = Date.now()
): string {
  const zone = displayTimezone?.trim() || "UTC";
  const start = DateTime.fromISO(startsAtIso, { zone: "utc" }).setZone(zone);
  if (!start.isValid) return "";

  const nowInZone = DateTime.fromMillis(now, { zone: "utc" }).setZone(zone);
  const diff = start.toMillis() - nowInZone.toMillis();
  if (diff <= 0) return "";

  if (diff < DAY_MS) {
    return `in ${formatFutureMinutesHoursDays(diff)}`;
  }

  if (diff < WEEK_MS) {
    const time = start.toFormat("h:mm a");
    if (start.hasSame(nowInZone, "day")) {
      return `today at ${time}`;
    }
    if (start.hasSame(nowInZone.plus({ days: 1 }), "day")) {
      return `tomorrow at ${time}`;
    }
    return `on ${start.toFormat("cccc")} at ${time}`;
  }

  return `in ${formatFutureMinutesHoursDays(diff)}`;
}
