"use client";

import type { FunnelStatus } from "@/lib/funnelCompute";

const VIEW = 120;
/** Trim empty space below the arc so the dial doesn’t sit in a tall empty box. */
const VIEW_BOTTOM_TRIM = 96;
const START_DEG = 150;
const SWEEP_DEG = 240;

function degToRad(d: number) {
  return (d * Math.PI) / 180;
}

function pointOnCircle(cx: number, cy: number, r: number, deg: number) {
  const rad = degToRad(deg);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPathD(r: number, cx: number, cy: number) {
  const p0 = pointOnCircle(cx, cy, r, START_DEG);
  const p1 = pointOnCircle(cx, cy, r, START_DEG + SWEEP_DEG);
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 1 1 ${p1.x} ${p1.y}`;
}

function angleAtFraction(f: number) {
  return START_DEG + Math.min(1, Math.max(0, f)) * SWEEP_DEG;
}

function statusStrokeClass(status: FunnelStatus): string {
  switch (status) {
    case "green":
      return "stroke-emerald-500";
    case "yellow":
      return "stroke-amber-500";
    case "red":
      return "stroke-rose-500";
    default:
      return "stroke-zinc-400";
  }
}

function sentimentTextClass(status: FunnelStatus): string {
  switch (status) {
    case "green":
      return "text-emerald-600";
    case "yellow":
      return "text-amber-600";
    case "red":
      return "text-rose-600";
    default:
      return "text-zinc-500";
  }
}

export function RadialGauge({
  label,
  rate,
  kpiTarget,
  dialMax,
  status,
  embedded = false,
  sentimentLabel,
  percentDecimals = 1,
}: {
  label: string;
  rate: number | null;
  kpiTarget: number;
  dialMax: number;
  status: FunnelStatus;
  embedded?: boolean;
  sentimentLabel?: string;
  percentDecimals?: number;
}) {
  const cx = VIEW / 2;
  const cy = VIEW / 2;
  const rTrack = 44;
  const rTrackOuter = rTrack + 7;
  const rTickInner = rTrack - 1;

  const pathD = arcPathD(rTrack, cx, cy);

  const fillRatio =
    rate === null || dialMax <= 0
      ? 0
      : Math.min(1, Math.max(0, rate / dialMax));

  const kpiFraction =
    dialMax <= 0 ? 0 : Math.min(1, Math.max(0, kpiTarget / dialMax));
  const kpiAngle = angleAtFraction(kpiFraction);
  const tp0 = pointOnCircle(cx, cy, rTickInner, kpiAngle);
  const tp1 = pointOnCircle(cx, cy, rTrackOuter, kpiAngle);

  const rateStr =
    rate === null ? "—" : `${(rate * 100).toFixed(percentDecimals)}%`;
  const kpiStr = `${(kpiTarget * 100).toFixed(percentDecimals)}%`;
  const scaleStr = `${(dialMax * 100).toFixed(percentDecimals)}%`;

  const svgPaths = (
    <>
      <path
        d={pathD}
        fill="none"
        className="stroke-zinc-200"
        strokeWidth="12"
        strokeLinecap="round"
        pathLength={100}
      />

      <path
        d={pathD}
        fill="none"
        className={statusStrokeClass(status)}
        strokeWidth="12"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${fillRatio * 100} 100`}
      />

      <line
        x1={tp0.x}
        y1={tp0.y}
        x2={tp1.x}
        y2={tp1.y}
        className="stroke-zinc-900"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </>
  );

  const viewH = embedded ? VIEW_BOTTOM_TRIM : VIEW;

  const dialShell = (
    <div
      className={
        embedded
          ? "relative mx-auto w-full max-w-[240px]"
          : "relative mx-auto w-full max-w-[260px] min-h-[200px]"
      }
    >
      <svg
        className="mx-auto block h-auto w-full"
        viewBox={`0 0 ${VIEW} ${viewH}`}
        preserveAspectRatio="xMidYMin meet"
        aria-hidden
      >
        {svgPaths}
      </svg>

      {/* Score + KPI + status: one column, vertically centred in the dial then shifted down into the arc hollow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex w-[min(100%,11rem)] translate-y-10 flex-col items-center text-center sm:translate-y-12">
          <div className="text-2xl font-bold tabular-nums leading-none tracking-tight text-zinc-900 sm:text-[1.75rem]">
            {rateStr}
          </div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
            KPI {kpiStr}
          </div>
          {sentimentLabel ? (
            <div
              className={`mt-[18%] text-base font-semibold leading-tight sm:text-lg ${sentimentTextClass(status)}`}
            >
              {sentimentLabel}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  const captionBlock = (
    <div className="mt-1.5 space-y-0.5 text-center">
      <div className="text-sm font-semibold leading-snug text-zinc-900">
        {label}
      </div>
      <div className="text-xs font-medium text-zinc-500">
        Scale ends at {scaleStr}
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div
        className="flex w-full max-w-[280px] flex-col items-stretch bg-transparent"
        role="img"
        aria-label={`${label}: ${rate === null ? "no data" : rateStr}, KPI ${kpiStr}, dial scale to ${scaleStr}, ${status}`}
      >
        {dialShell}
        {captionBlock}
      </div>
    );
  }

  return (
    <div
      className="flex w-full max-w-[280px] flex-col items-stretch rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-sm"
      role="img"
      aria-label={`${label}: ${rate === null ? "no data" : rateStr}, KPI ${kpiStr}, dial scale to ${scaleStr}, ${status}`}
    >
      {dialShell}
      {captionBlock}
    </div>
  );
}
