"use client";

import {
  CampaignDialsPanel,
  type CampaignDialMetric,
} from "@/components/campaigns/CampaignOverviewMetrics";
import {
  MAGNET_STAGE_LABEL,
  type MagnetAudience,
  type MagnetStage,
} from "@/lib/leadMagnets/audienceTypes";

const STAGE_COLOR: Record<MagnetStage, string> = {
  opted_in: "#94a3b8",
  started: "#2b8fd6",
  completed: "#0c5290",
};

const CARD =
  "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.015)]";

type Props = {
  audience: MagnetAudience | null;
  loading: boolean;
  showOptInRate: boolean;
  onOpenStage: (stage: MagnetStage) => void;
  onViewPeople: () => void;
};

function StageDonut({
  rows,
  total,
}: {
  rows: Array<{ stage: MagnetStage; count: number; color: string }>;
  total: number;
}) {
  const viewSize = 180;
  const stroke = 28;
  const cx = viewSize / 2;
  const cy = viewSize / 2;
  const radius = (viewSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const segments =
    total > 0
      ? rows.map((row) => {
          const length = (row.count / total) * circumference;
          const segment = { ...row, length, offset };
          offset += length;
          return segment;
        })
      : [];

  return (
    <svg
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      className="h-36 w-36 shrink-0"
      aria-hidden
    >
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={stroke}
      />
      {segments.map((segment) => (
        <circle
          key={segment.stage}
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={segment.color}
          strokeWidth={stroke}
          strokeDasharray={`${segment.length} ${circumference - segment.length}`}
          strokeDashoffset={-segment.offset}
          strokeLinecap="butt"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      ))}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#0f172a"
        style={{ fontSize: 28, fontWeight: 600 }}
      >
        {total}
      </text>
    </svg>
  );
}

export function LeadMagnetOverview({
  audience,
  loading,
  showOptInRate,
  onOpenStage,
  onViewPeople,
}: Props) {
  if (loading || !audience) {
    return (
      <div className="rounded-2xl border border-slate-200 px-6 py-16 text-center text-sm text-slate-500">
        Loading overview…
      </div>
    );
  }

  const rows = (["opted_in", "started", "completed"] as const)
    .map((stage) => ({
      stage,
      label: MAGNET_STAGE_LABEL[stage],
      count: audience.stages[stage],
      color: STAGE_COLOR[stage],
    }))
    .filter((row) => row.count > 0);

  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const dials: CampaignDialMetric[] = [];

  if (showOptInRate) {
    dials.push({
      id: "opt-in",
      label: "Opted in",
      numerator: audience.opt_ins,
      denominator: audience.unique_views,
      hint: "of views",
    });
  }

  dials.push({
    id: "completed",
    label: "Completed",
    numerator: audience.stages.completed,
    denominator: audience.started_total,
    hint: "of people who started",
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
      <div className={`${CARD} flex h-full flex-col`}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-600/40 bg-slate-700 px-4 py-2.5">
          <h2 className="text-sm font-semibold tracking-wide text-white">
            By stage
          </h2>
          {total > 0 ? (
            <button
              type="button"
              onClick={onViewPeople}
              className="text-xs font-medium text-sky-200 hover:text-white"
            >
              View all
            </button>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col px-4 py-5 sm:px-5">
          {total === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No one has come through in this range.
            </p>
          ) : (
            <div className="flex flex-1 flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
              <StageDonut rows={rows} total={total} />
              <ul className="w-full max-w-xs">
                {rows.map((row) => (
                  <li key={row.stage}>
                    <button
                      type="button"
                      onClick={() => onOpenStage(row.stage)}
                      className="flex w-full items-center justify-between gap-3 rounded-md px-1 py-1.5 text-left text-[15px] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
                    >
                      <span className="flex min-w-0 items-center gap-2.5 font-medium text-slate-700">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: row.color }}
                          aria-hidden
                        />
                        <span className="truncate">{row.label}</span>
                      </span>
                      <span className="text-base font-semibold tabular-nums text-slate-900">
                        {row.count}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <CampaignDialsPanel dials={dials} />
    </div>
  );
}
