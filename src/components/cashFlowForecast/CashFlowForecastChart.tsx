"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ForecastWeekSummary } from "@/lib/cashFlowForecast/types";

type ChartProps = {
  weekSummaries: ForecastWeekSummary[];
};

const AXIS_W = 44;

function fmtMoney(cents: number) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function fmtAxis(cents: number) {
  const pounds = cents / 100;
  const abs = Math.abs(pounds);
  const sign = pounds < 0 ? "−" : "";
  if (abs >= 1000) {
    const k = abs / 1000;
    const label = Number.isInteger(k) ? String(k) : k.toFixed(1).replace(/\.0$/, "");
    return `${sign}${label}k`;
  }
  return `${sign}${Math.round(abs)}`;
}

/** Readable axis steps in cents — £1k, £2k, £5k, £10k, … */
function niceStepCents(roughStepCents: number): number {
  if (roughStepCents <= 0) return 100_000;
  const pounds = roughStepCents / 100;
  const magnitude = 10 ** Math.floor(Math.log10(pounds));
  const norm = pounds / magnitude;
  const nicePounds = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nicePounds * magnitude * 100;
}

function niceScaleFromZero(
  dataMaxCents: number,
  targetTicks = 5
): { max: number; ticks: number[] } {
  const safeMax = Math.max(dataMaxCents, 100_000);
  const step = niceStepCents(safeMax / Math.max(1, targetTicks - 1));
  const max = step * Math.ceil(safeMax / step);
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) {
    ticks.push(v);
  }
  return { max, ticks };
}

function niceScaleRange(
  dataMinCents: number,
  dataMaxCents: number,
  targetTicks = 5
): { min: number; max: number; ticks: number[] } {
  let lo = dataMinCents;
  let hi = dataMaxCents;
  if (lo === hi) {
    lo -= 100_000;
    hi += 100_000;
  }
  const step = niceStepCents((hi - lo) / Math.max(1, targetTicks - 1));
  let min = Math.floor(lo / step) * step;
  let max = Math.ceil(hi / step) * step;
  if (lo < 0 && hi > 0) {
    if (min > 0) min = 0;
    if (max < 0) max = 0;
  }
  const ticks: number[] = [];
  for (let v = min; v <= max + step * 0.001; v += step) {
    ticks.push(Math.round(v));
  }
  return { min, max, ticks };
}

/** Side-by-side cash in total vs cash out total per week. */
export function CashFlowInOutChart({
  weekSummaries,
}: ChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect.width ?? 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const plotW = Math.max(0, width - AXIS_W);
  const n = weekSummaries.length;
  const cellW = plotW > 0 ? plotW / Math.max(1, n) : 64;
  const chartH = 148;
  const padTop = 10;
  const padBottom = 18;
  const innerH = chartH - padTop - padBottom;

  const dataMaxFlow = useMemo(
    () =>
      Math.max(
        0,
        ...weekSummaries.map((w) => Math.max(w.cashInTotalCents, w.cashOutCents))
      ),
    [weekSummaries]
  );

  const { max: maxFlow, ticks } = useMemo(
    () => niceScaleFromZero(dataMaxFlow, 5),
    [dataMaxFlow]
  );
  const barW = cellW * 0.28;
  const gap = cellW * 0.06;

  return (
    <div ref={wrapRef} className="relative h-[148px] w-full">
      {width > 0 && (
        <svg width={width} height={chartH} className="overflow-visible">
          {ticks.map((tick) => {
            const y = padTop + innerH - (tick / maxFlow) * innerH;
            return (
              <g key={tick}>
                <line
                  x1={AXIS_W}
                  x2={width}
                  y1={y}
                  y2={y}
                  className="stroke-slate-100"
                  strokeWidth={1}
                />
                <text
                  x={AXIS_W - 4}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 text-[9px]"
                >
                  {fmtAxis(tick)}
                </text>
              </g>
            );
          })}
          {weekSummaries.map((week, i) => {
            const cx = AXIS_W + (i + 0.5) * cellW;
            const inH = (week.cashInTotalCents / maxFlow) * innerH;
            const outH = (week.cashOutCents / maxFlow) * innerH;
            const baseY = padTop + innerH;
            const inX = cx - gap / 2 - barW;
            const outX = cx + gap / 2;
            return (
              <g key={week.weekStart}>
                <rect
                  x={inX}
                  y={baseY - inH}
                  width={barW}
                  height={Math.max(inH, week.cashInTotalCents > 0 ? 2 : 0)}
                  rx={3}
                  className="fill-emerald-500"
                />
                <rect
                  x={outX}
                  y={baseY - outH}
                  width={barW}
                  height={Math.max(outH, week.cashOutCents > 0 ? 2 : 0)}
                  rx={3}
                  className="fill-rose-400"
                />
              </g>
            );
          })}
        </svg>
      )}
      <div className="pointer-events-none absolute right-2 top-1 flex items-center gap-3 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" />
          Cash in
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-rose-400" />
          Cash out
        </span>
      </div>
    </div>
  );
}

/** Ending bank balance per week. */
export function CashFlowBalanceChart({
  weekSummaries,
}: ChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect.width ?? 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const plotW = Math.max(0, width - AXIS_W);
  const n = weekSummaries.length;
  const cellW = plotW > 0 ? plotW / Math.max(1, n) : 64;
  const chartH = 112;
  const padTop = 10;
  const padBottom = 18;
  const innerH = chartH - padTop - padBottom;

  const { min, max, ticks } = useMemo(() => {
    const vals = weekSummaries.map((w) => w.endingCashCents);
    if (vals.length === 0) return niceScaleRange(0, 100_000, 5);
    const lo = Math.min(0, ...vals);
    const hi = Math.max(0, ...vals);
    return niceScaleRange(lo, hi, 5);
  }, [weekSummaries]);

  const yForCents = (cents: number) =>
    padTop + innerH - ((cents - min) / (max - min)) * innerH;

  const zeroY = yForCents(0);

  const points = weekSummaries.map((week, i) => ({
    x: AXIS_W + (i + 0.5) * cellW,
    y: yForCents(week.endingCashCents),
    week,
    cents: week.endingCashCents,
  }));

  const { positivePath, negativePath } = useMemo(() => {
    if (points.length === 0) return { positivePath: "", negativePath: "" };

    const append = (d: string, x: number, y: number, move: boolean) =>
      `${d}${move ? "M" : "L"} ${x} ${y} `;

    let pos = "";
    let neg = "";

    const addSegment = (
      x1: number,
      y1: number,
      c1: number,
      x2: number,
      y2: number,
      c2: number
    ) => {
      if (c1 >= 0 && c2 >= 0) {
        pos = append(pos, x1, y1, pos.length === 0);
        pos = append(pos, x2, y2, false);
        return;
      }
      if (c1 < 0 && c2 < 0) {
        neg = append(neg, x1, y1, neg.length === 0);
        neg = append(neg, x2, y2, false);
        return;
      }

      const t = c1 / (c1 - c2);
      const xc = x1 + t * (x2 - x1);
      const yc = yForCents(0);

      if (c1 >= 0) {
        pos = append(pos, x1, y1, pos.length === 0);
        pos = append(pos, xc, yc, false);
        neg = append(neg, xc, yc, neg.length === 0);
        neg = append(neg, x2, y2, false);
      } else {
        neg = append(neg, x1, y1, neg.length === 0);
        neg = append(neg, xc, yc, false);
        pos = append(pos, xc, yc, pos.length === 0);
        pos = append(pos, x2, y2, false);
      }
    };

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      addSegment(a.x, a.y, a.cents, b.x, b.y, b.cents);
    }

    return { positivePath: pos.trim(), negativePath: neg.trim() };
  }, [points, min, max, innerH, padTop]);

  return (
    <div ref={wrapRef} className="relative h-[112px] w-full">
      {width > 0 && (
        <svg width={width} height={chartH} className="overflow-visible">
          {ticks.map((tick) => {
            const y = padTop + innerH - ((tick - min) / (max - min)) * innerH;
            return (
              <g key={tick}>
                <line
                  x1={AXIS_W}
                  x2={width}
                  y1={y}
                  y2={y}
                  className="stroke-slate-100"
                  strokeWidth={1}
                />
                <text
                  x={AXIS_W - 4}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 text-[9px]"
                >
                  {fmtAxis(tick)}
                </text>
              </g>
            );
          })}
          {zeroY != null && min < max && (
            <line
              x1={AXIS_W}
              x2={width}
              y1={zeroY}
              y2={zeroY}
              className="stroke-slate-500"
              strokeWidth={1.5}
            />
          )}
          {positivePath ? (
            <path
              d={positivePath}
              fill="none"
              stroke="#0284c7"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {negativePath ? (
            <path
              d={negativePath}
              fill="none"
              stroke="#e11d48"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {points.map((p) => (
            <circle
              key={p.week.weekStart}
              cx={p.x}
              cy={p.y}
              r={4}
              className={p.cents < 0 ? "fill-rose-600 stroke-white" : "fill-sky-600 stroke-white"}
              strokeWidth={1.5}
            />
          ))}
        </svg>
      )}
      <div className="pointer-events-none absolute right-2 top-1 flex items-center gap-3 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-sky-600" />
          Above zero
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-rose-600" />
          Below zero
        </span>
      </div>
    </div>
  );
}

export function formatForecastMoney(cents: number): string {
  return fmtMoney(cents);
}

export function formatForecastCell(cents: number): string {
  if (!cents) return "—";
  return fmtMoney(cents);
}
