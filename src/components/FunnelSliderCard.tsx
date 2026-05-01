import type { FunnelStatus } from "@/lib/funnelCompute";
import { Tooltip } from "@/components/Tooltip";
import React from "react";

export interface FunnelSliderCardProps {
  stepNumber: number;
  title: string;
  description: string;
  value: string;
  onChange: (val: string) => void;
  max: number;
  rate: number | null;
  targetRate: number | null;
  status: FunnelStatus;
  /** When `rate` is null, replaces the default “COUNT” label under the headline number. */
  countSubtitle?: string;
  /** 0–100: vertical goal marker on the count bar (e.g. 75 for 75% along the track). */
  countGoalMarkerPercent?: number;
  issueMessage?: string;
  icon: React.ReactNode;
}

export const FunnelSliderCard = React.forwardRef<
  HTMLDivElement,
  FunnelSliderCardProps
>(function FunnelSliderCard(
  {
    stepNumber,
    title,
    description,
    value,
    onChange,
    max,
    rate,
    targetRate,
    status,
    countSubtitle,
    countGoalMarkerPercent,
    issueMessage,
    icon,
  },
  ref,
) {
  let textClass = "text-zinc-900";
  let bgFillClass = "bg-zinc-800";
  let iconBgClass = "bg-zinc-800";
  let progressBg = "bg-zinc-100";

  if (status === "green") {
    textClass = "text-emerald-600";
    bgFillClass = "bg-emerald-500";
    iconBgClass = "bg-emerald-500";
    progressBg = "bg-emerald-50";
  } else if (status === "yellow") {
    textClass = "text-amber-500";
    bgFillClass = "bg-amber-400";
    iconBgClass = "bg-amber-500";
    progressBg = "bg-amber-50";
  } else if (status === "red") {
    textClass = "text-rose-500";
    bgFillClass = "bg-rose-500";
    iconBgClass = "bg-rose-500";
    progressBg = "bg-rose-50";
  } else if (status === "na") {
    textClass = "text-zinc-400";
    bgFillClass = "bg-zinc-300";
    iconBgClass = "bg-zinc-300";
    progressBg = "bg-zinc-100";
  }

  const numericValue = value === "" ? 0 : parseInt(value, 10);
  const percentFill =
    max > 0 ? Math.min(100, Math.max(0, (numericValue / max) * 100)) : 0;

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition-all ${
        issueMessage
          ? "border-rose-300 ring-1 ring-rose-100"
          : "border-zinc-200"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${iconBgClass}`}
          >
            {icon}
          </div>
          <div>
            <div
              className={`text-[10px] font-bold uppercase tracking-widest ${
                status === "na" ? "text-zinc-400" : textClass
              }`}
            >
              STAGE {stepNumber}
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
              <Tooltip label={description}>
                <span
                  tabIndex={0}
                  role="button"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-200 bg-white text-[10px] font-semibold text-zinc-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                  aria-label={`${title} info`}
                >
                  i
                </span>
              </Tooltip>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold tracking-tight ${textClass}`}>
            {rate !== null ? `${(rate * 100).toFixed(0)}%` : numericValue}
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
            {targetRate !== null
              ? `TARGET: ${(targetRate * 100).toFixed(0)}%`
              : (countSubtitle ?? "COUNT")}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div className="relative flex h-3 flex-1 items-center">
          {/* Custom Track Background */}
          <div className={`absolute inset-0 rounded-full ${progressBg}`} />

          {/* Custom Fill */}
          <div
            className={`absolute left-0 top-0 h-full rounded-full ${bgFillClass} transition-all duration-200 ease-out`}
            style={{ width: `${percentFill}%` }}
          />

          {/* Target Marker (rate stages) */}
          {targetRate !== null && max > 0 && (
            <div
              className="absolute z-10 h-4 w-1 -translate-y-1/2 rounded-full bg-zinc-800"
              style={{ left: `${targetRate * 100}%`, top: "50%" }}
              title={`Target: ${(targetRate * 100).toFixed(0)}%`}
            />
          )}

          {/* Goal marker (count stages, e.g. connection requests) */}
          {targetRate === null &&
            countGoalMarkerPercent != null &&
            max > 0 && (
              <div
                className="absolute z-10 h-4 w-1 -translate-y-1/2 rounded-full bg-zinc-800"
                style={{
                  left: `${Math.min(100, Math.max(0, countGoalMarkerPercent))}%`,
                  top: "50%",
                }}
                title={`Goal: ${countGoalMarkerPercent}% of bar`}
              />
            )}

          {/* Invisible Native Slider for Interaction */}
          <input
            type="range"
            min={0}
            max={max}
            value={numericValue}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 z-20 h-full w-full cursor-pointer appearance-none opacity-0"
            title={`Slide to adjust ${title}`}
          />
        </div>
        <div className="w-20 shrink-0">
          <input
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-right text-sm font-semibold tabular-nums text-zinc-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            placeholder="0"
          />
        </div>
      </div>

      {issueMessage && (
        <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-rose-600">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          {issueMessage}
        </div>
      )}
    </div>
  );
});
