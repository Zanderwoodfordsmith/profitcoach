"use client";

import { useId } from "react";
import {
  BOSS_PRO_HERO_RING_GRADIENT,
  BOSS_PRO_HERO_SCORE_TEXT_GRADIENT,
  BOSS_PRO_RING_TRACK,
  BOSS_PILLAR_DIAL_GRADIENTS,
} from "@/lib/bossProDialGradients";

export type CampaignDialMetric = {
  id: string;
  label: string;
  numerator: number;
  denominator: number;
  /** Optional helper under the label, e.g. "Invited of added" */
  hint?: string;
};

export type CampaignActivityDay = {
  date: string;
  invite: number;
  accepted: number;
  message: number;
  engagement: number;
  total: number;
};

function svgCoord(n: number): number {
  return Number(n.toFixed(3));
}

function describeProgressArc(
  cx: number,
  cy: number,
  radius: number,
  pct: number
): { path: string | null; x0: number; y0: number; x1: number; y1: number } {
  if (pct <= 0) {
    return { path: null, x0: cx, y0: cy - radius, x1: cx, y1: cy - radius };
  }
  const startAngle = -Math.PI / 2;
  const sweep = Math.min((pct / 100) * 2 * Math.PI, 2 * Math.PI * 0.9999);
  const endAngle = startAngle + sweep;
  const x0 = cx + radius * Math.cos(startAngle);
  const y0 = cy + radius * Math.sin(startAngle);
  const x1 = cx + radius * Math.cos(endAngle);
  const y1 = cy + radius * Math.sin(endAngle);
  const largeArc = sweep > Math.PI ? 1 : 0;
  return {
    path: `M ${svgCoord(x0)} ${svgCoord(y0)} A ${svgCoord(radius)} ${svgCoord(radius)} 0 ${largeArc} 1 ${svgCoord(x1)} ${svgCoord(y1)}`,
    x0,
    y0,
    x1,
    y1,
  };
}

const DIAL_CARD_SHELL =
  "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.015)]";

const CARD_HEADER =
  "border-b border-slate-600/40 bg-slate-700 px-4 py-2.5 text-sm font-semibold tracking-wide text-white";

const DIAL_GRADIENTS = [
  BOSS_PRO_HERO_RING_GRADIENT.stops,
  BOSS_PILLAR_DIAL_GRADIENTS.vision.stops,
  BOSS_PILLAR_DIAL_GRADIENTS.velocity.stops,
] as const;

function CampaignStrokeDial({
  label,
  numerator,
  denominator,
  hint,
  gradientStops,
  emphasize = false,
}: CampaignDialMetric & {
  gradientStops: readonly { offset: string; color: string }[];
  emphasize?: boolean;
}) {
  const gradId = useId().replace(/:/g, "");
  const viewSize = 420;
  const stroke = emphasize ? 34 : 30;
  const cx = viewSize / 2;
  const cy = viewSize / 2;
  const radius = (viewSize - stroke) / 2;
  const pct =
    denominator > 0
      ? Math.min(100, Math.round((numerator / denominator) * 100))
      : 0;
  const { path: progressPath, x0, y0, x1, y1 } = describeProgressArc(
    cx,
    cy,
    radius,
    pct
  );
  const fraction = `${numerator}/${denominator}`;

  return (
    <div
      className="flex flex-col items-center justify-center px-3 py-4 sm:px-4 sm:py-5"
      role="img"
      aria-label={`${label}: ${pct} percent, ${fraction}`}
    >
      <div
        className={`relative shrink-0 ${
          emphasize
            ? "h-[8.5rem] w-[8.5rem] sm:h-[9.5rem] sm:w-[9.5rem]"
            : "h-[7.5rem] w-[7.5rem] sm:h-[8.5rem] sm:w-[8.5rem]"
        }`}
      >
        <svg className="h-full w-full" viewBox={`0 0 ${viewSize} ${viewSize}`}>
          <defs>
            {progressPath ? (
              <linearGradient
                id={gradId}
                gradientUnits="userSpaceOnUse"
                x1={svgCoord(x0)}
                y1={svgCoord(y0)}
                x2={svgCoord(x1)}
                y2={svgCoord(y1)}
              >
                {gradientStops.map((stop) => (
                  <stop
                    key={stop.offset}
                    offset={stop.offset}
                    stopColor={stop.color}
                  />
                ))}
              </linearGradient>
            ) : null}
          </defs>
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={BOSS_PRO_RING_TRACK}
            strokeWidth={stroke}
          />
          {progressPath ? (
            <path
              d={progressPath}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={stroke}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="inline-flex items-baseline leading-none">
            <span
              className={`font-semibold tabular-nums tracking-tight ${
                emphasize
                  ? "text-[1.75rem] sm:text-[2rem]"
                  : "text-[1.45rem] sm:text-[1.75rem]"
              }`}
              style={{
                background: BOSS_PRO_HERO_SCORE_TEXT_GRADIENT,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {pct}
            </span>
            <span className="ml-0.5 text-[0.7rem] font-medium text-slate-500 sm:text-sm">
              %
            </span>
          </span>
          <span className="mt-1 text-[11px] font-medium tabular-nums text-slate-500">
            {fraction}
          </span>
        </div>
      </div>
      <div className="mt-3 flex max-w-[10rem] flex-col items-center gap-1.5 text-center sm:mt-4">
        <span
          className="h-0.5 w-9 shrink-0 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${gradientStops[0]?.color}, ${gradientStops[gradientStops.length - 1]?.color})`,
          }}
          aria-hidden
        />
        <span className="text-sm font-semibold leading-snug text-slate-800">
          {label}
        </span>
        {hint ? (
          <span className="text-[11px] leading-snug text-slate-500">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}

export function CampaignMetricDial(props: CampaignDialMetric) {
  return (
    <CampaignStrokeDial
      {...props}
      gradientStops={DIAL_GRADIENTS[0]}
      emphasize
    />
  );
}

/** Dense table-row dial: ~32px ring with % in the centre. */
export function CampaignCompactDial({
  label,
  numerator,
  denominator,
  showFraction = false,
  muted = false,
}: {
  label: string;
  numerator: number;
  denominator: number;
  showFraction?: boolean;
  /** Grey out when the metric does not apply (e.g. no invite step). */
  muted?: boolean;
}) {
  const gradId = useId().replace(/:/g, "");
  const viewSize = 120;
  const stroke = 12;
  const cx = viewSize / 2;
  const cy = viewSize / 2;
  const radius = (viewSize - stroke) / 2;
  const pct =
    denominator > 0
      ? Math.min(100, Math.round((numerator / denominator) * 100))
      : 0;
  const { path: progressPath, x0, y0, x1, y1 } = describeProgressArc(
    cx,
    cy,
    radius,
    muted ? 0 : pct
  );
  const fraction = `${numerator}/${denominator}`;
  const stops = DIAL_GRADIENTS[0];

  return (
    <div
      className={`flex flex-col items-center gap-1 ${muted ? "opacity-40" : ""}`}
      role="img"
      aria-label={
        muted
          ? `${label}: not applicable`
          : `${label}: ${pct} percent${showFraction ? `, ${fraction}` : ""}`
      }
      title={
        muted
          ? `${label}: n/a`
          : showFraction
            ? `${label}: ${pct}% (${fraction})`
            : `${label}: ${pct}%`
      }
    >
      <div className="relative h-9 w-9 shrink-0">
        <svg className="h-full w-full" viewBox={`0 0 ${viewSize} ${viewSize}`}>
          <defs>
            {progressPath ? (
              <linearGradient
                id={gradId}
                gradientUnits="userSpaceOnUse"
                x1={svgCoord(x0)}
                y1={svgCoord(y0)}
                x2={svgCoord(x1)}
                y2={svgCoord(y1)}
              >
                {stops.map((stop) => (
                  <stop
                    key={stop.offset}
                    offset={stop.offset}
                    stopColor={stop.color}
                  />
                ))}
              </linearGradient>
            ) : null}
          </defs>
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={BOSS_PRO_RING_TRACK}
            strokeWidth={stroke}
          />
          {progressPath ? (
            <path
              d={progressPath}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={stroke}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-semibold tabular-nums leading-none text-slate-700">
            {muted ? "—" : pct}
          </span>
        </div>
      </div>
      {showFraction ? (
        <span className="text-[10px] tabular-nums leading-none text-slate-500">
          {muted ? "—" : fraction}
        </span>
      ) : null}
    </div>
  );
}

export function CampaignDialsPanel({ dials }: { dials: CampaignDialMetric[] }) {
  return (
    <div className={DIAL_CARD_SHELL}>
      <div className={CARD_HEADER}>Campaign health</div>
      <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {dials.map((dial, i) => (
          <CampaignStrokeDial
            key={dial.id}
            {...dial}
            gradientStops={DIAL_GRADIENTS[i] ?? DIAL_GRADIENTS[0]}
            emphasize={i === 0}
          />
        ))}
      </div>
    </div>
  );
}

const STACK_COLORS = {
  invite: "#0c5290",
  accepted: "#22c55e",
  message: "#42a1ee",
  engagement: "#1ca0c2",
} as const;

const BAR_MAX_PX = 148;

function shortDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function CampaignDailyStackChart({
  buckets,
}: {
  buckets: CampaignActivityDay[];
}) {
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const hasAny = buckets.some((b) => b.total > 0);

  return (
    <div className={DIAL_CARD_SHELL}>
      <div className={CARD_HEADER}>Daily activity</div>
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-slate-500">
          <li className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: STACK_COLORS.invite }}
            />
            Invites sent
          </li>
          <li className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: STACK_COLORS.accepted }}
            />
            Accepted
          </li>
          <li className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: STACK_COLORS.message }}
            />
            Messages
          </li>
          <li className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: STACK_COLORS.engagement }}
            />
            Engagement
          </li>
        </ul>

        {!hasAny ? (
          <p className="py-10 text-center text-sm text-slate-500">
            No sends yet — invites and accepts will show here once the campaign
            runs.
          </p>
        ) : (
          <div
            className="flex items-end gap-1 sm:gap-1.5"
            style={{ height: BAR_MAX_PX }}
          >
            {buckets.map((b) => {
              const px =
                b.total > 0
                  ? Math.max(10, Math.round((b.total / max) * BAR_MAX_PX))
                  : 0;
              return (
                <div
                  key={b.date}
                  className="flex min-w-0 flex-1 flex-col items-center justify-end"
                  title={`${shortDay(b.date)}: ${b.invite} invites, ${b.accepted} accepted, ${b.message} messages, ${b.engagement} engagement`}
                >
                  <div
                    className="flex w-full max-w-[32px] flex-col-reverse overflow-hidden rounded-t-md"
                    style={{ height: px }}
                  >
                    {b.invite > 0 ? (
                      <div
                        style={{
                          background: STACK_COLORS.invite,
                          height: `${(b.invite / b.total) * 100}%`,
                        }}
                      />
                    ) : null}
                    {b.accepted > 0 ? (
                      <div
                        style={{
                          background: STACK_COLORS.accepted,
                          height: `${(b.accepted / b.total) * 100}%`,
                        }}
                      />
                    ) : null}
                    {b.message > 0 ? (
                      <div
                        style={{
                          background: STACK_COLORS.message,
                          height: `${(b.message / b.total) * 100}%`,
                        }}
                      />
                    ) : null}
                    {b.engagement > 0 ? (
                      <div
                        style={{
                          background: STACK_COLORS.engagement,
                          height: `${(b.engagement / b.total) * 100}%`,
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasAny ? (
          <div className="mt-2 flex gap-1 sm:gap-1.5">
            {buckets.map((b, i) => {
              const show =
                i === 0 ||
                i === buckets.length - 1 ||
                i % Math.ceil(buckets.length / 6) === 0;
              return (
                <span
                  key={b.date}
                  className="min-w-0 flex-1 text-center text-[9px] tabular-nums text-slate-400"
                >
                  {show ? b.date.slice(5).replace("-", "/") : ""}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Build 2–3 adaptive dials from campaign lead statuses + step types. */
export function buildCampaignDials(input: {
  leads: Array<{ status: string; interest_outcome?: string | null }>;
  hasInviteStep: boolean;
}): CampaignDialMetric[] {
  const { leads, hasInviteStep } = input;
  const total = leads.length;

  const invitedOrBeyond = leads.filter((l) =>
    [
      "invited",
      "connected",
      "in_sequence",
      "replied",
      "interested",
      "assessment_sent",
      "assessment_done",
      "call_offered",
      "completed",
      "paused",
    ].includes(l.status)
  ).length;

  const connectedOrBeyond = leads.filter((l) =>
    [
      "connected",
      "in_sequence",
      "replied",
      "interested",
      "assessment_sent",
      "assessment_done",
      "call_offered",
      "completed",
    ].includes(l.status)
  ).length;

  const messagedOrBeyond = leads.filter((l) =>
    [
      "in_sequence",
      "replied",
      "interested",
      "assessment_sent",
      "assessment_done",
      "call_offered",
      "completed",
    ].includes(l.status)
  ).length;

  const repliedUnique = leads.filter(
    (l) =>
      l.status === "replied" ||
      l.status === "interested" ||
      l.interest_outcome === "positive"
  ).length;

  const interested = leads.filter(
    (l) =>
      l.interest_outcome === "positive" ||
      l.status === "interested" ||
      l.status === "assessment_sent" ||
      l.status === "assessment_done" ||
      l.status === "call_offered"
  ).length;

  const dials: CampaignDialMetric[] = [
    {
      id: "volume",
      label: "Volume",
      hint: "Reached of prospects added",
      numerator: invitedOrBeyond,
      denominator: total,
    },
  ];

  if (hasInviteStep) {
    dials.push({
      id: "connect",
      label: "Connect rate",
      hint: "Accepted of invites sent",
      numerator: connectedOrBeyond,
      denominator: invitedOrBeyond,
    });
  } else {
    dials.push({
      id: "reach",
      label: "Reached",
      hint: "Messaged of prospects added",
      numerator: messagedOrBeyond,
      denominator: total,
    });
  }

  const replyDenom = hasInviteStep
    ? connectedOrBeyond
    : messagedOrBeyond || invitedOrBeyond;

  if (interested > 0) {
    dials.push({
      id: "interest",
      label: "Interest rate",
      hint: "Interested of connected",
      numerator: interested,
      denominator: replyDenom,
    });
  } else {
    dials.push({
      id: "reply",
      label: "Reply rate",
      hint: hasInviteStep
        ? "Replied of connected"
        : "Replied of reached",
      numerator: repliedUnique,
      denominator: replyDenom,
    });
  }

  return dials.slice(0, 3);
}
