"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { rowWeeklyValue } from "@/lib/scorecardCompute";
import type { ScorecardManualWeek } from "@/lib/scorecardManual";
import { chartUnitForRow, type ScorecardRowId } from "@/lib/scorecardTargets";

type WeekColumn = {
  week_start_date: string;
  manual_values: Partial<ScorecardManualWeek>;
};

type Props = {
  weekStarts: string[];
  /** Full week rows — values are matched by `week_start_date`, not array index. */
  weeks: WeekColumn[];
  leftMetric: ScorecardRowId;
  rightMetric: ScorecardRowId;
  /** Width (px) of the sticky metric column to the left of the chart — used for the sticky left Y-axis strip. */
  metricColumnPx?: number;
};

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtCount(n: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(n);
}

function fmtRatio(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

function fmtAxis(rowId: ScorecardRowId, v: number) {
  const u = chartUnitForRow(rowId);
  if (u === "money") return fmtMoney(v);
  if (u === "ratio") return fmtRatio(v);
  return fmtCount(v);
}

/** Hover label — slightly more precision for ratios. */
function fmtTooltip(rowId: ScorecardRowId, v: number) {
  const u = chartUnitForRow(rowId);
  if (u === "money") return fmtMoney(v);
  if (u === "ratio") return `${(v * 100).toFixed(1)}%`;
  return fmtCount(v);
}

function buildScale(
  rowId: ScorecardRowId,
  vals: (number | null)[]
): { min: number; max: number } {
  const isRatio = chartUnitForRow(rowId) === "ratio";
  const nums = vals.filter((v): v is number => v !== null && Number.isFinite(v));
  if (nums.length === 0) {
    return { min: 0, max: 1 };
  }

  let lo = Math.min(...nums);
  let hi = Math.max(...nums);

  if (isRatio) {
    /** Ratios are 0–1; zoom to data with padding, clamped to [0, 1]. */
    const span = hi - lo;
    const pad =
      span < 1e-9
        ? 0.02
        : Math.max(span * 0.15, 0.005);
    const min = Math.max(0, lo - pad);
    const max = Math.min(1, hi + pad);
    if (max - min < 1e-9) {
      return { min: 0, max: 1 };
    }
    return { min, max };
  }

  let min = lo;
  let max = hi;
  if (max - min < 1e-9) {
    max = min + 1;
  }
  return { min, max };
}

function yFromVal(
  v: number | null,
  min: number,
  max: number,
  innerTop: number,
  innerH: number
): number | null {
  if (v === null || !Number.isFinite(v)) return null;
  const t = (v - min) / (max - min);
  return innerTop + innerH - t * innerH;
}

function polylinePath(
  vals: (number | null)[],
  min: number,
  max: number,
  plotW: number,
  innerTop: number,
  innerH: number,
  xOffset = 0
): string {
  const n = vals.length;
  const cellW = plotW / Math.max(1, n);
  let d = "";
  for (let i = 0; i < vals.length; i++) {
    const y = yFromVal(vals[i], min, max, innerTop, innerH);
    if (y === null) continue;
    const x = (i + 0.5) * cellW + xOffset;
    d += d === "" ? `M${x},${y}` : `L${x},${y}`;
  }
  return d;
}

type LineHover = {
  x: number;
  y: number;
  label: string;
  stroke: string;
};

function LineHoverCallout({
  lineHover,
  plotW,
  innerTop,
  axisY,
}: {
  lineHover: LineHover;
  plotW: number;
  innerTop: number;
  axisY: number;
}) {
  const tw = Math.max(40, lineHover.label.length * 5.8 + 12);
  const th = 16;
  const pad = 6;
  let tx = lineHover.x + pad;
  if (tx + tw > plotW - 2) tx = lineHover.x - tw - 2;
  tx = Math.max(2, tx);
  let ty = lineHover.y - th - 8;
  if (ty < innerTop + 2) {
    ty = lineHover.y + 10;
  }
  if (ty + th > axisY - 2) {
    ty = axisY - th - 2;
  }
  ty = Math.max(innerTop + 2, ty);
  return (
    <g pointerEvents="none">
      <rect
        x={tx}
        y={ty}
        width={tw}
        height={th}
        rx={3}
        fill="#ffffff"
        stroke={lineHover.stroke}
        strokeWidth={0.9}
        opacity={0.98}
      />
      <text
        x={tx + tw / 2}
        y={ty + th - 4}
        textAnchor="middle"
        className="fill-slate-800 text-[9px] font-medium"
      >
        {lineHover.label}
      </text>
    </g>
  );
}

export function ScorecardComboChart({
  weekStarts,
  weeks,
  leftMetric,
  rightMetric,
  metricColumnPx = 220,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [measuredW, setMeasuredW] = useState(0);
  const [lineHover, setLineHover] = useState<LineHover | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === "number" && Number.isFinite(w)) {
        setMeasuredW(Math.max(0, Math.round(w)));
      }
    });
    ro.observe(el);
    setMeasuredW(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  const manualByIso = useMemo(() => {
    const m = new Map<string, Partial<ScorecardManualWeek>>();
    for (const w of weeks) {
      m.set(w.week_start_date, w.manual_values);
    }
    return m;
  }, [weeks]);

  const n = weekStarts.length;
  const valsL = useMemo(
    () =>
      weekStarts.map((iso) =>
        rowWeeklyValue(leftMetric, manualByIso.get(iso) ?? {})
      ),
    [weekStarts, manualByIso, leftMetric]
  );
  const valsR = useMemo(
    () =>
      weekStarts.map((iso) =>
        rowWeeklyValue(rightMetric, manualByIso.get(iso) ?? {})
      ),
    [weekStarts, manualByIso, rightMetric]
  );

  const leftRatio = chartUnitForRow(leftMetric) === "ratio";
  const rightRatio = chartUnitForRow(rightMetric) === "ratio";

  const scaleL = useMemo(
    () => buildScale(leftMetric, valsL),
    [leftMetric, valsL]
  );
  const scaleR = useMemo(
    () => buildScale(rightMetric, valsR),
    [rightMetric, valsR]
  );

  /** ViewBox height: x-axis is the bottom edge (touches date row below). */
  const VB_H = 120;
  const padT = 8;
  const axisY = VB_H - 1;
  const innerTop = padT;
  const innerH = axisY - padT;

  const W = Math.max(320, measuredW || Math.max(360, n * 64));
  const plotW = W;
  const cellW = plotW / Math.max(1, n);

  const bothRatioLines = leftRatio && rightRatio;
  const lineXOffL = bothRatioLines ? -4 : 0;
  const lineXOffR = bothRatioLines ? 4 : 0;

  const pathL = useMemo(
    () =>
      leftRatio
        ? polylinePath(
            valsL,
            scaleL.min,
            scaleL.max,
            plotW,
            innerTop,
            innerH,
            lineXOffL
          )
        : "",
    [leftRatio, valsL, scaleL, plotW, innerTop, innerH, lineXOffL]
  );
  const pathR = useMemo(
    () =>
      rightRatio
        ? polylinePath(
            valsR,
            scaleR.min,
            scaleR.max,
            plotW,
            innerTop,
            innerH,
            lineXOffR
          )
        : "",
    [rightRatio, valsR, scaleR, plotW, innerTop, innerH, lineXOffR]
  );

  const linePointsL = useMemo(() => {
    if (!leftRatio) return [];
    const out: Array<{ cx: number; y: number; v: number }> = [];
    for (let i = 0; i < n; i++) {
      const v = valsL[i];
      if (v === null || !Number.isFinite(v)) continue;
      const y = yFromVal(v, scaleL.min, scaleL.max, innerTop, innerH);
      if (y === null) continue;
      out.push({
        cx: (i + 0.5) * cellW + lineXOffL,
        y,
        v,
      });
    }
    return out;
  }, [
    leftRatio,
    n,
    cellW,
    valsL,
    scaleL.min,
    scaleL.max,
    innerTop,
    innerH,
    lineXOffL,
  ]);

  const linePointsR = useMemo(() => {
    if (!rightRatio) return [];
    const out: Array<{ cx: number; y: number; v: number }> = [];
    for (let i = 0; i < n; i++) {
      const v = valsR[i];
      if (v === null || !Number.isFinite(v)) continue;
      const y = yFromVal(v, scaleR.min, scaleR.max, innerTop, innerH);
      if (y === null) continue;
      out.push({
        cx: (i + 0.5) * cellW + lineXOffR,
        y,
        v,
      });
    }
    return out;
  }, [
    rightRatio,
    n,
    cellW,
    valsR,
    scaleR.min,
    scaleR.max,
    innerTop,
    innerH,
    lineXOffR,
  ]);

  const bars = useMemo(() => {
    const out: ReactNode[] = [];
    for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * cellW;
      const bw = cellW * 0.3;
      const g: ReactNode[] = [];
      if (!leftRatio) {
        const yl = yFromVal(valsL[i], scaleL.min, scaleL.max, innerTop, innerH);
        if (yl !== null && valsL[i] !== null) {
          const bh = axisY - yl;
          g.push(
            <rect
              key="bl"
              x={cx - bw - 1.5}
              y={yl}
              width={bw}
              height={Math.max(bh, 0.5)}
              fill="#38bdf8"
              rx={1}
            />
          );
        }
      }
      if (!rightRatio) {
        const yr = yFromVal(valsR[i], scaleR.min, scaleR.max, innerTop, innerH);
        if (yr !== null && valsR[i] !== null) {
          const bh = axisY - yr;
          g.push(
            <rect
              key="br"
              x={cx + 1.5}
              y={yr}
              width={bw}
              height={Math.max(bh, 0.5)}
              fill="#a78bfa"
              rx={1}
            />
          );
        }
      }
      if (g.length) out.push(<g key={i}>{g}</g>);
    }
    return out;
  }, [
    n,
    cellW,
    innerTop,
    innerH,
    axisY,
    leftRatio,
    rightRatio,
    valsL,
    valsR,
    scaleL,
    scaleR,
  ]);

  /**
   * Y-axis labels use zero-width sticky columns so the SVG stays full chart-th
   * width (week columns stay aligned). Strips overlay the outer ~36px of the plot.
   */
  return (
    <div
      className="relative flex w-full min-w-0 leading-none"
      style={{ minHeight: VB_H }}
    >
      <div
        className="pointer-events-none sticky z-20 w-0 shrink-0 self-stretch overflow-visible"
        style={{ left: metricColumnPx }}
      >
        <div className="flex h-full w-9 flex-col justify-between border-r border-slate-200/90 bg-slate-50/95 py-1 pr-0.5 text-right text-[8px] leading-tight text-slate-400 backdrop-blur-[2px]">
          <span>{fmtAxis(leftMetric, scaleL.max)}</span>
          <span>{fmtAxis(leftMetric, scaleL.min)}</span>
        </div>
      </div>
      <div ref={wrapRef} className="min-w-0 flex-1">
        <svg
          viewBox={`0 0 ${W} ${VB_H}`}
          className="block w-full overflow-visible text-slate-600"
          style={{ height: VB_H }}
          preserveAspectRatio="none"
          role="img"
          aria-label="Scorecard weekly chart"
          onMouseLeave={() => setLineHover(null)}
        >
          <rect
            x={0}
            y={innerTop}
            width={plotW}
            height={innerH}
            fill="#f8fafc"
            rx={2}
          />
          {[0, 0.5, 1].map((t) => {
            const y = innerTop + innerH * (1 - t);
            return (
              <line
                key={t}
                x1={0}
                x2={plotW}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth={0.6}
              />
            );
          })}
          {bars}
          {pathL ? (
            <path
              d={pathL}
              fill="none"
              stroke="#0284c7"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {pathR ? (
            <path
              d={pathR}
              fill="none"
              stroke="#7c3aed"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          <line
            x1={0}
            x2={plotW}
            y1={axisY}
            y2={axisY}
            stroke="#64748b"
            strokeWidth={1.2}
          />
          {linePointsL.map((p, idx) => (
            <circle
              key={`dotL-${idx}`}
              cx={p.cx}
              cy={p.y}
              r={5}
              fill="#ffffff"
              stroke="#0284c7"
              strokeWidth={2}
              className="cursor-pointer"
              onMouseEnter={() =>
                setLineHover({
                  x: p.cx,
                  y: p.y,
                  label: fmtTooltip(leftMetric, p.v),
                  stroke: "#0284c7",
                })
              }
            />
          ))}
          {linePointsR.map((p, idx) => (
            <circle
              key={`dotR-${idx}`}
              cx={p.cx}
              cy={p.y}
              r={5}
              fill="#ffffff"
              stroke="#7c3aed"
              strokeWidth={2}
              className="cursor-pointer"
              onMouseEnter={() =>
                setLineHover({
                  x: p.cx,
                  y: p.y,
                  label: fmtTooltip(rightMetric, p.v),
                  stroke: "#7c3aed",
                })
              }
            />
          ))}
          {lineHover ? (
            <LineHoverCallout
              lineHover={lineHover}
              plotW={plotW}
              innerTop={innerTop}
              axisY={axisY}
            />
          ) : null}
        </svg>
      </div>
      <div className="pointer-events-none sticky right-0 z-20 w-0 shrink-0 self-stretch overflow-visible">
        <div className="flex h-full w-9 -translate-x-full flex-col justify-between border-l border-slate-200/90 bg-slate-50/95 py-1 pl-0.5 text-left text-[8px] leading-tight text-slate-400 backdrop-blur-[2px]">
          <span>{fmtAxis(rightMetric, scaleR.max)}</span>
          <span>{fmtAxis(rightMetric, scaleR.min)}</span>
        </div>
      </div>
    </div>
  );
}
