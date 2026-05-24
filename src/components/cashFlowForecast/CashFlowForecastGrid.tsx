"use client";

import { ChevronDown } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

export const FORECAST_METRIC_W = 176;
export const FORECAST_WEEK_W = 76;

/** Sticky week dates sit just below the page header (no leading link). */
export const FORECAST_STICKY_WEEK_TOP = "4.5rem";

export function forecastMetricColumnStyle(): CSSProperties {
  return {
    minWidth: FORECAST_METRIC_W,
    width: FORECAST_METRIC_W,
    maxWidth: FORECAST_METRIC_W,
    boxSizing: "border-box",
  };
}

export function forecastWeekColumnStyle(): CSSProperties {
  return {
    minWidth: FORECAST_WEEK_W,
    width: FORECAST_WEEK_W,
    maxWidth: FORECAST_WEEK_W,
    boxSizing: "border-box",
  };
}

export function forecastTableStyle(tableMinWidth: number): CSSProperties {
  return {
    width: tableMinWidth,
    minWidth: tableMinWidth,
    maxWidth: tableMinWidth,
    tableLayout: "fixed",
  };
}

export function ForecastTableColGroup({ weekStarts }: { weekStarts: string[] }) {
  return (
    <colgroup>
      <col style={{ width: FORECAST_METRIC_W }} />
      {weekStarts.map((iso) => (
        <col key={iso} style={{ width: FORECAST_WEEK_W }} />
      ))}
    </colgroup>
  );
}

export function shortWeekLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

type WeekHeaderProps = {
  weekStarts: string[];
  label?: string;
  sticky?: boolean;
  /** Render in tbody so sticky survives long scroll (thead sticky is limited). */
  inBody?: boolean;
};

export function ForecastWeekHeaderRow({
  weekStarts,
  label = "",
  sticky = false,
  inBody = false,
}: WeekHeaderProps) {
  const Cell = inBody ? "td" : "th";
  const stickyBg = sticky ? "bg-slate-50/95 backdrop-blur-sm" : "bg-slate-50/80";
  const stickyStyle = sticky ? { top: FORECAST_STICKY_WEEK_TOP } : undefined;
  const stickyTopClass = sticky ? "sticky" : "";

  return (
    <tr className={`border-b border-slate-200 ${sticky ? "shadow-sm" : ""}`}>
      <Cell
        className={`${stickyTopClass} sticky left-0 z-[29] border-r border-slate-200/80 px-2 py-2 text-left text-xs font-medium text-slate-600 ${stickyBg}`}
        style={{ ...forecastMetricColumnStyle(), ...stickyStyle }}
      >
        {label}
      </Cell>
      {weekStarts.map((iso) => (
        <Cell
          key={iso}
          className={`${stickyTopClass} z-[28] px-1 py-2 text-center text-xs font-medium text-slate-600 ${stickyBg}`}
          style={{ ...forecastWeekColumnStyle(), ...stickyStyle }}
        >
          {shortWeekLabel(iso)}
        </Cell>
      ))}
    </tr>
  );
}

type StickyWeekBarProps = {
  weekStarts: string[];
  tableMinWidth: number;
  scrollLeft: number;
  /** Measured height of the sticky page header — keeps this bar flush underneath. */
  stickyTopPx?: number;
};

/** Week dates bar — sticky below page header, outside horizontal scroll containers. */
export function ForecastStickyWeekBar({
  weekStarts,
  tableMinWidth,
  scrollLeft,
  stickyTopPx,
}: StickyWeekBarProps) {
  const stickyTop =
    stickyTopPx && stickyTopPx > 0
      ? `${stickyTopPx}px`
      : FORECAST_STICKY_WEEK_TOP;

  return (
    <div
      className="sticky z-[28] border-b border-slate-200 bg-slate-50 shadow-sm"
      style={{ top: stickyTop }}
    >
      <div className="relative overflow-hidden">
        <table
          className="border-collapse text-xs"
          style={{
            ...forecastTableStyle(tableMinWidth),
            transform: scrollLeft ? `translateX(-${scrollLeft}px)` : undefined,
          }}
        >
          <colgroup>
            <col style={{ width: FORECAST_METRIC_W }} />
            {weekStarts.map((iso) => (
              <col key={iso} style={{ width: FORECAST_WEEK_W }} />
            ))}
          </colgroup>
          <tbody>
            <tr>
              <td className="border-r border-slate-200/80 px-2 py-2" aria-hidden />
              {weekStarts.map((iso) => (
                <td
                  key={iso}
                  className="px-1 py-2 text-center text-xs font-medium text-slate-600"
                >
                  {shortWeekLabel(iso)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 border-r border-slate-200/80 bg-slate-50"
          style={forecastMetricColumnStyle()}
          aria-hidden
        />
      </div>
    </div>
  );
}

type ExpandableHeaderProps = {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  weekStarts: string[];
  subtotals: Record<string, number>;
  formatMoney: (cents: number) => string;
  accentClass?: string;
};

export function ForecastExpandableHeaderRow({
  title,
  subtitle,
  open,
  onToggle,
  weekStarts,
  subtotals,
  formatMoney,
  accentClass = "text-slate-800",
}: ExpandableHeaderProps) {
  return (
    <tr className="border-b border-slate-100 bg-slate-50/50">
      <td
        className="sticky left-0 z-[1] border-r border-slate-100 bg-slate-50/50 px-2 py-2"
        style={forecastMetricColumnStyle()}
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-1.5 rounded-lg px-1 py-1 text-left hover:bg-white/80"
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "" : "-rotate-90"}`}
          />
          <div className="min-w-0">
            <div className={`truncate text-sm font-semibold ${accentClass}`}>{title}</div>
            {subtitle ? (
              <div className="truncate text-[10px] text-slate-500">{subtitle}</div>
            ) : null}
          </div>
        </button>
      </td>
      {weekStarts.map((weekStart) => {
        const amount = subtotals[weekStart] ?? 0;
        return (
          <td
            key={weekStart}
            className={`px-1 py-2 text-right text-xs font-semibold tabular-nums ${accentClass}`}
            style={forecastWeekColumnStyle()}
          >
            {amount ? formatMoney(amount) : "—"}
          </td>
        );
      })}
    </tr>
  );
}

type TotalRowProps = {
  label: string;
  weekStarts: string[];
  totals: Record<string, number>;
  formatMoney: (cents: number) => string;
  className?: string;
  cellClassName?: string | ((weekStart: string, amount: number) => string);
};

export function ForecastTotalRow({
  label,
  weekStarts,
  totals,
  formatMoney,
  className = "bg-white",
  cellClassName,
}: TotalRowProps) {
  return (
    <tr className={`border-t border-slate-200 ${className}`}>
      <td
        className="sticky left-0 z-[1] border-r border-slate-100 bg-inherit px-2 py-2.5 text-sm font-semibold text-slate-800"
        style={forecastMetricColumnStyle()}
      >
        {label}
      </td>
      {weekStarts.map((weekStart) => {
        const amount = totals[weekStart] ?? 0;
        const extra =
          typeof cellClassName === "function"
            ? cellClassName(weekStart, amount)
            : cellClassName ?? "";
        return (
          <td
            key={weekStart}
            className={`px-1 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900 ${extra}`}
            style={forecastWeekColumnStyle()}
          >
            {amount ? formatMoney(amount) : "—"}
          </td>
        );
      })}
    </tr>
  );
}

export function ForecastSectionSpacerRow({ weekStarts }: { weekStarts: string[] }) {
  return (
    <tr aria-hidden className="h-3">
      <td
        colSpan={1 + weekStarts.length}
        className="border-0 bg-white p-0"
      />
    </tr>
  );
}

export function ForecastSectionDividerRow({
  title,
  weekStarts,
  tone = "neutral",
}: {
  title: string;
  weekStarts: string[];
  tone?: "in" | "out" | "neutral";
}) {
  const rowClass =
    tone === "in"
      ? "border-t-2 border-emerald-200/80 bg-emerald-50/50"
      : tone === "out"
        ? "border-t-2 border-rose-200/80 bg-rose-50/40"
        : "border-t border-slate-200 bg-slate-50/60";
  const textClass =
    tone === "in"
      ? "text-emerald-950"
      : tone === "out"
        ? "text-rose-950"
        : "text-slate-800";

  return (
    <tr className={rowClass}>
      <td
        className="sticky left-0 z-[1] border-r border-slate-100/80 bg-inherit px-2 py-2.5 text-sm font-semibold"
        style={forecastMetricColumnStyle()}
      >
        <span className={textClass}>{title}</span>
      </td>
      {weekStarts.map((weekStart) => (
        <td key={weekStart} className="bg-inherit" style={forecastWeekColumnStyle()} />
      ))}
    </tr>
  );
}

type CardProps = {
  children: ReactNode;
  tone?: "in" | "out" | "summary";
};

const cardTone: Record<NonNullable<CardProps["tone"]>, string> = {
  summary: "border-slate-200 bg-white",
  in: "border-emerald-200/80 bg-emerald-50/30",
  out: "border-rose-200/80 bg-rose-50/20",
};

export function ForecastSectionCard({
  children,
  tone = "summary",
}: CardProps) {
  return (
    <section className={`rounded-xl border shadow-sm ${cardTone[tone]}`}>
      {children}
    </section>
  );
}

export function forecastTableMinWidth(weekCount: number): number {
  return FORECAST_METRIC_W + weekCount * FORECAST_WEEK_W;
}

/** Higher values → stronger green background. */
export function heatClassGreen(value: number, max: number): string {
  if (!value || max <= 0) return "";
  const t = value / max;
  if (t >= 0.75) return "bg-emerald-200";
  if (t >= 0.45) return "bg-emerald-100";
  return "bg-emerald-50";
}

/** Higher values → stronger red background. */
export function heatClassRed(value: number, max: number): string {
  if (!value || max <= 0) return "";
  const t = value / max;
  if (t >= 0.75) return "bg-rose-200";
  if (t >= 0.45) return "bg-rose-100";
  return "bg-rose-50";
}

export function heatClassNet(value: number, maxAbs: number): string {
  if (!value || maxAbs <= 0) return "";
  const t = Math.abs(value) / maxAbs;
  if (value > 0) {
    if (t >= 0.75) return "bg-emerald-200";
    if (t >= 0.45) return "bg-emerald-100";
    return "bg-emerald-50";
  }
  if (t >= 0.75) return "bg-rose-200";
  if (t >= 0.45) return "bg-rose-100";
  return "bg-rose-50";
}

export function sumAmountsByWeek(
  weekStarts: string[],
  getAmount: (weekStart: string) => number
): Record<string, number> {
  return Object.fromEntries(
    weekStarts.map((week) => [week, getAmount(week)])
  );
}

export function sumRowsByWeek(
  weekStarts: string[],
  rows: { amountsByWeek: Record<string, number> }[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const week of weekStarts) {
    out[week] = rows.reduce((sum, row) => sum + (row.amountsByWeek[week] ?? 0), 0);
  }
  return out;
}
