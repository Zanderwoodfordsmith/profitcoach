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

export function parseDateOnly(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Whole months since the join date. Negative when the date is in the future. */
export function tenureMonths(joinedOn: string | null, now = new Date()): number | null {
  if (!joinedOn) return null;
  const start = parseDateOnly(joinedOn);
  if (!start) return null;
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  return months;
}

export function formatJoinDate(joinedOn: string, now = new Date()): string {
  const date = parseDateOnly(joinedOn);
  if (!date) return joinedOn;
  const month = SHORT_MONTHS[date.getMonth()];
  const sameYear = date.getFullYear() === now.getFullYear();
  return sameYear
    ? `${date.getDate()} ${month}`
    : `${date.getDate()} ${month} ${date.getFullYear()}`;
}

export function formatClientTenure(
  joinedOn: string | null,
  now = new Date()
): string | null {
  const months = tenureMonths(joinedOn, now);
  if (months == null || !joinedOn) return null;
  if (months < 0) return "Not started";
  if (months === 0) {
    const start = parseDateOnly(joinedOn);
    if (!start) return null;
    const days = Math.floor((startOfDay(now) - start.getTime()) / 86_400_000);
    if (days <= 0) return "Today";
    if (days < 7) return days === 1 ? "1 day" : `${days} days`;
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "1 week" : `${weeks} weeks`;
  }
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return months === 1 ? "1 month" : `${months} months`;
  if (rem === 0) return years === 1 ? "1 year" : `${years} years`;
  const yearLabel = years === 1 ? "1 year" : `${years} years`;
  const monthLabel = rem === 1 ? "1 month" : `${rem} months`;
  return `${yearLabel}, ${monthLabel}`;
}

export function formatGbp(amount: number): string {
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function averageTenureMonths(
  joinedDates: Array<string | null>,
  now = new Date()
): number | null {
  const months = joinedDates
    .map((date) => tenureMonths(date, now))
    .filter((value): value is number => value != null && value >= 0);
  if (!months.length) return null;
  return Math.round(months.reduce((sum, value) => sum + value, 0) / months.length);
}

function formatAverageTenure(months: number): string {
  if (months <= 0) return "under a month on average";
  if (months === 1) return "1 month on average";
  if (months < 12) return `${months} months on average`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) {
    return years === 1 ? "1 year on average" : `${years} years on average`;
  }
  const yearLabel = years === 1 ? "1 year" : `${years} years`;
  const monthLabel = rem === 1 ? "1 month" : `${rem} months`;
  return `${yearLabel}, ${monthLabel} on average`;
}

export function rosterSummaryLine(
  rows: Array<{ feeAmount: number | null; joinedOn: string | null }>,
  now = new Date()
): string {
  const count = rows.length;
  if (count === 0) {
    return "No clients yet. Import one from LinkedIn, then add the join date and price.";
  }
  const countLabel = count === 1 ? "1 client" : `${count} clients`;
  const priced = rows.filter((row) => row.feeAmount != null);
  const total = priced.reduce((sum, row) => sum + (row.feeAmount ?? 0), 0);
  const priceLabel =
    priced.length === 0
      ? "no prices yet"
      : priced.length === count
        ? `${formatGbp(total)} a month`
        : `${formatGbp(total)} a month on ${priced.length} of ${count}`;
  const average = averageTenureMonths(
    rows.map((row) => row.joinedOn),
    now
  );
  const tenureLabel =
    average == null ? "no join dates yet" : formatAverageTenure(average);
  return `${countLabel} · ${priceLabel} · ${tenureLabel}`;
}

export function compareRosterClients(
  a: { joinedOn: string | null; fullName: string },
  b: { joinedOn: string | null; fullName: string }
): number {
  const aMissing = !a.joinedOn;
  const bMissing = !b.joinedOn;
  if (aMissing !== bMissing) return aMissing ? -1 : 1;
  if (a.joinedOn && b.joinedOn && a.joinedOn !== b.joinedOn) {
    return a.joinedOn < b.joinedOn ? 1 : -1;
  }
  return a.fullName.localeCompare(b.fullName, "en-GB");
}
