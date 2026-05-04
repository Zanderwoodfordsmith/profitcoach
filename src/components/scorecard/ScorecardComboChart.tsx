"use client";

import { useMemo, type ReactNode } from "react";
import { rowWeeklyValue } from "@/lib/scorecardCompute";
import type { ScorecardManualWeek } from "@/lib/scorecardManual";
import { chartUnitForRow, type ScorecardRowId } from "@/lib/scorecardTargets";

export const SCORECARD_VISIBLE_WEEKS = 16;

type Props = {
  weekStarts: string[];
  weeks: Partial<ScorecardManualWeek>[];
  leftMetric: ScorecardRowId;
  rightMetric: ScorecardRowId;
};

function shortWeekLabel(iso: string) {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

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

function buildScale(
  rowId: ScorecardRowId,
  vals: (number | null)[]
): { min: number; max: number } {
  const isRatio = chartUnitForRow(rowId) === "ratio";
  const nums = vals.filter((v): v is number => v !== null && Number.isFinite(v));
  if (nums.length === 0) {
    return isRatio ? { min: 0, max: 1 } : { min: 0, max: 1 };
  }
  let min = Math.min(...nums);
  let max = Math.max(...nums);
  if (isRatio) {
    min = Math.max(0, min);
    max = Math.min(1, Math.max(max, min + 0.05));
  }
  if (max - min < 1e-9) {
    max = min + (isRatio ? 0.05 : 1);
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
  padL: number,
  cellW: number,
  innerTop: number,
  innerH: number
): string {
  let d = "";
  for (let i = 0; i < vals.length; i++) {
    const y = yFromVal(vals[i], min, max, innerTop, innerH);
    if (y === null) continue;
    const x = padL + (i + 0.5) * cellW;
    d += d === "" ? `M${x},${y}` : `L${x},${y}`;
  }
  return d;
}

export function ScorecardComboChart({
  weekStarts,
  weeks,
  leftMetric,
  rightMetric,
}: Props) {
  const n = weekStarts.length;
  const valsL = weekStarts.map((_, i) =>
    rowWeeklyValue(leftMetric, weeks[i] ?? {})
  );
  const valsR = weekStarts.map((_, i) =>
    rowWeeklyValue(rightMetric, weeks[i] ?? {})
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

  const CW = 22;
  const W = Math.max(360, n * CW + 88);
  const H = 132;
  const padL = 46;
  const padR = 46;
  const padT = 6;
  const padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const cellW = innerW / Math.max(1, n);

  const pathL = useMemo(
    () =>
      leftRatio
        ? polylinePath(valsL, scaleL.min, scaleL.max, padL, cellW, padT, innerH)
        : "",
    [leftRatio, valsL, scaleL, padL, cellW, padT, innerH]
  );
  const pathR = useMemo(
    () =>
      rightRatio
        ? polylinePath(valsR, scaleR.min, scaleR.max, padL, cellW, padT, innerH)
        : "",
    [rightRatio, valsR, scaleR, padL, cellW, padT, innerH]
  );

  const bars = useMemo(() => {
    const out: ReactNode[] = [];
    for (let i = 0; i < n; i++) {
      const cx = padL + (i + 0.5) * cellW;
      const bw = cellW * 0.3;
      const g: ReactNode[] = [];
      if (!leftRatio) {
        const yl = yFromVal(valsL[i], scaleL.min, scaleL.max, padT, innerH);
        if (yl !== null && valsL[i] !== null) {
          const bh = padT + innerH - yl;
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
        const yr = yFromVal(valsR[i], scaleR.min, scaleR.max, padT, innerH);
        if (yr !== null && valsR[i] !== null) {
          const bh = padT + innerH - yr;
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
    padL,
    cellW,
    padT,
    innerH,
    leftRatio,
    rightRatio,
    valsL,
    valsR,
    scaleL,
    scaleR,
  ]);

  return (
    <div className="w-full min-w-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-32 w-full text-slate-600"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Scorecard weekly chart"
      >
        <rect
          x={padL}
          y={padT}
          width={innerW}
          height={innerH}
          fill="#f8fafc"
          rx={4}
        />
        {[0, 0.5, 1].map((t) => {
          const y = padT + innerH * (1 - t);
          return (
            <line
              key={t}
              x1={padL}
              x2={padL + innerW}
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
        {weekStarts.map((iso, i) => {
          const x = padL + (i + 0.5) * cellW;
          return (
            <text
              key={iso}
              x={x}
              y={H - 4}
              textAnchor="middle"
              className="fill-slate-500 text-[9px]"
            >
              {shortWeekLabel(iso)}
            </text>
          );
        })}
        <text x={4} y={padT + 10} className="fill-slate-400 text-[8px]">
          {fmtAxis(leftMetric, scaleL.max)}
        </text>
        <text x={4} y={padT + innerH} className="fill-slate-400 text-[8px]">
          {fmtAxis(leftMetric, scaleL.min)}
        </text>
        <text
          x={W - 4}
          y={padT + 10}
          textAnchor="end"
          className="fill-slate-400 text-[8px]"
        >
          {fmtAxis(rightMetric, scaleR.max)}
        </text>
        <text
          x={W - 4}
          y={padT + innerH}
          textAnchor="end"
          className="fill-slate-400 text-[8px]"
        >
          {fmtAxis(rightMetric, scaleR.min)}
        </text>
      </svg>
    </div>
  );
}
