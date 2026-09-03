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
      .replace(/\s+/g, " ");
  } catch {
    return iso;
  }
}

/** Date + time: `10 Aug, 3:35 pm` (year only if needed). */
export function formatShortDateTime(iso: string): string {
  return `${formatShortDate(iso)}, ${formatShortTime(iso)}`;
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
