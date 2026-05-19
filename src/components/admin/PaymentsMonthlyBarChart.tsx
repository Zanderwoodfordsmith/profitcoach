"use client";

import { useMemo, useState } from "react";

import {
  PAYMENT_BILLING_CHART_STACK_ORDER,
  paymentBillingKindChartClass,
  paymentBillingKindLabel,
  type PaymentBillingKind,
} from "@/lib/paymentBillingKind";

type PaymentForChart = {
  status: string;
  amount_cents: number;
  currency: string;
  paid_at: string;
  billing_kind: PaymentBillingKind;
};

type MonthBucket = {
  key: string;
  label: string;
  totalCents: number;
  count: number;
  byKind: Record<PaymentBillingKind, { cents: number; count: number }>;
};

type ChartRange = "6" | "12" | "all";

const CHART_HEIGHT_PX = 160;

function emptyKindTotals(): Record<
  PaymentBillingKind,
  { cents: number; count: number }
> {
  return {
    recurring: { cents: 0, count: 0 },
    initial: { cents: 0, count: 0 },
    installment: { cents: 0, count: 0 },
    other: { cents: 0, count: 0 },
  };
}

function monthKeyFromIso(iso: string): string | null {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  const d = new Date(parsed);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthLabelFromKey(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function monthShortLabelFromKey(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

type YearAxisGroup = {
  year: number;
  label: string;
  monthCount: number;
  monthKeys: string[];
};

function buildYearAxisGroupsFromMonths(buckets: MonthBucket[]): YearAxisGroup[] {
  const years: YearAxisGroup[] = [];

  for (const bucket of buckets) {
    const year = Number(bucket.key.split("-")[0]);
    const last = years[years.length - 1];
    if (last?.year === year) {
      last.monthKeys.push(bucket.key);
      last.monthCount += 1;
    } else {
      years.push({
        year,
        label: String(year),
        monthCount: 1,
        monthKeys: [bucket.key],
      });
    }
  }

  return years;
}

export function buildSucceededMonthlyBuckets(
  payments: PaymentForChart[],
  currency: string
): MonthBucket[] {
  const map = new Map<string, MonthBucket>();
  const normalizedCurrency = currency.trim().toLowerCase();

  for (const payment of payments) {
    if (payment.status !== "succeeded") continue;
    if (payment.currency.trim().toLowerCase() !== normalizedCurrency) continue;

    const key = monthKeyFromIso(payment.paid_at);
    if (!key) continue;

    const kind = payment.billing_kind;
    const existing = map.get(key);
    if (existing) {
      existing.totalCents += payment.amount_cents;
      existing.count += 1;
      existing.byKind[kind].cents += payment.amount_cents;
      existing.byKind[kind].count += 1;
    } else {
      const byKind = emptyKindTotals();
      byKind[kind] = {
        cents: payment.amount_cents,
        count: 1,
      };
      map.set(key, {
        key,
        label: monthLabelFromKey(key),
        totalCents: payment.amount_cents,
        count: 1,
        byKind,
      });
    }
  }

  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

/** Compact label for on-bar amounts (e.g. £12.5k). */
function formatMoneyCompact(amountCents: number, currency: string): string {
  const amount = amountCents / 100;
  const code = currency.toUpperCase();
  if (amount >= 1_000_000) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: code,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  }
  if (amount >= 10_000) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: code,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return formatMoney(amountCents, currency);
}

function niceAxisMaxCents(maxCents: number): number {
  if (maxCents <= 0) return 100;
  const max = maxCents / 100;
  const exponent = Math.floor(Math.log10(max));
  const magnitude = 10 ** exponent;
  const normalized = max / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return Math.ceil(nice * magnitude * 100);
}

function buildYAxisTicks(axisMaxCents: number, tickCount = 4): number[] {
  const step = axisMaxCents / tickCount;
  return Array.from({ length: tickCount + 1 }, (_, i) => Math.round(i * step));
}

function billingBreakdownLines(
  bucket: MonthBucket,
  currency: string
): string[] {
  return PAYMENT_BILLING_CHART_STACK_ORDER.filter(
    (kind) => bucket.byKind[kind].cents > 0
  ).map(
    (kind) =>
      `${paymentBillingKindLabel(kind)}: ${formatMoney(bucket.byKind[kind].cents, currency)} (${bucket.byKind[kind].count})`
  );
}

type Props = {
  payments: PaymentForChart[];
  loading?: boolean;
};

export function PaymentsMonthlyBarChart({ payments, loading }: Props) {
  const [range, setRange] = useState<ChartRange>("12");
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const currencies = useMemo(() => {
    const set = new Set<string>();
    for (const payment of payments) {
      if (payment.status !== "succeeded") continue;
      set.add(payment.currency.trim().toLowerCase() || "gbp");
    }
    return [...set].sort();
  }, [payments]);

  const [currency, setCurrency] = useState("gbp");

  const activeCurrency = currencies.includes(currency)
    ? currency
    : (currencies[0] ?? "gbp");

  const allBuckets = useMemo(
    () => buildSucceededMonthlyBuckets(payments, activeCurrency),
    [payments, activeCurrency]
  );

  const buckets = useMemo(() => {
    if (range === "all") return allBuckets;
    const count = range === "6" ? 6 : 12;
    return allBuckets.slice(-count);
  }, [allBuckets, range]);

  const maxTotal = useMemo(
    () => Math.max(...buckets.map((b) => b.totalCents), 0),
    [buckets]
  );

  const axisMaxCents = useMemo(() => niceAxisMaxCents(maxTotal), [maxTotal]);

  const yTicks = useMemo(() => buildYAxisTicks(axisMaxCents, 4), [axisMaxCents]);

  const periodTotal = useMemo(
    () => buckets.reduce((sum, b) => sum + b.totalCents, 0),
    [buckets]
  );

  const useYearGroupedAxis = range === "all";

  const yearGroups = useMemo(
    () => (useYearGroupedAxis ? buildYearAxisGroupsFromMonths(buckets) : []),
    [buckets, useYearGroupedAxis]
  );

  const showYearAxisRow = yearGroups.length > 1;

  const yearBoundaryKeys = useMemo(() => {
    const keys = new Set<string>();
    for (let i = 1; i < yearGroups.length; i++) {
      const firstKey = yearGroups[i]?.monthKeys[0];
      if (firstKey) keys.add(firstKey);
    }
    return keys;
  }, [yearGroups]);

  /** Vertical rule in the flex gap before Jan; does not remove inter-month spacing. */
  const yearBoundaryDividerClass = "shadow-[-2px_0_0_0_#cbd5e1]";

  const hovered = buckets.find((b) => b.key === hoveredKey) ?? null;

  const renderBarColumn = (bucket: MonthBucket, isYearBoundary = false) => {
    const barHeightPx = Math.max(
      2,
      axisMaxCents > 0
        ? (bucket.totalCents / axisMaxCents) * CHART_HEIGHT_PX
        : 0
    );
    const isHovered = hoveredKey === bucket.key;
    const amountLabel = formatMoneyCompact(bucket.totalCents, activeCurrency);

    return (
      <div
        key={bucket.key}
        className={`flex min-w-0 flex-1 flex-col items-center justify-end ${
          isYearBoundary ? yearBoundaryDividerClass : ""
        }`}
        onMouseEnter={() => setHoveredKey(bucket.key)}
        onMouseLeave={() => setHoveredKey(null)}
      >
        <span
          className={`mb-0.5 max-w-full truncate px-0.5 text-center text-[9px] font-semibold leading-tight sm:text-[10px] ${
            isHovered ? "text-slate-900" : "text-slate-700"
          }`}
          title={formatMoney(bucket.totalCents, activeCurrency)}
        >
          {amountLabel}
        </span>
        <div
          className="flex w-full max-w-[2.75rem] flex-col justify-end overflow-hidden rounded-t-sm"
          style={{ height: barHeightPx }}
          title={billingBreakdownLines(bucket, activeCurrency).join("\n")}
        >
          {PAYMENT_BILLING_CHART_STACK_ORDER.map((kind) => {
            const segment = bucket.byKind[kind];
            if (segment.cents <= 0) return null;
            const segmentHeightPx = Math.max(
              1,
              axisMaxCents > 0
                ? (segment.cents / axisMaxCents) * CHART_HEIGHT_PX
                : 0
            );
            return (
              <div
                key={kind}
                className={`w-full ${paymentBillingKindChartClass(kind)} ${
                  isHovered ? "opacity-100" : "opacity-90"
                }`}
                style={{ height: segmentHeightPx }}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Succeeded payments by month</h2>
          <p className="mt-1 text-xs text-slate-600">
            Stacked by billing type (Recurring, New, Plan).
            {hovered ? (
              <span className="ml-1 font-medium text-slate-800">
                {hovered.label}: {formatMoney(hovered.totalCents, activeCurrency)} (
                {hovered.count} payment{hovered.count === 1 ? "" : "s"})
              </span>
            ) : null}
          </p>
          {hovered ? (
            <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
              {billingBreakdownLines(hovered, activeCurrency).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {currencies.length > 1 ? (
            <select
              value={activeCurrency}
              onChange={(e) => setCurrency(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900"
              aria-label="Currency"
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
            </select>
          ) : null}
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as ChartRange)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900"
            aria-label="Month range"
          >
            <option value="6">Last 6 months</option>
            <option value="12">Last 12 months</option>
            <option value="all">All months</option>
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {PAYMENT_BILLING_CHART_STACK_ORDER.filter((k) => k !== "other").map(
          (kind) => (
            <span key={kind} className="inline-flex items-center gap-1.5">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-sm ${paymentBillingKindChartClass(kind)}`}
                aria-hidden
              />
              {paymentBillingKindLabel(kind)}
            </span>
          )
        )}
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-sm ${paymentBillingKindChartClass("other")}`}
            aria-hidden
          />
          Other
        </span>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading chart…</p>
      ) : buckets.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No succeeded payments yet. Upload a Stripe CSV to populate this chart.
        </p>
      ) : (
        <>
          <p className="mt-3 text-xs text-slate-500">
            Period total:{" "}
            <span className="font-semibold text-slate-800">
              {formatMoney(periodTotal, activeCurrency)}
            </span>
          </p>

          <div
            className="mt-4 flex gap-2"
            role="img"
            aria-label="Monthly succeeded payment totals stacked by billing type"
          >
            {/* Y-axis */}
            <div
              className="flex shrink-0 flex-col justify-between pr-1 text-right"
              style={{ height: CHART_HEIGHT_PX + 28 }}
            >
              {[...yTicks].reverse().map((tick) => (
                <span
                  key={tick}
                  className="text-[10px] leading-none text-slate-500 sm:text-xs"
                >
                  {formatMoneyCompact(tick, activeCurrency)}
                </span>
              ))}
              <span className="invisible text-[10px]">0</span>
            </div>

            {/* Plot area */}
            <div className="min-w-0 flex-1">
              <div
                className="relative border-b border-l border-slate-300 bg-slate-50/50"
                style={{ height: CHART_HEIGHT_PX }}
              >
                {/* Horizontal grid lines */}
                {yTicks.slice(1).map((tick) => {
                  const pct = axisMaxCents > 0 ? (tick / axisMaxCents) * 100 : 0;
                  return (
                    <div
                      key={tick}
                      className="pointer-events-none absolute right-0 left-0 border-t border-slate-200/80"
                      style={{ bottom: `${pct}%` }}
                    />
                  );
                })}

                {/* Bars */}
                <div className="absolute inset-0 flex items-stretch gap-1 px-1 sm:gap-2 sm:px-2">
                  {buckets.map((bucket) =>
                    renderBarColumn(
                      bucket,
                      useYearGroupedAxis && yearBoundaryKeys.has(bucket.key)
                    )
                  )}
                </div>
              </div>

              {/* X-axis labels */}
              {useYearGroupedAxis ? (
                <div className="mt-1 px-1 sm:px-2">
                  <div className="flex gap-1 sm:gap-2">
                    {buckets.map((bucket) => {
                      const isHovered = hoveredKey === bucket.key;
                      const isYearBoundary = yearBoundaryKeys.has(bucket.key);
                      return (
                        <div
                          key={bucket.key}
                          className={`flex min-w-0 flex-1 flex-col items-center ${
                            isYearBoundary ? yearBoundaryDividerClass : ""
                          }`}
                        >
                          <span
                            className={`max-w-full truncate text-center text-[10px] leading-tight sm:text-xs ${
                              isHovered
                                ? "font-semibold text-slate-900"
                                : "text-slate-600"
                            }`}
                          >
                            {monthShortLabelFromKey(bucket.key)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {showYearAxisRow ? (
                    <div className="mt-1 flex border-t border-slate-200 pt-1">
                      {yearGroups.map((yearGroup, yearIndex) => (
                        <div
                          key={yearGroup.year}
                          className={`flex min-w-0 items-center justify-center ${
                            yearIndex > 0 ? yearBoundaryDividerClass : ""
                          }`}
                          style={{ flex: yearGroup.monthCount }}
                        >
                          <span className="truncate text-center text-[10px] font-medium text-slate-500 sm:text-xs">
                            {yearGroup.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-1 flex gap-1 px-1 sm:gap-2 sm:px-2">
                  {buckets.map((bucket) => {
                    const isHovered = hoveredKey === bucket.key;
                    return (
                      <div
                        key={bucket.key}
                        className="flex min-w-0 flex-1 flex-col items-center"
                      >
                        <span
                          className={`max-w-full truncate text-center text-[10px] leading-tight sm:text-xs ${
                            isHovered
                              ? "font-semibold text-slate-900"
                              : "text-slate-600"
                          }`}
                        >
                          {bucket.label.replace(" ", "\u00a0")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
