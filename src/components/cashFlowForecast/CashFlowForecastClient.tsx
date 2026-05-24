"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CashFlowBalanceChart,
  CashFlowInOutChart,
  formatForecastCell,
  formatForecastMoney,
} from "@/components/cashFlowForecast/CashFlowForecastChart";
import {
  forecastMetricColumnStyle,
  forecastTableMinWidth,
  forecastTableStyle,
  ForecastExpandableHeaderRow,
  ForecastSectionCard,
  ForecastSectionDividerRow,
  ForecastSectionSpacerRow,
  ForecastStickyWeekBar,
  ForecastTableColGroup,
  ForecastTotalRow,
  heatClassGreen,
  heatClassNet,
  heatClassRed,
  sumAmountsByWeek,
  sumRowsByWeek,
  forecastWeekColumnStyle,
} from "@/components/cashFlowForecast/CashFlowForecastGrid";
import { StickyPageHeader } from "@/components/layout";
import { isCashFlowForecastAllowedEmail } from "@/lib/cashFlowForecastAccess";
import { formatForecastOwedDueDate } from "@/lib/cashFlowForecast/owedPayments";
import type {
  ForecastCustomerRow,
  ForecastExpenseRow,
  ForecastWeekSummary,
} from "@/lib/cashFlowForecast/types";
import { supabaseClient } from "@/lib/supabaseClient";

type ForecastPayload = {
  startMonday: string;
  weekStarts: string[];
  openingBalanceCents: number;
  customerRows: ForecastCustomerRow[];
  expenseRows: ForecastExpenseRow[];
  excludedStreamKeys: string[];
  weekSummaries: ForecastWeekSummary[];
  settings: {
    openingBalanceCents: number;
    stripeBalanceCents: number;
    stripeBalanceAsOf: string | null;
    startMonday: string | null;
    expenseRows: ForecastExpenseRow[];
    excludedStreamKeys: string[];
  };
};

function poundsToCents(value: string): number | null {
  const trimmed = value.trim().replace(/,/g, "");
  if (!trimmed) return 0;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function centsToPoundsInput(cents: number): string {
  if (!cents) return "";
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

function OpeningBalanceInput({
  valueCents,
  onChange,
}: {
  valueCents: number;
  onChange: (cents: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(centsToPoundsInput(valueCents));

  useEffect(() => {
    if (!focused) {
      setText(centsToPoundsInput(valueCents));
    }
  }, [valueCents, focused]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={focused ? text : formatForecastMoney(valueCents)}
      onChange={(e) => setText(e.target.value)}
      onFocus={() => {
        setFocused(true);
        setText(centsToPoundsInput(valueCents));
      }}
      onBlur={(e) => {
        setFocused(false);
        const cents = poundsToCents(e.target.value);
        if (cents == null) {
          setText(centsToPoundsInput(valueCents));
          return;
        }
        onChange(cents);
      }}
      className="w-full bg-transparent py-0.5 text-right text-xs font-medium tabular-nums text-sky-700 focus:outline-none focus:ring-1 focus:ring-sky-400"
      title="Opening balance"
    />
  );
}

function MoneyInput({
  valueCents,
  onChange,
}: {
  valueCents: number;
  onChange: (cents: number) => void;
}) {
  const [text, setText] = useState(centsToPoundsInput(valueCents));

  useEffect(() => {
    setText(centsToPoundsInput(valueCents));
  }, [valueCents]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const cents = poundsToCents(text);
        if (cents == null) {
          setText(centsToPoundsInput(valueCents));
          return;
        }
        onChange(cents);
      }}
      className="w-full bg-transparent px-1 py-2 text-right text-xs tabular-nums text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-0"
      placeholder="—"
    />
  );
}

function owedInlineClass(label: string | null): string {
  if (label === "Failed" || label === "Canceled" || label === "Overdue") {
    return "text-rose-700";
  }
  return "text-amber-800";
}

function owedDueLine(row: ForecastCustomerRow): string | null {
  if (row.owedLabel === "Overdue" && row.owedSortDateIso) {
    return formatForecastOwedDueDate(row.owedSortDateIso);
  }
  if (row.owedLabel && row.owedLabel !== "Overdue") {
    return row.owedLabel;
  }
  return null;
}

function CustomerRow({
  row,
  weekStarts,
  excluded,
  onToggleExcluded,
}: {
  row: ForecastCustomerRow;
  weekStarts: string[];
  excluded: boolean;
  onToggleExcluded: () => void;
}) {
  const dueLine = owedDueLine(row);
  const owedTitle =
    row.owedLabel === "Overdue" && row.owedSortDateIso
      ? `Overdue · due ${formatForecastOwedDueDate(row.owedSortDateIso)}`
      : row.owedLabel ?? "Owed";

  return (
    <tr className={excluded ? "opacity-40" : "hover:bg-white/60"}>
      <td
        className="sticky left-0 z-[1] border-r border-slate-100/80 bg-inherit px-2 py-2 pl-7"
        style={forecastMetricColumnStyle()}
      >
        <div className="flex items-start gap-1.5">
          <input
            type="checkbox"
            checked={!excluded}
            onChange={onToggleExcluded}
            className="mt-0.5 shrink-0"
            title="Include in forecast"
          />
          <div className="min-w-0">
            <div className="flex min-w-0 items-baseline gap-1">
              <span
                className={`truncate text-sm font-medium text-slate-800 ${row.companyName ? "cursor-help" : ""}`}
                title={row.companyName ?? undefined}
              >
                {row.customerLabel}
              </span>
              {row.amountOwedCents ? (
                <span
                  className={`shrink-0 text-[10px] font-semibold tabular-nums ${owedInlineClass(row.owedLabel)}`}
                  title={owedTitle}
                >
                  {formatForecastMoney(row.amountOwedCents)}
                </span>
              ) : null}
            </div>
            {row.note ? (
              <div className="truncate text-[10px] leading-snug text-slate-500">
                {row.note}
              </div>
            ) : null}
            {dueLine ? (
              <div
                className={`truncate text-[10px] ${owedInlineClass(row.owedLabel)}`}
              >
                {row.owedLabel === "Overdue" ? `due ${dueLine}` : dueLine}
              </div>
            ) : null}
          </div>
        </div>
      </td>
      {weekStarts.map((weekStart) => {
        const amount = row.amountsByWeek[weekStart] ?? 0;
        return (
          <td
            key={weekStart}
            className={`px-1 py-2 text-right tabular-nums ${
              row.kind === "recurring" ? "text-sky-800" : "text-amber-900"
            }`}
            style={forecastWeekColumnStyle()}
          >
            {formatForecastCell(amount)}
          </td>
        );
      })}
    </tr>
  );
}

export function CashFlowForecastClient() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ForecastPayload | null>(null);
  const [openingBalanceCents, setOpeningBalanceCents] = useState(0);
  const [expenseRows, setExpenseRows] = useState<ForecastExpenseRow[]>([]);
  const [excludedStreamKeys, setExcludedStreamKeys] = useState<string[]>([]);
  const [openCashIn, setOpenCashIn] = useState({
    recurring: false,
    plans: false,
  });
  const [openCashOut, setOpenCashOut] = useState<Record<string, boolean>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const chartScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const [tableScrollLeft, setTableScrollLeft] = useState(0);
  const [headerHeightPx, setHeaderHeightPx] = useState(0);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const measure = () => {
      setHeaderHeightPx(Math.round(el.getBoundingClientRect().height));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, allowed, saving]);

  const syncTableScroll = useCallback(
    (source: "charts" | "body") => (e: React.UIEvent<HTMLDivElement>) => {
      const left = e.currentTarget.scrollLeft;
      setTableScrollLeft(left);
      const other =
        source === "charts" ? bodyScrollRef.current : chartScrollRef.current;
      if (other && other.scrollLeft !== left) {
        other.scrollLeft = left;
      }
    },
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setAllowed(false);
      setLoading(false);
      return;
    }

    const res = await fetch("/api/admin/cash-flow-forecast", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json().catch(() => ({}))) as ForecastPayload & {
      error?: string;
    };

    if (res.status === 401) {
      setAllowed(false);
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError(body.error ?? "Unable to load forecast.");
      setLoading(false);
      return;
    }

    setAllowed(true);
    setData(body);
    setOpeningBalanceCents(
      body.settings.openingBalanceCents + body.settings.stripeBalanceCents
    );
    setExpenseRows(body.expenseRows);
    setExcludedStreamKeys(body.settings.excludedStreamKeys);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user) {
        if (!cancelled) setAllowed(false);
        return;
      }
      if (!isCashFlowForecastAllowedEmail(user.email)) {
        if (!cancelled) setAllowed(false);
        return;
      }
      await load();
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const persist = useCallback(
    async (patch: {
      openingBalanceCents?: number;
      expenseRows?: ForecastExpenseRow[];
      excludedStreamKeys?: string[];
    }) => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      setSaving(true);
      const res = await fetch("/api/admin/cash-flow-forecast", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patch),
      });
      setSaving(false);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Unable to save.");
        return;
      }
      await load();
    },
    [load]
  );

  const queueSave = useCallback(
    (patch: {
      openingBalanceCents?: number;
      expenseRows?: ForecastExpenseRow[];
      excludedStreamKeys?: string[];
    }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void persist(patch);
      }, 600);
    },
    [persist]
  );

  const weekStarts = data?.weekStarts ?? [];
  const weekSummaries = data?.weekSummaries ?? [];
  const customerRows = data?.customerRows ?? [];
  const tableMinWidth = forecastTableMinWidth(weekStarts.length);
  const firstWeekStart = weekStarts[0];

  const maxCashIn = useMemo(
    () => Math.max(1, ...weekSummaries.map((w) => w.cashInTotalCents)),
    [weekSummaries]
  );
  const maxCashOut = useMemo(
    () => Math.max(1, ...weekSummaries.map((w) => w.cashOutCents)),
    [weekSummaries]
  );
  const maxNetAbs = useMemo(
    () =>
      Math.max(
        1,
        ...weekSummaries.map((w) => Math.abs(w.netDifferenceCents))
      ),
    [weekSummaries]
  );

  const recurringRows = useMemo(
    () => customerRows.filter((r) => r.kind === "recurring"),
    [customerRows]
  );
  const planRows = useMemo(
    () => customerRows.filter((r) => r.kind === "plan"),
    [customerRows]
  );

  const expenseSections = useMemo(() => {
    const map = new Map<string, ForecastExpenseRow[]>();
    for (const row of expenseRows) {
      const list = map.get(row.section) ?? [];
      list.push(row);
      map.set(row.section, list);
    }
    return [...map.entries()];
  }, [expenseRows]);

  const recurringSubtotals = useMemo(
    () => sumRowsByWeek(weekStarts, recurringRows),
    [weekStarts, recurringRows]
  );
  const planSubtotals = useMemo(
    () => sumRowsByWeek(weekStarts, planRows),
    [weekStarts, planRows]
  );
  const cashInTotals = useMemo(
    () =>
      sumAmountsByWeek(weekStarts, (week) => {
        const summary = weekSummaries.find((w) => w.weekStart === week);
        return summary?.cashInTotalCents ?? 0;
      }),
    [weekStarts, weekSummaries]
  );
  const cashOutTotals = useMemo(
    () =>
      sumAmountsByWeek(weekStarts, (week) => {
        const summary = weekSummaries.find((w) => w.weekStart === week);
        return summary?.cashOutCents ?? 0;
      }),
    [weekStarts, weekSummaries]
  );

  const updateExpense = (rowId: string, weekStart: string, cents: number) => {
    setExpenseRows((prev) => {
      const next = prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              amountsByWeek: { ...row.amountsByWeek, [weekStart]: cents },
            }
          : row
      );
      queueSave({ expenseRows: next, openingBalanceCents });
      return next;
    });
  };

  const toggleExcluded = (streamKey: string) => {
    setExcludedStreamKeys((prev) => {
      const next = prev.includes(streamKey)
        ? prev.filter((k) => k !== streamKey)
        : [...prev, streamKey];
      queueSave({
        excludedStreamKeys: next,
        openingBalanceCents,
        expenseRows,
      });
      return next;
    });
  };

  if (allowed === false) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-rose-600">You do not have access to this page.</p>
      </div>
    );
  }

  if (loading || allowed === null) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">Loading cash flow forecast…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        rootRef={headerRef}
        title="13-week cash flow forecast"
        actions={
          saving ? (
            <span className="text-xs text-slate-500">Saving…</span>
          ) : null
        }
      />

      <div className="relative z-0 flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <ForecastSectionCard tone="summary">
        <div
          ref={chartScrollRef}
          className="overflow-x-auto"
          onScroll={syncTableScroll("charts")}
        >
          <table
            className="border-collapse text-xs"
            style={forecastTableStyle(tableMinWidth)}
          >
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th
                  className="sticky left-0 z-[2] border-r border-slate-200/80 bg-slate-50 px-2 py-2 text-left text-xs font-medium text-slate-700"
                  style={forecastMetricColumnStyle()}
                >
                  Charts
                </th>
                <th colSpan={weekStarts.length} className="px-0 py-1">
                  <CashFlowInOutChart weekSummaries={weekSummaries} />
                </th>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th
                  className="sticky left-0 z-[2] border-r border-slate-200/80 bg-slate-50 px-2 py-1 text-left text-[10px] font-medium text-slate-500"
                  style={forecastMetricColumnStyle()}
                >
                  Balance
                </th>
                <th colSpan={weekStarts.length} className="px-0 py-0">
                  <CashFlowBalanceChart weekSummaries={weekSummaries} />
                </th>
              </tr>
            </thead>
          </table>
        </div>

        <ForecastStickyWeekBar
          weekStarts={weekStarts}
          tableMinWidth={tableMinWidth}
          scrollLeft={tableScrollLeft}
          stickyTopPx={headerHeightPx}
        />

        <div
          ref={bodyScrollRef}
          className="overflow-x-auto"
          onScroll={syncTableScroll("body")}
        >
          <table
            className="border-collapse text-xs"
            style={forecastTableStyle(tableMinWidth)}
          >
          <ForecastTableColGroup weekStarts={weekStarts} />
          <tbody>
            {(
              [
                {
                  label: "Beginning cash",
                  getter: (w: ForecastWeekSummary) => w.beginningCashCents,
                  heat: () => "",
                  editableOpening: true,
                },
                {
                  label: "Total cash in",
                  getter: (w: ForecastWeekSummary) => w.cashInTotalCents,
                  heat: (v: number) => heatClassGreen(v, maxCashIn),
                },
                {
                  label: "Total cash out",
                  getter: (w: ForecastWeekSummary) => w.cashOutCents,
                  heat: (v: number) => heatClassRed(v, maxCashOut),
                },
                {
                  label: "Net difference",
                  getter: (w: ForecastWeekSummary) => w.netDifferenceCents,
                  heat: (v: number) => heatClassNet(v, maxNetAbs),
                },
                {
                  label: "Ending cash",
                  getter: (w: ForecastWeekSummary) => w.endingCashCents,
                  heat: () => "",
                },
              ] as const
            ).map(({ label, getter, heat, ...rest }, idx) => {
              const editableOpening = "editableOpening" in rest;
              return (
              <tr
                key={label}
                className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}
              >
                <td
                  className="sticky left-0 z-[1] border-r border-slate-100 bg-inherit px-2 py-2 font-medium text-slate-700"
                  style={forecastMetricColumnStyle()}
                  title={editableOpening ? "Opening balance — edit first week" : undefined}
                >
                  {label}
                </td>
                {weekSummaries.map((week, weekIdx) => {
                  const value = getter(week);
                  const isEndingCash = label === "Ending cash";
                  const isNegativeEnding = isEndingCash && value < 0;
                  const isNetDiff = label === "Net difference";
                  const isBeginningCash = label === "Beginning cash";
                  const isOpeningCell =
                    editableOpening && weekIdx === 0 && week.weekStart === firstWeekStart;
                  return (
                    <td
                      key={week.weekStart}
                      className={`px-1 py-2 text-right tabular-nums ${heat(value)} ${
                        isNegativeEnding
                          ? "font-semibold text-rose-700"
                          : isBeginningCash
                            ? "font-medium text-sky-700"
                            : "text-slate-800"
                      } ${isOpeningCell ? "ring-1 ring-inset ring-sky-100" : ""}`}
                      style={forecastWeekColumnStyle()}
                    >
                      {isOpeningCell ? (
                        <OpeningBalanceInput
                          valueCents={openingBalanceCents}
                          onChange={(cents) => {
                            setOpeningBalanceCents(cents);
                            queueSave({
                              openingBalanceCents: cents,
                              expenseRows,
                            });
                          }}
                        />
                      ) : isNetDiff && value !== 0 ? (
                        formatForecastMoney(value)
                      ) : isEndingCash || isBeginningCash ? (
                        formatForecastMoney(value)
                      ) : (
                        formatForecastCell(value)
                      )}
                    </td>
                  );
                })}
              </tr>
            );
            })}

            <ForecastSectionSpacerRow weekStarts={weekStarts} />
            <ForecastSectionDividerRow title="Cash in" weekStarts={weekStarts} tone="in" />

            <ForecastExpandableHeaderRow
              title="Monthly recurring"
              subtitle={`${recurringRows.length} customers`}
              open={openCashIn.recurring}
              onToggle={() =>
                setOpenCashIn((s) => ({ ...s, recurring: !s.recurring }))
              }
              weekStarts={weekStarts}
              subtotals={recurringSubtotals}
              formatMoney={formatForecastMoney}
              accentClass="text-sky-900"
            />
            {openCashIn.recurring &&
              recurringRows.map((row) => (
                <CustomerRow
                  key={row.streamKey}
                  row={row}
                  weekStarts={weekStarts}
                  excluded={excludedStreamKeys.includes(row.streamKey)}
                  onToggleExcluded={() => toggleExcluded(row.streamKey)}
                />
              ))}

            <ForecastExpandableHeaderRow
              title="Payment plans"
              subtitle={`${planRows.length} customers`}
              open={openCashIn.plans}
              onToggle={() => setOpenCashIn((s) => ({ ...s, plans: !s.plans }))}
              weekStarts={weekStarts}
              subtotals={planSubtotals}
              formatMoney={formatForecastMoney}
              accentClass="text-amber-900"
            />
            {openCashIn.plans &&
              planRows.map((row) => (
                <CustomerRow
                  key={row.streamKey}
                  row={row}
                  weekStarts={weekStarts}
                  excluded={excludedStreamKeys.includes(row.streamKey)}
                  onToggleExcluded={() => toggleExcluded(row.streamKey)}
                />
              ))}

            <ForecastTotalRow
              label="Total cash in"
              weekStarts={weekStarts}
              totals={cashInTotals}
              formatMoney={formatForecastMoney}
              className="bg-emerald-50/40"
              cellClassName={(_, amount) => heatClassGreen(amount, maxCashIn)}
            />

            <ForecastSectionSpacerRow weekStarts={weekStarts} />
            <ForecastSectionDividerRow title="Cash out" weekStarts={weekStarts} tone="out" />

            {expenseSections.map(([section, rows]) => {
              const sectionSubtotals = sumRowsByWeek(weekStarts, rows);
              const open = openCashOut[section] ?? false;
              return (
                <Fragment key={section}>
                  <ForecastExpandableHeaderRow
                    title={section}
                    subtitle={`${rows.length} items`}
                    open={open}
                    onToggle={() =>
                      setOpenCashOut((s) => ({ ...s, [section]: !open }))
                    }
                    weekStarts={weekStarts}
                    subtotals={sectionSubtotals}
                    formatMoney={formatForecastMoney}
                    accentClass="text-rose-900"
                  />
                  {open &&
                    rows.map((row) => (
                      <tr key={row.id} className="hover:bg-white/50">
                        <td
                          className="sticky left-0 z-[1] border-r border-slate-100/80 bg-inherit px-2 py-2 pl-7"
                          style={forecastMetricColumnStyle()}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-800">
                              {row.label}
                            </div>
                            {row.note ? (
                              <div className="truncate text-[10px] text-slate-500">
                                {row.note}
                              </div>
                            ) : row.monthlyAmountCents ? (
                              <div className="truncate text-[10px] text-slate-500">
                                {formatForecastMoney(row.monthlyAmountCents)}/mo
                                {row.paymentDayOfMonth
                                  ? ` · ~day ${row.paymentDayOfMonth}`
                                  : ""}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        {weekStarts.map((weekStart) => (
                          <td
                            key={weekStart}
                            className="px-1 py-0"
                            style={forecastWeekColumnStyle()}
                          >
                            <MoneyInput
                              valueCents={row.amountsByWeek[weekStart] ?? 0}
                              onChange={(cents) =>
                                updateExpense(row.id, weekStart, cents)
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                </Fragment>
              );
            })}
            <ForecastTotalRow
              label="Total cash out"
              weekStarts={weekStarts}
              totals={cashOutTotals}
              formatMoney={formatForecastMoney}
              className="bg-rose-50/40"
              cellClassName={(_, amount) => heatClassRed(amount, maxCashOut)}
            />
          </tbody>
          </table>
        </div>
      </ForecastSectionCard>
      </div>
    </div>
  );
}
