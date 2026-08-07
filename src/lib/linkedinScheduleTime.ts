/** Browser local timezone id, e.g. Africa/Johannesburg. */
export function localTimeZoneId(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  } catch {
    return "local";
  }
}

/**
 * `datetime-local` values are timezone-less ("2026-08-05T09:30").
 * Interpret them as the user's local wall clock, then store UTC ISO.
 */
export function localDatetimeInputToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Prefill datetime-local from a UTC ISO (or now + minutes). */
export function toLocalDatetimeInputValue(
  isoOrNull?: string | null,
  addMinutes = 0
): string {
  const base = isoOrNull ? new Date(isoOrNull) : new Date();
  if (Number.isNaN(base.getTime())) {
    return toLocalDatetimeInputValue(null, addMinutes);
  }
  const d = new Date(base.getTime() + addMinutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isPastOrSoon(iso: string, skewMs = 60_000): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return true;
  return t <= Date.now() + skewMs;
}

const MONTHS = [
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

/** e.g. `5 Aug` or `5 Aug 2027` when not the current year. */
export function formatShortDate(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  const day = d.getDate();
  const month = MONTHS[d.getMonth()]!;
  const year = d.getFullYear();
  const nowYear = new Date().getFullYear();
  return year === nowYear ? `${day} ${month}` : `${day} ${month} ${year}`;
}

/** e.g. `5 Aug, 08:47` or `5 Aug 2027, 08:47`. */
export function formatShortDateTime(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${formatShortDate(d)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
