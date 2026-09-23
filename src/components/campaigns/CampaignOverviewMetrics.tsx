"use client";

import {
  BOSS_PRO_HERO_RING_GRADIENT,
  BOSS_PRO_HERO_SCORE_TEXT_GRADIENT,
  BOSS_PRO_RING_TRACK,
  BOSS_PILLAR_DIAL_GRADIENTS,
} from "@/lib/bossProDialGradients";
import { leadStatusLabel } from "@/lib/unipile/campaignLeadActivity";

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

type DialGradientStop = { offset: string; color: string };

function mixHex(a: string, b: string, t: number): string {
  const ah = a.replace("#", "");
  const bh = b.replace("#", "");
  const lerp = (from: number, to: number) =>
    Math.round(from + (to - from) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${lerp(parseInt(ah.slice(0, 2), 16), parseInt(bh.slice(0, 2), 16))}${lerp(
    parseInt(ah.slice(2, 4), 16),
    parseInt(bh.slice(2, 4), 16)
  )}${lerp(parseInt(ah.slice(4, 6), 16), parseInt(bh.slice(4, 6), 16))}`;
}

function colorAlongStops(
  stops: readonly DialGradientStop[],
  t: number
): string {
  const pts = stops.map((s) => ({
    t: parseFloat(s.offset) / 100,
    color: s.color,
  }));
  if (t <= pts[0].t) return pts[0].color;
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i].t) {
      const span = pts[i].t - pts[i - 1].t;
      const local = span === 0 ? 1 : (t - pts[i - 1].t) / span;
      return mixHex(pts[i - 1].color, pts[i].color, local);
    }
  }
  return pts[pts.length - 1].color;
}

/**
 * Paint the filled arc as many short strokes so the brand blue
 * travels along the ring (dark → sky). A 2-stop linearGradient from
 * the arc’s start to end splits a high-% ring into two halves.
 */
function SweepGradientArc({
  cx,
  cy,
  radius,
  pct,
  strokeWidth,
  stops,
}: {
  cx: number;
  cy: number;
  radius: number;
  pct: number;
  strokeWidth: number;
  stops: readonly DialGradientStop[];
}) {
  if (pct <= 0) return null;
  const start = -Math.PI / 2;
  const sweep = Math.min((pct / 100) * 2 * Math.PI, 2 * Math.PI * 0.999);
  const n = Math.max(10, Math.round((pct / 100) * 48));
  const overlap = sweep / n / 4;
  const parts = [];
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const a0 = start + sweep * t0 - (i === 0 ? 0 : overlap);
    const a1 = start + sweep * t1 + (i === n - 1 ? 0 : overlap);
    const x0 = cx + radius * Math.cos(a0);
    const y0 = cy + radius * Math.sin(a0);
    const x1 = cx + radius * Math.cos(a1);
    const y1 = cy + radius * Math.sin(a1);
    const cap = i === 0 || i === n - 1 ? "round" : "butt";
    parts.push(
      <path
        key={i}
        d={`M ${svgCoord(x0)} ${svgCoord(y0)} A ${svgCoord(radius)} ${svgCoord(radius)} 0 0 1 ${svgCoord(x1)} ${svgCoord(y1)}`}
        fill="none"
        stroke={colorAlongStops(stops, t1)}
        strokeWidth={strokeWidth}
        strokeLinecap={cap}
      />
    );
  }
  return <g>{parts}</g>;
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

/** Compact rings stay in brand blue so a 100% fill does not read as navy vs sky halves. */
const COMPACT_DIAL_STOPS: readonly DialGradientStop[] = [
  { offset: "0%", color: "#0c5290" },
  { offset: "50%", color: "#2b8fd6" },
  { offset: "100%", color: "#5eb4f4" },
];

function CampaignStrokeDial({
  label,
  numerator,
  denominator,
  hint,
  gradientStops,
  emphasize = false,
}: CampaignDialMetric & {
  gradientStops: readonly DialGradientStop[];
  emphasize?: boolean;
}) {
  const viewSize = 420;
  const stroke = emphasize ? 34 : 30;
  const cx = viewSize / 2;
  const cy = viewSize / 2;
  const radius = (viewSize - stroke) / 2;
  const pct =
    denominator > 0
      ? Math.min(100, Math.round((numerator / denominator) * 100))
      : 0;
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
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={BOSS_PRO_RING_TRACK}
            strokeWidth={stroke}
          />
          <SweepGradientArc
            cx={cx}
            cy={cy}
            radius={radius}
            pct={pct}
            strokeWidth={stroke}
            stops={gradientStops}
          />
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

const CONNECT_LEGEND = {
  invites: "#2b8fd6",
  accepted: "#0c5290",
  queued: "#cbd5e1",
} as const;

/** Row dial: % in the centre plus Invites / Accepted / Queued. */
export function CampaignCompactDial({
  label,
  numerator,
  denominator,
  /** Leads still waiting to receive a connection request. */
  queued,
  muted = false,
  size = "default",
}: {
  label: string;
  numerator: number;
  denominator: number;
  queued: number;
  /** Grey out when the metric does not apply (e.g. no invite step). */
  muted?: boolean;
  size?: "default" | "sm";
}) {
  const viewSize = 120;
  const stroke = size === "sm" ? 12 : 14;
  const cx = viewSize / 2;
  const cy = viewSize / 2;
  const radius = (viewSize - stroke) / 2;
  const pct =
    denominator > 0
      ? Math.min(100, Math.round((numerator / denominator) * 100))
      : 0;
  const waiting = Math.max(0, queued);
  const stops = COMPACT_DIAL_STOPS;
  const dialClass = size === "sm" ? "h-9 w-9" : "h-12 w-12";
  const gapClass = size === "sm" ? "gap-2.5" : "gap-3.5";
  const listClass = size === "sm" ? "min-w-[5.25rem] space-y-0.5" : "min-w-[6rem] space-y-1";
  const rowText = size === "sm" ? "text-[10px]" : "text-[11px]";
  const pctText = size === "sm" ? "text-[11px]" : "text-[13px]";

  return (
    <div
      className={`flex items-center ${gapClass} ${muted ? "opacity-40" : ""}`}
      role="img"
      aria-label={
        muted
          ? `${label}: not applicable`
          : `${label} ${pct} percent: ${denominator} invites, ${numerator} accepted, ${waiting} queued`
      }
      title={
        muted
          ? `${label}: n/a`
          : `${label}: ${pct}% · ${denominator} invited, ${numerator} accepted, ${waiting} waiting to send`
      }
    >
      <div className={`relative shrink-0 ${dialClass}`}>
        <svg className="h-full w-full" viewBox={`0 0 ${viewSize} ${viewSize}`}>
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={BOSS_PRO_RING_TRACK}
            strokeWidth={stroke}
          />
          {muted ? null : (
            <SweepGradientArc
              cx={cx}
              cy={cy}
              radius={radius}
              pct={pct}
              strokeWidth={stroke}
              stops={stops}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {muted ? (
            <span className={`${pctText} font-semibold leading-none text-slate-700`}>
              —
            </span>
          ) : (
            <span className="inline-flex items-baseline leading-none">
              <span className={`${pctText} font-semibold tabular-nums text-slate-900`}>
                {pct}
              </span>
              <span className="text-[50%] font-semibold text-slate-500">
                %
              </span>
            </span>
          )}
        </div>
      </div>
      <ul className={listClass}>
        {[
          { label: "Invites", value: denominator, color: CONNECT_LEGEND.invites },
          { label: "Accepted", value: numerator, color: CONNECT_LEGEND.accepted },
          { label: "Queued", value: waiting, color: CONNECT_LEGEND.queued },
        ].map((row) => (
          <li
            key={row.label}
            className={`flex items-center justify-between gap-3 ${rowText}`}
          >
            <span className="flex items-center gap-1.5 font-medium text-slate-500">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: row.color }}
              />
              {row.label}
            </span>
            <span className="tabular-nums font-semibold text-slate-900">
              {muted ? "—" : row.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const REPLY_COLORS = {
  positive: "#10b981",
  neutral: "#f59e0b",
  deselect: "#f43f5e",
} as const;

/** Compact replies donut + Positive / Neutral / Deselect, for a campaign row. */
export function CampaignReplyMix({
  positive,
  negative,
  other,
  size = "default",
}: {
  positive: number;
  negative: number;
  other: number;
  size?: "default" | "sm";
}) {
  const total = positive + negative + other;
  const viewSize = 120;
  const stroke = size === "sm" ? 14 : 16;
  const cx = viewSize / 2;
  const cy = viewSize / 2;
  const radius = (viewSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const parts = [
    { key: "positive", value: positive, color: REPLY_COLORS.positive },
    { key: "neutral", value: other, color: REPLY_COLORS.neutral },
    { key: "deselect", value: negative, color: REPLY_COLORS.deselect },
  ];
  let offset = 0;
  const segments =
    total > 0
      ? parts
          .filter((part) => part.value > 0)
          .map((part) => {
            const length = (part.value / total) * circumference;
            const segment = { ...part, length, offset };
            offset += length;
            return segment;
          })
      : [];
  const dialClass = size === "sm" ? "h-9 w-9" : "h-12 w-12";
  const gapClass = size === "sm" ? "gap-2.5" : "gap-3.5";
  const listClass = size === "sm" ? "min-w-[5.25rem] space-y-0.5" : "min-w-[5.75rem] space-y-1";
  const rowText = size === "sm" ? "text-[10px]" : "text-[11px]";
  const totalText = size === "sm" ? "text-[11px]" : "text-[13px]";

  return (
    <div
      className={`flex items-center ${gapClass}`}
      role="img"
      aria-label={`Replies ${total}: ${positive} positive, ${other} neutral, ${negative} deselect`}
    >
      <div className={`relative shrink-0 ${dialClass}`}>
        <svg className="h-full w-full" viewBox={`0 0 ${viewSize} ${viewSize}`}>
          <g transform={`rotate(-90 ${cx} ${cy})`}>
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
                key={segment.key}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={stroke}
                strokeDasharray={`${segment.length} ${circumference}`}
                strokeDashoffset={-segment.offset}
                strokeLinecap="butt"
              />
            ))}
          </g>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`${totalText} font-semibold tabular-nums leading-none text-slate-900`}>
            {total}
          </span>
        </div>
      </div>
      <ul className={listClass}>
        {[
          { label: "Positive", value: positive, color: REPLY_COLORS.positive },
          { label: "Neutral", value: other, color: REPLY_COLORS.neutral },
          { label: "Deselect", value: negative, color: REPLY_COLORS.deselect },
        ].map((row) => (
          <li
            key={row.label}
            className={`flex items-center justify-between gap-3 ${rowText}`}
          >
            <span className="flex items-center gap-1.5 font-medium text-slate-500">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: row.color }}
              />
              {row.label}
            </span>
            <span className="tabular-nums font-semibold text-slate-900">
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CampaignDialsPanel({ dials }: { dials: CampaignDialMetric[] }) {
  const cols =
    dials.length <= 1
      ? "sm:grid-cols-1"
      : dials.length === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-3";

  return (
    <div className={`${DIAL_CARD_SHELL} h-full`}>
      <div className={CARD_HEADER}>Conversion</div>
      <div
        className={`grid grid-cols-1 divide-y divide-slate-100 sm:divide-x sm:divide-y-0 ${cols}`}
      >
        {dials.map((dial, i) => (
          <CampaignStrokeDial
            key={dial.id}
            {...dial}
            gradientStops={DIAL_GRADIENTS[i] ?? DIAL_GRADIENTS[0]}
          />
        ))}
      </div>
    </div>
  );
}

export const CAMPAIGN_QUEUED_STATUSES = ["queued"] as const;

export const CAMPAIGN_FOLLOW_UP_STATUSES = [
  "invited",
  "connected",
  "in_sequence",
  "paused",
] as const;

export type CampaignFuel = {
  leftToInvite: number;
  inFollowUp: number;
  total: number;
  dailyLimit: number;
  campaignStatus: string;
  hasInviteStep: boolean;
};

const BATCH_BAR_FILL =
  "linear-gradient(90deg, #0c5290 0%, #2b8fd6 70%, #5eb4f4 100%)";

function CampaignBatchBar({
  sent,
  total,
  size = "full",
  label,
}: {
  sent: number;
  total: number;
  size?: "compact" | "full" | "row";
  label: string;
}) {
  const filled = Math.min(Math.max(0, sent), Math.max(0, total));
  const pct = total > 0 ? (filled / total) * 100 : 0;
  const barH =
    size === "full" ? "h-2.5" : size === "row" ? "h-2" : "h-1.5";
  const barW =
    size === "full"
      ? "w-full"
      : size === "row"
        ? "min-w-[3.5rem] flex-1"
        : "w-[4.75rem]";

  return (
    <div
      className={`overflow-hidden rounded-full bg-slate-200 ${barH} ${barW}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={Math.max(total, 1)}
      aria-valuenow={filled}
      aria-label={label}
    >
      {pct > 0 ? (
        <div
          className="h-full min-w-0"
          style={{ width: `${pct}%`, background: BATCH_BAR_FILL }}
        />
      ) : null}
    </div>
  );
}

export function buildCampaignFuel(input: {
  leads: Array<{ status: string }>;
  dailyLimit: number;
  campaignStatus: string;
  hasInviteStep: boolean;
}): CampaignFuel {
  let leftToInvite = 0;
  let inFollowUp = 0;
  for (const lead of input.leads) {
    if ((CAMPAIGN_QUEUED_STATUSES as readonly string[]).includes(lead.status)) {
      leftToInvite += 1;
    } else if (
      (CAMPAIGN_FOLLOW_UP_STATUSES as readonly string[]).includes(lead.status)
    ) {
      inFollowUp += 1;
    }
  }
  return {
    leftToInvite,
    inFollowUp,
    total: input.leads.length,
    dailyLimit: Math.max(0, input.dailyLimit),
    campaignStatus: input.campaignStatus,
    hasInviteStep: input.hasInviteStep,
  };
}

export function campaignRunwayLabel(
  left: number,
  dailyLimit: number
): string | null {
  if (left <= 0 || dailyLimit <= 0) return null;
  const days = left / dailyLimit;
  if (days < 1) return `Less than a day at ${dailyLimit}/day`;
  const rounded = Math.round(days);
  return `About ${rounded} day${rounded === 1 ? "" : "s"} at ${dailyLimit}/day`;
}

export function isCampaignFuelLow(fuel: CampaignFuel): boolean {
  if (fuel.leftToInvite <= 0) return true;
  if (fuel.dailyLimit <= 0) return false;
  return fuel.leftToInvite / fuel.dailyLimit <= 2;
}

export function campaignFuelStarvedCopy(fuel: CampaignFuel): string | null {
  if (fuel.campaignStatus !== "running" || fuel.leftToInvite > 0) return null;
  const inviteWord = fuel.hasInviteStep ? "invite" : "start";
  const followWord = fuel.hasInviteStep ? "follow-up" : "the sequence";
  if (fuel.inFollowUp > 0) {
    const follow =
      fuel.inFollowUp === 1
        ? `1 still in ${followWord}`
        : `${fuel.inFollowUp} still in ${followWord}`;
    return `No one left to ${inviteWord}. ${follow}. Add prospects to keep sending.`;
  }
  return "Nothing left in this campaign. Add prospects or pause it.";
}

export const CAMPAIGN_STATUS_ORDER = [
  "queued",
  "invited",
  "connected",
  "in_sequence",
  "paused",
  "replied",
  "interested",
  "assessment_sent",
  "assessment_done",
  "call_offered",
  "completed",
  "failed",
  "skipped",
] as const;

const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  queued: "#94a3b8",
  invited: "#f59e0b",
  connected: "#0c5290",
  in_sequence: "#2b8fd6",
  paused: "#8b5cf6",
  replied: "#10b981",
  interested: "#047857",
  assessment_sent: "#5eb4f4",
  assessment_done: "#0e7490",
  call_offered: "#22c55e",
  completed: "#14532d",
  failed: "#e11d48",
  skipped: "#64748b",
};

const STATUS_COLOR_FALLBACK = [
  "#475569",
  "#0369a1",
  "#7c3aed",
  "#c2410c",
  "#0f766e",
] as const;

const ADD_PROSPECTS_BTN =
  "rounded-lg bg-[#0c5290] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0a457a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2";

export type CampaignStatusMixRow = {
  status: string;
  label: string;
  count: number;
  color: string;
};

export function campaignStatusMix(
  counts: Record<string, number>
): CampaignStatusMixRow[] {
  const known = CAMPAIGN_STATUS_ORDER.filter((status) => (counts[status] ?? 0) > 0);
  const extras = Object.keys(counts)
    .filter(
      (status) =>
        !(CAMPAIGN_STATUS_ORDER as readonly string[]).includes(status) &&
        (counts[status] ?? 0) > 0
    )
    .sort();
  return [...known, ...extras].map((status, i) => ({
    status,
    label: leadStatusLabel(status),
    count: counts[status] ?? 0,
    color:
      CAMPAIGN_STATUS_COLORS[status] ??
      STATUS_COLOR_FALLBACK[i % STATUS_COLOR_FALLBACK.length],
  }));
}

function CampaignStatusDonut({
  rows,
  total,
}: {
  rows: CampaignStatusMixRow[];
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
    <div className="relative h-[11.5rem] w-[11.5rem] shrink-0 sm:h-[12.5rem] sm:w-[12.5rem]">
      <svg className="h-full w-full" viewBox={`0 0 ${viewSize} ${viewSize}`}>
        <g transform={`rotate(-90 ${cx} ${cy})`}>
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
              key={segment.status}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={stroke}
              strokeDasharray={`${segment.length} ${circumference}`}
              strokeDashoffset={-segment.offset}
              strokeLinecap="butt"
            />
          ))}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[2rem] font-semibold tabular-nums leading-none tracking-tight text-slate-900 sm:text-[2.25rem]">
          {total}
        </span>
        <span className="mt-1.5 text-xs font-medium text-slate-500">
          {total === 1 ? "person" : "people"}
        </span>
      </div>
    </div>
  );
}

export function CampaignFuelPanel({
  fuel,
  statusCounts,
  onAddProspects,
  onOpenStatus,
  onViewAll,
}: {
  fuel: CampaignFuel;
  statusCounts: Record<string, number>;
  onAddProspects: () => void;
  onOpenStatus?: (status: string) => void;
  onViewAll?: () => void;
}) {
  const rows = campaignStatusMix(statusCounts);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const runway = campaignRunwayLabel(fuel.leftToInvite, fuel.dailyLimit);
  const starved = campaignFuelStarvedCopy(fuel);
  const mixLabel =
    rows.length === 0
      ? "No activity yet"
      : rows.map((row) => `${row.count} ${row.label}`).join(", ");

  return (
    <div className={`${DIAL_CARD_SHELL} flex h-full flex-col`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-600/40 bg-slate-700 px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-wide text-white">
          By status
        </h2>
        {onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-medium text-sky-200 hover:text-white"
          >
            View all
          </button>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col px-4 py-4 sm:px-5 sm:py-5">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No activity yet</p>
        ) : (
          <div
            className="flex flex-1 flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6"
            role="img"
            aria-label={mixLabel}
          >
            <div className="flex shrink-0 items-center justify-center">
              <CampaignStatusDonut rows={rows} total={total} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col sm:items-start">
              <ul className="w-max max-w-full">
                {rows.map((row) => {
                  const rowInner = (
                    <>
                      <span className="flex min-w-0 items-center gap-2.5 font-medium text-slate-700">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: row.color }}
                          aria-hidden
                        />
                        <span className="truncate">{row.label}</span>
                      </span>
                      <span className="text-base tabular-nums font-semibold text-slate-900">
                        {row.count}
                      </span>
                    </>
                  );
                  return (
                    <li key={row.status}>
                      {onOpenStatus ? (
                        <button
                          type="button"
                          onClick={() => onOpenStatus(row.status)}
                          className="flex w-full items-center gap-3 rounded-md px-1 py-1 text-left text-[15px] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
                        >
                          {rowInner}
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 px-1 py-1 text-[15px]">
                          {rowInner}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className="mt-5 flex flex-col items-start gap-3">
                {runway ? (
                  <p className="text-sm leading-snug text-slate-600">{runway}</p>
                ) : null}

                {starved ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm leading-snug text-amber-950">
                    {starved}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={onAddProspects}
                  className={ADD_PROSPECTS_BTN}
                >
                  Add prospects
                </button>
              </div>
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="mt-auto pt-4">
            <button
              type="button"
              onClick={onAddProspects}
              className={ADD_PROSPECTS_BTN}
            >
              Add prospects
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function CampaignQueueCell({
  sent,
  total,
  failed = 0,
  queued,
  dailyLimit,
  running,
  hasInviteStep = true,
  layout = "stack",
}: {
  /** Invites/messages actually started — excludes failed/skipped. */
  sent: number;
  total: number;
  failed?: number;
  queued: number;
  dailyLimit: number;
  running: boolean;
  hasInviteStep?: boolean;
  layout?: "stack" | "row";
}) {
  // Failed/skipped are not progress and not remaining fuel.
  const pool = Math.max(0, total - Math.max(0, failed));
  const sentClamped = Math.min(Math.max(0, sent), pool || total);
  const pct = pool > 0 ? Math.round((sentClamped / pool) * 100) : 0;
  const warn = running && queued === 0 && pool > 0;
  const runway = campaignRunwayLabel(queued, dailyLimit);
  const verb = hasInviteStep ? "sent" : "started";
  const label =
    pool === 0 && total === 0
      ? "No contacts yet"
      : `${sentClamped.toLocaleString()} ${verb} of ${pool.toLocaleString()}`;
  const countText =
    pool === 0 && total === 0
      ? "—"
      : `${sentClamped.toLocaleString()} / ${pool.toLocaleString()}`;

  return (
    <div
      className={
        layout === "row"
          ? "flex w-full min-w-0 items-center gap-2"
          : "flex flex-col items-center gap-1.5"
      }
      title={runway ? `${label}. ${runway}` : label}
    >
      <CampaignBatchBar
        sent={sentClamped}
        total={pool}
        size={layout === "row" ? "row" : "compact"}
        label={runway ? `${label}. ${runway}` : label}
      />
      <span
        className={`shrink-0 text-[11px] font-medium tabular-nums leading-none ${
          warn ? "text-amber-800" : "text-slate-600"
        }`}
      >
        {countText}
        {pool > 0 ? (
          <span className="font-normal text-slate-400"> ({pct}%)</span>
        ) : null}
      </span>
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

/** Conversion dials only. Volume belongs on the queue card, not a fill ring. */
export function buildCampaignDials(input: {
  leads: Array<{ status: string; interest_outcome?: string | null }>;
  hasInviteStep: boolean;
}): CampaignDialMetric[] {
  const { leads, hasInviteStep } = input;

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

  const dials: CampaignDialMetric[] = [];

  if (hasInviteStep) {
    dials.push({
      id: "connect",
      label: "Connect rate",
      hint: "Accepted of invites sent",
      numerator: connectedOrBeyond,
      denominator: invitedOrBeyond,
    });
  }

  const replyDenom = hasInviteStep
    ? connectedOrBeyond
    : messagedOrBeyond || invitedOrBeyond;

  if (interested > 0) {
    dials.push({
      id: "interest",
      label: "Interest rate",
      hint: hasInviteStep
        ? "Interested of connected"
        : "Interested of reached",
      numerator: interested,
      denominator: replyDenom,
    });
  } else {
    dials.push({
      id: "reply",
      label: "Reply rate",
      hint: hasInviteStep ? "Replied of connected" : "Replied of reached",
      numerator: repliedUnique,
      denominator: replyDenom,
    });
  }

  return dials;
}
