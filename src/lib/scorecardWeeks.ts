/** Monday 00:00 local of the ISO week containing `d`. */
export function mondayOfWeekContaining(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = date.getDay(); // 0 Sun … 6 Sat
  const delta = dow === 0 ? -6 : 1 - dow;
  date.setDate(date.getDate() + delta);
  return date;
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIsoDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return dt;
}

/** True if `iso` is a Monday. */
export function isMondayIso(iso: string): boolean {
  const d = parseIsoDate(iso);
  if (!d) return false;
  return d.getDay() === 1;
}

/** Add `days` to ISO date string (local calendar). */
export function addDaysIso(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** Oldest → newest: `count` Mondays ending at `endMondayIso` (inclusive). */
export function mondaySequenceEnding(
  endMondayIso: string,
  count: number
): string[] {
  const end = parseIsoDate(endMondayIso);
  if (!end || end.getDay() !== 1) return [];
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i * 7);
    out.push(toIsoDate(d));
  }
  return out;
}

/** Oldest → newest: `count` Mondays starting at `startMondayIso` (inclusive). */
export function mondaySequenceFromStart(
  startMondayIso: string,
  count: number
): string[] {
  const start = parseIsoDate(startMondayIso);
  if (!start || start.getDay() !== 1) return [];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 7);
    out.push(toIsoDate(d));
  }
  return out;
}

/** Add `weeks` × 7 days to ISO Monday. */
export function addWeeksIso(iso: string, weeks: number): string {
  return addDaysIso(iso, weeks * 7);
}

/** First Monday of the default rolling scorecard window (16 cols ending `thisMonday + 3w`). */
export function defaultScorecardPeriodStartMonday(now = new Date()): string {
  const m = mondayOfWeekContaining(now);
  return addWeeksIso(toIsoDate(m), -12);
}

/** Monday of the week containing `now` (local calendar), as YYYY-MM-DD. */
export function thisMondayIsoFromDate(now = new Date()): string {
  return toIsoDate(mondayOfWeekContaining(now));
}

/**
 * Advance `startMondayIso` by whole weeks until the last visible Monday
 * (`start + (visibleWeeks - 1) * 7`) is at least `thisMondayIso + 3 weeks`
 * (three planning weeks ahead).
 */
export function rollScorecardStartMonday(
  startMondayIso: string,
  thisMondayIso: string,
  visibleWeeks: number
): string {
  const targetEnd = addWeeksIso(thisMondayIso, 3);
  let s = startMondayIso;
  for (let guard = 0; guard < 104; guard++) {
    const last = addWeeksIso(s, visibleWeeks - 1);
    const lastD = parseIsoDate(last);
    const targetD = parseIsoDate(targetEnd);
    if (!lastD || !targetD || lastD.getTime() >= targetD.getTime()) break;
    s = addWeeksIso(s, 7);
  }
  return s;
}
