import type { TimeTrackerSettings } from "./types";

/** Format minutes-from-midnight as a label like "9:00 AM" or "13:00". */
export function formatMinutes(min: number, use24h = false): string {
  const clamped = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  const mm = m.toString().padStart(2, "0");
  if (use24h) {
    return `${h.toString().padStart(2, "0")}:${mm}`;
  }
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${period}`;
}

/** Compact label used inside grid cells (drops :00 minutes). */
export function formatMinutesShort(min: number): string {
  const clamped = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  const period = h < 12 ? "a" : "p";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${period}` : `${h12}:${m.toString().padStart(2, "0")}${period}`;
}

/** Inclusive start, exclusive end of the visible window for a day. */
export function visibleWindow(settings: TimeTrackerSettings): {
  startMin: number;
  endMin: number;
} {
  const startMin = settings.dayStartMin;
  const endMin = Math.min(1440, startMin + settings.visibleHours * 60);
  return { startMin, endMin };
}

/** Ordered list of slot start times (minutes from midnight) for the grid rows. */
export function slotStarts(settings: TimeTrackerSettings): number[] {
  const { startMin, endMin } = visibleWindow(settings);
  const slots: number[] = [];
  for (let m = startMin; m < endMin; m += settings.slotMinutes) {
    slots.push(m);
  }
  return slots;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Local YYYY-MM-DD for a Date. */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parse a YYYY-MM-DD key into a local Date at midnight. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map((v) => Number.parseInt(v, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** The 7 dates (Mon..Sun) for the week containing `date`. */
export function weekDates(date: Date): Date[] {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * DAY_MS));
}

export function addWeeks(date: Date, count: number): Date {
  return new Date(date.getTime() + count * 7 * DAY_MS);
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function weekdayLabel(index: number): string {
  return WEEKDAY_LABELS[index] ?? "";
}

const MONTH_LABELS = [
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
];

export function formatDateShort(date: Date): string {
  return `${MONTH_LABELS[date.getMonth()]} ${date.getDate()}`;
}

export function formatWeekRange(date: Date): string {
  const dates = weekDates(date);
  const first = dates[0];
  const last = dates[6];
  const sameMonth = first.getMonth() === last.getMonth();
  const left = formatDateShort(first);
  const right = sameMonth ? `${last.getDate()}` : formatDateShort(last);
  return `${left} – ${right}, ${last.getFullYear()}`;
}

export function isSameDateKey(a: string, b: string): boolean {
  return a === b;
}

export function isTodayKey(key: string): boolean {
  return key === toDateKey(new Date());
}

/** Snap a minute value down to the nearest slot boundary within the window. */
export function snapToSlot(min: number, settings: TimeTrackerSettings): number {
  const { startMin } = visibleWindow(settings);
  const offset = min - startMin;
  const snapped = startMin + Math.floor(offset / settings.slotMinutes) * settings.slotMinutes;
  return snapped;
}
