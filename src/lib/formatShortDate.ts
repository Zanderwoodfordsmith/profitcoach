const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Short date: `10 Aug`, or `10 Aug 2025` when not this year. Always 3-letter month. */
export function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const month = SHORT_MONTHS[d.getMonth()];
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return sameYear
      ? `${d.getDate()} ${month}`
      : `${d.getDate()} ${month} ${d.getFullYear()}`;
  } catch {
    return iso;
  }
}

/** Time only: hours + minutes with am/pm, e.g. `3:35 pm`. */
export function formatShortTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
      .format(new Date(iso))
      .toLowerCase()
      .replace(/\u202f/g, " ") // narrow no-break space from some engines
      .replace(/\s+/g, " ")
      .replace(/\s*(am|pm)\s*$/i, " $1")
      .trim();
  } catch {
    return iso;
  }
}

/** Date + time: `10 Aug, 3:35 pm` (year only if needed). */
export function formatShortDateTime(iso: string): string {
  return `${formatShortDate(iso)}, ${formatShortTime(iso)}`;
}

/** Relative time for CRM lists: `just now`, `15 mins ago`, `Yesterday`, or `10 Aug`. */
export function formatRelativeAgo(iso: string, now = Date.now()): string {
  try {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return iso;
    const diff = Math.max(0, now - t);
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < 45_000) return "just now";
    if (diff < hour) {
      const m = Math.max(1, Math.floor(diff / minute));
      return m === 1 ? "1 min ago" : `${m} mins ago`;
    }
    if (diff < day) {
      const h = Math.max(1, Math.floor(diff / hour));
      return h === 1 ? "1 hour ago" : `${h} hours ago`;
    }
    if (diff < 2 * day) return "Yesterday";
    return formatShortDate(iso);
  } catch {
    return iso;
  }
}

/** Day chip: Today / Yesterday / `10 Aug` (year only if needed). */
export function formatDayLabel(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date();
    const startToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round(
      (startToday.getTime() - startMsg.getTime()) / 86_400_000
    );
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return formatShortDate(iso);
  } catch {
    return iso;
  }
}
