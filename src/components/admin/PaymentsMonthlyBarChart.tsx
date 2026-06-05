"use client";

import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import {
  convertAmountCents,
  GBP_TO_USD_RATE,
  normalizeCurrencyCode,
} from "@/lib/currencyConversion";
import {
  PAYMENT_BILLING_CHART_STACK_ORDER,
  paymentBillingKindChartClass,
  paymentBillingKindLabel,
  type PaymentBillingKind,
} from "@/lib/paymentBillingKind";

type PaymentForChart = {
  id: string;
  status: string;
  amount_cents: number;
  currency: string;
  paid_at: string;
  billing_kind: PaymentBillingKind;
  coach_name: string;
};

type ChartPaymentEntry = PaymentForChart & {
  displayAmountCents: number;
};

type ChartHover = {
  monthKey: string;
  kind?: PaymentBillingKind;
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
const POPOVER_CLOSE_MS = 120;
const POPOVER_WIDTH_PX = 308;
const POPOVER_MAX_HEIGHT = 380;

const BILLING_KIND_ACCENT: Record<PaymentBillingKind, string> = {
  recurring: "#0ea5e9",
  initial: "#8b5cf6",
  installment: "#f59e0b",
  other: "#94a3b8",
};

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
  displayCurrency: string
): MonthBucket[] {
  const map = new Map<string, MonthBucket>();
  const normalizedDisplayCurrency = normalizeCurrencyCode(displayCurrency);

  for (const payment of payments) {
    if (payment.status !== "succeeded") continue;

    const convertedCents = convertAmountCents(
      payment.amount_cents,
      payment.currency,
      normalizedDisplayCurrency
    );
    if (convertedCents === null) continue;

    const key = monthKeyFromIso(payment.paid_at);
    if (!key) continue;

    const kind = payment.billing_kind;
    const existing = map.get(key);
    if (existing) {
      existing.totalCents += convertedCents;
      existing.count += 1;
      existing.byKind[kind].cents += convertedCents;
      existing.byKind[kind].count += 1;
    } else {
      const byKind = emptyKindTotals();
      byKind[kind] = {
        cents: convertedCents,
        count: 1,
      };
      map.set(key, {
        key,
        label: monthLabelFromKey(key),
        totalCents: convertedCents,
        count: 1,
        byKind,
      });
    }
  }

  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function buildPaymentsByMonthAndKind(
  payments: PaymentForChart[],
  displayCurrency: string
): Map<string, ChartPaymentEntry[]> {
  const map = new Map<string, ChartPaymentEntry[]>();
  const normalizedDisplayCurrency = normalizeCurrencyCode(displayCurrency);

  for (const payment of payments) {
    if (payment.status !== "succeeded") continue;

    const displayAmountCents = convertAmountCents(
      payment.amount_cents,
      payment.currency,
      normalizedDisplayCurrency
    );
    if (displayAmountCents === null) continue;

    const monthKey = monthKeyFromIso(payment.paid_at);
    if (!monthKey) continue;

    const key = `${monthKey}:${payment.billing_kind}`;
    const entry: ChartPaymentEntry = { ...payment, displayAmountCents };
    const existing = map.get(key);
    if (existing) existing.push(entry);
    else map.set(key, [entry]);
  }

  for (const entries of map.values()) {
    entries.sort((a, b) => Date.parse(b.paid_at) - Date.parse(a.paid_at));
  }

  return map;
}

function formatPaymentDateShort(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  const date = new Date(parsed);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "2-digit" }),
  }).format(date);
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

function legendLabel(kind: PaymentBillingKind): string {
  return kind === "other" ? "Other" : paymentBillingKindLabel(kind);
}

function visibleBucketTotalCents(
  bucket: MonthBucket,
  hiddenKinds: Set<PaymentBillingKind>
): number {
  return PAYMENT_BILLING_CHART_STACK_ORDER.reduce(
    (sum, kind) =>
      hiddenKinds.has(kind) ? sum : sum + bucket.byKind[kind].cents,
    0
  );
}

function visibleBucketPaymentCount(
  bucket: MonthBucket,
  hiddenKinds: Set<PaymentBillingKind>
): number {
  return PAYMENT_BILLING_CHART_STACK_ORDER.reduce(
    (sum, kind) =>
      hiddenKinds.has(kind) ? sum : sum + bucket.byKind[kind].count,
    0
  );
}

function billingBreakdownLines(
  bucket: MonthBucket,
  currency: string,
  hiddenKinds: Set<PaymentBillingKind>
): string[] {
  return PAYMENT_BILLING_CHART_STACK_ORDER.filter(
    (kind) => !hiddenKinds.has(kind) && bucket.byKind[kind].cents > 0
  ).map(
    (kind) =>
      `${legendLabel(kind)}: ${formatMoney(bucket.byKind[kind].cents, currency)} (${bucket.byKind[kind].count})`
  );
}

function PaymentSegmentPopover({
  label,
  monthLabel,
  accentColor,
  payments,
  displayCurrency,
  isActive,
  onOpenChange,
  children,
  className = "",
}: {
  label: string;
  monthLabel: string;
  accentColor: string;
  payments: ChartPaymentEntry[];
  displayCurrency: string;
  isActive: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null
  );
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    if (payments.length === 0) return;
    clearCloseTimer();
    setOpen(true);
    onOpenChange(true);
  }, [clearCloseTimer, onOpenChange, payments.length]);

  const scheduleHide = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      onOpenChange(false);
    }, POPOVER_CLOSE_MS);
  }, [clearCloseTimer, onOpenChange]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    function updatePosition() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const panelWidth = Math.min(POPOVER_WIDTH_PX, window.innerWidth - 24);
      let left = rect.left + rect.width / 2 - panelWidth / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - panelWidth - 12));

      const estimatedHeight = Math.min(
        POPOVER_MAX_HEIGHT + 56,
        56 + payments.length * 26
      );
      let top = rect.bottom + 8;
      if (top + estimatedHeight > window.innerHeight - 12) {
        top = Math.max(12, rect.top - estimatedHeight - 8);
      }

      setPosition({ left, top });
    }

    updatePosition();
    const scrollOpts = { capture: true } as const;
    window.addEventListener("scroll", updatePosition, scrollOpts);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, scrollOpts);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, payments.length]);

  const triggerActive =
    open && isActive
      ? {
          filter: "brightness(1.14) saturate(1.15)",
          boxShadow:
            "inset 0 3px 0 rgba(255,255,255,0.6), inset 0 -2px 0 rgba(0,0,0,0.12)",
        }
      : undefined;

  const panel =
    open && position && payments.length > 0 ? (
      <div
        id={panelId}
        role="tooltip"
        className="fixed z-[220] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5"
        style={{
          left: position.left,
          top: position.top,
          width: Math.min(POPOVER_WIDTH_PX, window.innerWidth - 24),
        }}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
      >
        <div
          className="h-2.5 w-full"
          style={{ backgroundColor: accentColor }}
          aria-hidden
        />
        <div className="px-3 py-2.5">
          <p
            className="text-base font-semibold leading-tight"
            style={{ color: accentColor }}
          >
            {label}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {monthLabel} · {payments.length} payment
            {payments.length === 1 ? "" : "s"}
          </p>
          <ul
            className="mt-2 space-y-0.5 overflow-y-auto"
            style={{ maxHeight: POPOVER_MAX_HEIGHT }}
          >
            {payments.map((payment) => (
              <li key={payment.id}>
                <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-baseline gap-x-2 px-1.5 py-0.5 text-sm leading-snug">
                  <span className="shrink-0 tabular-nums text-xs text-slate-400">
                    {formatPaymentDateShort(payment.paid_at)}
                  </span>
                  <span
                    className={`min-w-0 truncate ${
                      payment.coach_name === "Unassigned"
                        ? "text-slate-400"
                        : "text-slate-800"
                    }`}
                  >
                    {payment.coach_name}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-700">
                    {formatMoney(payment.displayAmountCents, displayCurrency)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    ) : null;

  return (
    <>
      <span
        ref={triggerRef}
        className={`block h-full w-full cursor-pointer ${className}`.trim()}
        style={triggerActive}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onFocus={show}
        onBlur={scheduleHide}
        aria-describedby={open ? panelId : undefined}
      >
        {children}
      </span>
      {typeof document !== "undefined" && panel
        ? createPortal(panel, document.body)
        : null}
    </>
  );
}

type Props = {
  payments: PaymentForChart[];
  loading?: boolean;
};

export function PaymentsMonthlyBarChart({ payments, loading }: Props) {
  const [range, setRange] = useState<ChartRange>("12");
  const [hover, setHover] = useState<ChartHover | null>(null);
  const [hiddenKinds, setHiddenKinds] = useState<Set<PaymentBillingKind>>(
    () => new Set()
  );

  const toggleKindVisibility = (kind: PaymentBillingKind) => {
    setHiddenKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const currencies = useMemo(() => {
    const set = new Set<string>();
    for (const payment of payments) {
      if (payment.status !== "succeeded") continue;
      set.add(normalizeCurrencyCode(payment.currency));
    }
    return [...set].sort();
  }, [payments]);

  const showCurrencyConversionNote =
    currencies.includes("gbp") && currencies.includes("usd");

  const [currency, setCurrency] = useState("gbp");

  const activeCurrency = currencies.includes(currency)
    ? currency
    : (currencies[0] ?? "gbp");

  const allBuckets = useMemo(
    () => buildSucceededMonthlyBuckets(payments, activeCurrency),
    [payments, activeCurrency]
  );

  const paymentsByMonthAndKind = useMemo(
    () => buildPaymentsByMonthAndKind(payments, activeCurrency),
    [payments, activeCurrency]
  );

  const buckets = useMemo(() => {
    if (range === "all") return allBuckets;
    const count = range === "6" ? 6 : 12;
    return allBuckets.slice(-count);
  }, [allBuckets, range]);

  const maxTotal = useMemo(
    () =>
      Math.max(
        ...buckets.map((b) => visibleBucketTotalCents(b, hiddenKinds)),
        0
      ),
    [buckets, hiddenKinds]
  );

  const axisMaxCents = useMemo(() => niceAxisMaxCents(maxTotal), [maxTotal]);

  const yTicks = useMemo(() => buildYAxisTicks(axisMaxCents, 4), [axisMaxCents]);

  const periodTotal = useMemo(
    () =>
      buckets.reduce(
        (sum, b) => sum + visibleBucketTotalCents(b, hiddenKinds),
        0
      ),
    [buckets, hiddenKinds]
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

  const hovered = hover ? buckets.find((b) => b.key === hover.monthKey) ?? null : null;

  const renderBarColumn = (bucket: MonthBucket, isYearBoundary = false) => {
    const visibleTotalCents = visibleBucketTotalCents(bucket, hiddenKinds);
    const barHeightPx = Math.max(
      2,
      axisMaxCents > 0
        ? (visibleTotalCents / axisMaxCents) * CHART_HEIGHT_PX
        : 0
    );
    const isMonthHovered = hover?.monthKey === bucket.key;
    const amountLabel = formatMoneyCompact(visibleTotalCents, activeCurrency);
    const breakdownTitle = billingBreakdownLines(
      bucket,
      activeCurrency,
      hiddenKinds
    ).join("\n");

    return (
      <div
        key={bucket.key}
        className={`flex min-w-0 flex-1 flex-col items-center justify-end ${
          isYearBoundary ? yearBoundaryDividerClass : ""
        }`}
        onMouseLeave={() => setHover(null)}
      >
        <span
          className={`mb-0.5 max-w-full truncate px-0.5 text-center text-[9px] font-semibold leading-tight sm:text-[10px] ${
            isMonthHovered ? "text-slate-900" : "text-slate-700"
          }`}
          title={formatMoney(visibleTotalCents, activeCurrency)}
          onMouseEnter={() => setHover({ monthKey: bucket.key })}
        >
          {visibleTotalCents > 0 ? amountLabel : ""}
        </span>
        <div
          className="flex w-full max-w-[2.75rem] flex-col justify-end overflow-hidden rounded-t-sm"
          style={{ height: barHeightPx }}
          title={breakdownTitle || undefined}
        >
          {PAYMENT_BILLING_CHART_STACK_ORDER.map((kind) => {
            if (hiddenKinds.has(kind)) return null;
            const segment = bucket.byKind[kind];
            if (segment.cents <= 0) return null;
            const segmentHeightPx = Math.max(
              1,
              axisMaxCents > 0
                ? (segment.cents / axisMaxCents) * CHART_HEIGHT_PX
                : 0
            );
            const segmentPayments =
              paymentsByMonthAndKind.get(`${bucket.key}:${kind}`) ?? [];
            const isSegmentHovered =
              hover?.monthKey === bucket.key && hover.kind === kind;

            return (
              <div key={kind} className="w-full" style={{ height: segmentHeightPx }}>
                <PaymentSegmentPopover
                  label={legendLabel(kind)}
                  monthLabel={bucket.label}
                  accentColor={BILLING_KIND_ACCENT[kind]}
                  payments={segmentPayments}
                  displayCurrency={activeCurrency}
                  isActive={isSegmentHovered}
                  onOpenChange={(open) => {
                    if (open) setHover({ monthKey: bucket.key, kind });
                    else if (
                      hover?.monthKey === bucket.key &&
                      hover.kind === kind
                    ) {
                      setHover(null);
                    }
                  }}
                >
                  <div
                    className={`h-full w-full ${paymentBillingKindChartClass(kind)} ${
                      isSegmentHovered
                        ? "opacity-100"
                        : isMonthHovered
                          ? "opacity-100"
                          : "opacity-90"
                    }`}
                  />
                </PaymentSegmentPopover>
              </div>
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
            {showCurrencyConversionNote ? (
              <span className="ml-1">
                Totals combine GBP and USD at 1 GBP = $
                {GBP_TO_USD_RATE.toFixed(2)}.
              </span>
            ) : null}
            {hovered && !hover?.kind ? (
              <span className="ml-1 font-medium text-slate-800">
                {hovered.label}:{" "}
                {formatMoney(
                  visibleBucketTotalCents(hovered, hiddenKinds),
                  activeCurrency
                )}{" "}
                (
                {visibleBucketPaymentCount(hovered, hiddenKinds)} payment
                {visibleBucketPaymentCount(hovered, hiddenKinds) === 1
                  ? ""
                  : "s"}
                )
              </span>
            ) : null}
          </p>
          {hovered && !hover?.kind ? (
            <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
              {billingBreakdownLines(hovered, activeCurrency, hiddenKinds).map(
                (line) => (
                  <li key={line}>{line}</li>
                )
              )}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div
            className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600"
            role="group"
            aria-label="Billing type legend"
          >
            {PAYMENT_BILLING_CHART_STACK_ORDER.map((kind) => {
              const isHidden = hiddenKinds.has(kind);
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => toggleKindVisibility(kind)}
                  aria-pressed={!isHidden}
                  className={`inline-flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors hover:bg-slate-100 ${
                    isHidden
                      ? "text-slate-400 line-through"
                      : "text-slate-600"
                  }`}
                >
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-sm ${paymentBillingKindChartClass(kind)} ${
                      isHidden ? "opacity-30" : ""
                    }`}
                    aria-hidden
                  />
                  {legendLabel(kind)}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {currencies.length > 1 ? (
              <select
                value={activeCurrency}
                onChange={(e) => setCurrency(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900"
                aria-label="Display currency"
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
                      const isHovered = hover?.monthKey === bucket.key;
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
                    const isHovered = hover?.monthKey === bucket.key;
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
