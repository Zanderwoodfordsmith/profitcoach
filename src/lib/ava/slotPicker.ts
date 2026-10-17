/**
 * Pick two call times to offer a prospect, following
 * content/ai-knowledge/reply-copilot/booking-times.md.
 *
 * Pure: give it real free slots (from our calendar or GHL), the coach's time
 * zone and "now". It never invents a slot that isn't in the input.
 */

export type FreeSlot = { startsAt: string };
export type OfferedSlot = { startsAt: string; label: string; dayKey: string; half: "am" | "pm" };

const MIN_LEAD_MS = 3 * 60 * 60 * 1000;
const MAX_WORKING_DAYS_AHEAD = 4;

type Parts = { weekday: number; hour: number; minute: number; ymd: string };

function partsIn(date: Date, timeZone: string): Parts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) map[p.type] = p.value;
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    weekday: weekdays.indexOf(map.weekday ?? ""),
    hour: Number(map.hour),
    minute: Number(map.minute),
    ymd: `${map.year}-${map.month}-${map.day}`,
  };
}

function workingDaysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T12:00:00Z`);
  const b = new Date(`${toYmd}T12:00:00Z`);
  let n = 0;
  for (let d = new Date(a); d < b; d.setUTCDate(d.getUTCDate() + 1)) {
    const next = new Date(d);
    next.setUTCDate(next.getUTCDate() + 1);
    const wd = next.getUTCDay();
    if (wd !== 0 && wd !== 6) n += 1;
  }
  return n;
}

/** null = never offer this slot. Higher = better. */
export function scoreSlot(slotStart: Date, now: Date, timeZone: string): number | null {
  if (slotStart.getTime() - now.getTime() < MIN_LEAD_MS) return null;
  const p = partsIn(slotStart, timeZone);
  const mins = p.hour * 60 + p.minute;
  if (p.weekday === 0 || p.weekday === 6) return null;
  if (mins < 9 * 60 || mins > 17 * 60 + 30) return null;
  if (mins >= 12 * 60 + 30 && mins < 13 * 60 + 30) return null;
  if (p.weekday === 1 && mins < 12 * 60) return null;
  if (p.weekday === 5 && mins >= 12 * 60) return null;

  const ahead = workingDaysBetween(partsIn(now, timeZone).ymd, p.ymd);
  if (ahead > MAX_WORKING_DAYS_AHEAD) return null;

  let score = 0;
  score += [2, 3, 3, 2, 1, 0][Math.min(ahead, 5)] ?? 0; // tomorrow-ish is best; today only if 3h+ away
  if (p.weekday >= 2 && p.weekday <= 4) score += 3;
  else score += 1;
  if ((mins >= 10 * 60 && mins <= 11 * 60 + 30) || (mins >= 14 * 60 && mins <= 15 * 60 + 30)) score += 2;
  else if (mins >= 9 * 60 + 30 && mins <= 16 * 60 + 30) score += 1;
  if (p.minute === 0 || p.minute === 30) score += 0.5;
  return score;
}

export function formatSlotLabel(date: Date, timeZone: string, now: Date): string {
  const p = partsIn(date, timeZone);
  const today = partsIn(now, timeZone).ymd;
  const tomorrow = partsIn(new Date(now.getTime() + 86400000), timeZone).ymd;
  const day =
    p.ymd === today
      ? "today"
      : p.ymd === tomorrow
        ? "tomorrow"
        : new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long" }).format(date);
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const time = p.minute === 0 ? `${h12}${p.hour < 12 ? "am" : "pm"}` : `${h12}:${String(p.minute).padStart(2, "0")}${p.hour < 12 ? "am" : "pm"}`;
  return `${day} at ${time}`;
}

export function pickOfferSlots(input: { slots: FreeSlot[]; timeZone: string; now?: Date }): OfferedSlot[] {
  const now = input.now ?? new Date();
  const scored = input.slots
    .map((s) => {
      const d = new Date(s.startsAt);
      if (Number.isNaN(d.getTime())) return null;
      const score = scoreSlot(d, now, input.timeZone);
      if (score == null) return null;
      const p = partsIn(d, input.timeZone);
      return { d, score, dayKey: p.ymd, half: (p.hour < 12 ? "am" : "pm") as "am" | "pm" };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score || a.d.getTime() - b.d.getTime());

  const first = scored[0];
  if (!first) return [];
  const second =
    scored.find((s) => s.dayKey !== first.dayKey && s.half !== first.half) ??
    scored.find((s) => s.dayKey !== first.dayKey);
  const picked = [first, ...(second ? [second] : [])].sort((a, b) => a.d.getTime() - b.d.getTime());
  return picked.map((s) => ({
    startsAt: s.d.toISOString(),
    label: formatSlotLabel(s.d, input.timeZone, now),
    dayKey: s.dayKey,
    half: s.half,
  }));
}

export function zoneShortName(timeZone: string): string {
  if (timeZone === "Europe/London") return "UK time";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "short" }).formatToParts(new Date());
  return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
}
