/** Short date: `10 Aug`, or `10 Aug 2025` when not this year. */
export function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      ...(sameYear ? {} : { year: "numeric" }),
    }).format(d);
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
