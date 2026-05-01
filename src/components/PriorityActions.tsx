"use client";

import { useState } from "react";
import type { StageResult } from "@/lib/funnelCompute";
import { FUNNEL_CONSTRAINTS } from "@/content/funnelConstraints";
import { Tooltip } from "@/components/Tooltip";

function formatPercent(rate: number | null) {
  if (rate === null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

const PREVIEW_COUNT = 3;

/** Actions pulled from connection-rate stage when volume pace is the lead issue. */
const VOLUME_LEAD_ACTIONS = (() => {
  const filtered = FUNNEL_CONSTRAINTS.sentToConnected.actions.filter(
    (a) =>
      /volume|daily|request target/i.test(a.title) ||
      /20–40\/day|daily request/i.test(a.summary),
  );
  if (filtered.length > 0) return filtered;
  const fallback = FUNNEL_CONSTRAINTS.sentToConnected.actions.find((a) =>
    /volume/i.test(a.title),
  );
  return fallback ? [fallback] : [];
})();

export function PriorityActions({
  stage,
  stageLabel,
  volumePaceLead,
}: {
  stage: StageResult | null;
  stageLabel: string;
  /** When set, marketing/overall look OK but connection-request pace is weak — surface volume first. */
  volumePaceLead?: "red" | "yellow";
}) {
  const [showAll, setShowAll] = useState(false);
  if (!stage) return null;
  const constraints = FUNNEL_CONSTRAINTS[stage.id];
  const actions = constraints.actions;
  const hasMore = actions.length > PREVIEW_COUNT;
  const visibleActions =
    showAll || !hasMore ? actions : actions.slice(0, PREVIEW_COUNT);

  const volumeLeadTint =
    volumePaceLead === "red"
      ? "border-rose-200 bg-rose-50/90"
      : volumePaceLead === "yellow"
        ? "border-amber-200 bg-amber-50/90"
        : "";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        Your biggest constraint
      </p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
        {volumePaceLead
          ? "Rates can look fine while you’re still under-sending — check volume first."
          : "The funnel stage to fix first (same steps as the cards on the left)."}
      </p>

      {volumePaceLead ? (
        <div
          className={`mt-4 rounded-xl border-l-4 p-4 sm:p-5 ${volumePaceLead === "red" ? "border-l-rose-500" : "border-l-amber-500"} ${volumeLeadTint}`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
            Volume
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
            Connection request pace
          </h2>
          <p className="mt-3 text-base leading-relaxed text-zinc-700">
            Marketing or overall funnel health looks good, but your{" "}
            <span className="font-semibold text-zinc-900">
              connection request volume
            </span>{" "}
            is still{" "}
            {volumePaceLead === "red"
              ? "below a sustainable pace"
              : "short of where we want it"}
            . Fix outbound volume before you optimise messaging or later stages.
          </p>
          {VOLUME_LEAD_ACTIONS.length > 0 ? (
            <ul className="mt-4 space-y-3 border-t border-zinc-200/80 pt-4">
              {VOLUME_LEAD_ACTIONS.map((a) => (
                <li key={a.title}>
                  <div className="text-sm font-semibold text-zinc-900">
                    {a.title}
                  </div>
                  <div className="mt-1 text-sm leading-relaxed text-zinc-700">
                    {a.summary}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <h2
        className={`text-2xl font-semibold tracking-tight text-zinc-950 ${volumePaceLead ? "mt-6" : "mt-3"}`}
      >
        {stageLabel}
      </h2>
      <p className="mt-3 text-base leading-relaxed text-zinc-600">
        {volumePaceLead ? (
          <>
            <span className="font-medium text-zinc-800">Stage metric: </span>
            your rate is{" "}
            <span className="font-semibold text-zinc-900">
              {formatPercent(stage.rate)}
            </span>
            . Target is{" "}
            <span className="font-semibold text-zinc-900">
              {(stage.kpi * 100).toFixed(0)}%
            </span>
            . Address volume above first; then revisit this step if it’s still weak.
          </>
        ) : (
          <>
            Your rate is{" "}
            <span className="font-semibold text-zinc-900">
              {formatPercent(stage.rate)}
            </span>
            . Target is{" "}
            <span className="font-semibold text-zinc-900">
              {(stage.kpi * 100).toFixed(0)}%
            </span>
            . Fix this step first before optimising the rest.
          </>
        )}
      </p>

      <div className="mt-5 rounded-xl bg-zinc-50 p-4 sm:p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          What to do next
        </div>
        <ul className="mt-3 space-y-4">
          {visibleActions.map((a) => (
            <li key={a.title}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-900">
                    {a.title}
                  </div>
                  <div className="mt-1 text-sm leading-relaxed text-zinc-700">
                    {a.summary}
                  </div>
                  {a.details ? (
                    <div className="mt-1 text-sm leading-relaxed text-zinc-600">
                      {a.details}
                    </div>
                  ) : null}
                </div>
                {a.tooltip ? (
                  <Tooltip label={a.tooltip}>
                    <button
                      type="button"
                      className="shrink-0 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      Why?
                    </button>
                  </Tooltip>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {hasMore ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-4 text-sm font-medium text-blue-700 hover:text-blue-800 focus:outline-none focus:underline"
          >
            {showAll
              ? "Show fewer"
              : `Show ${actions.length - PREVIEW_COUNT} more`}
          </button>
        ) : null}
      </div>
    </div>
  );
}
