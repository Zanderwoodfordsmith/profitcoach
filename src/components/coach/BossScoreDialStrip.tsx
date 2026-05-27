"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PLAYBOOK_COUNT } from "@/lib/bossData";
import type {
  BossPillarDialStat,
  ProgressCategoryPlaybook,
  WorkshopScoreMixCategories,
} from "@/lib/bossScores";
import {
  POINTS_TO_URGENCY,
  PROSPECT_EASE_LEVELS,
  PROSPECT_IMPACT_LEVELS,
  WORKSHOP_EASE_META,
  WORKSHOP_IMPACT_META,
  WORKSHOP_PRIORITY_META,
  type DimensionPlaybookLists,
  type ProspectDimensionBreakdown,
} from "@/lib/playbookSessionNotes";

import {
  BOSS_PILLAR_DIAL_GRADIENTS,
  BOSS_PRO_HERO_RING_GRADIENT,
  BOSS_PRO_HERO_SCORE_TEXT_GRADIENT,
  BOSS_PRO_RING_TRACK,
  type BossPillarDialKey,
} from "@/lib/bossProDialGradients";

const DIAL_CARD_SHELL =
  "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.015)]";

const CARD_HEADER =
  "border-b border-slate-600/40 bg-slate-700 px-4 py-2.5 text-sm font-semibold tracking-wide text-white";

type BossScoreDialStripProps = {
  totalScore: number | null;
  pillarStats: BossPillarDialStat[];
  className?: string;
};

function DialCard({
  header,
  children,
  className = "",
  bodyClassName = "flex justify-center px-4 py-4",
}: {
  header: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={`${DIAL_CARD_SHELL} ${className}`}>
      <div className={CARD_HEADER}>{header}</div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

const HERO_RING_SIZE_CLASS =
  "h-[10.5rem] w-[10.5rem] sm:h-[11.5rem] sm:w-[11.5rem] md:h-[13rem] md:w-[13rem]";

const PILLAR_RING_SIZE_CLASS =
  "h-[7.25rem] w-[7.25rem] sm:h-[8rem] sm:w-[8rem] md:h-[8.75rem] md:w-[8.75rem]";

function svgCoord(n: number): number {
  return Number(n.toFixed(3));
}

/** Arc from 12 o'clock clockwise — gradient maps dark → light along this path only. */
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
  const path = `M ${svgCoord(x0)} ${svgCoord(y0)} A ${svgCoord(radius)} ${svgCoord(radius)} 0 ${largeArc} 1 ${svgCoord(x1)} ${svgCoord(y1)}`;

  return { path, x0, y0, x1, y1 };
}

function StrokeRingGauge({
  pctFill,
  gradientStops,
  centerPrimary,
  centerSecondary,
  percentSuffix = false,
  centerTextGradient,
  ariaLabel,
  size = "pillar",
}: {
  pctFill: number;
  gradientStops: readonly { offset: string; color: string }[];
  centerPrimary: string;
  centerSecondary?: string;
  percentSuffix?: boolean;
  centerTextGradient?: string;
  ariaLabel: string;
  size?: "hero" | "pillar";
}) {
  const gradId = useId().replace(/:/g, "");
  const viewSize = 420;
  const stroke = size === "hero" ? 36 : 28;
  const cx = viewSize / 2;
  const cy = viewSize / 2;
  const radius = (viewSize - stroke) / 2;
  const pct = Math.min(100, Math.max(0, pctFill));
  const { path: progressPath, x0, y0, x1, y1 } = describeProgressArc(cx, cy, radius, pct);
  const ringSizeClass = size === "hero" ? HERO_RING_SIZE_CLASS : PILLAR_RING_SIZE_CLASS;
  const primaryTextClass =
    size === "hero"
      ? "text-[2rem] sm:text-[2.375rem] md:text-[2.625rem]"
      : "text-[1.35rem] sm:text-2xl md:text-[1.875rem]";

  return (
    <div className={`relative shrink-0 ${ringSizeClass}`} role="img" aria-label={ariaLabel}>
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
                <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
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
        <span
          className={`inline-flex items-baseline font-semibold tabular-nums leading-none tracking-tight ${primaryTextClass} ${
            centerTextGradient ? "" : "text-slate-900"
          }`}
          style={
            centerTextGradient
              ? {
                  background: centerTextGradient,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  fontFamily:
                    size === "hero"
                      ? "var(--font-pc-ds-mono), ui-monospace, SFMono-Regular, Menlo, monospace"
                      : undefined,
                }
              : undefined
          }
        >
          {centerPrimary}
          {percentSuffix ? (
            <span className="ml-px text-[0.45em] font-medium text-slate-500">%</span>
          ) : null}
        </span>
        {centerSecondary ? (
          <span className="mt-0.5 text-[10px] font-medium tabular-nums text-slate-500 sm:text-[11px]">
            {centerSecondary}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function BossScoreHeroCard({
  cappedTotal,
  overallPct,
  notStarted = false,
  className = "",
}: {
  cappedTotal: number;
  overallPct: number;
  notStarted?: boolean;
  className?: string;
}) {
  return (
    <DialCard
      header="Boss Pro"
      className={className}
      bodyClassName="flex justify-center px-7 py-8 sm:px-8 sm:py-9 md:px-9 md:py-10"
    >
      {notStarted ? (
        <div
          className={`flex flex-col items-center justify-center rounded-full border-2 border-dashed border-slate-200 bg-slate-50/80 text-center ${HERO_RING_SIZE_CLASS}`}
        >
          <p className="text-sm font-semibold text-slate-700">Not started</p>
          <p className="mt-1 max-w-[8rem] text-xs text-slate-500">
            Score playbooks together to build their Boss Pro score.
          </p>
        </div>
      ) : (
        <StrokeRingGauge
          size="hero"
          pctFill={overallPct}
          gradientStops={BOSS_PRO_HERO_RING_GRADIENT.stops}
          centerPrimary={`${cappedTotal}`}
          centerSecondary="/ 100"
          centerTextGradient={BOSS_PRO_HERO_SCORE_TEXT_GRADIENT}
          ariaLabel={`Boss Pro ${cappedTotal} out of 100`}
        />
      )}
    </DialCard>
  );
}

function PillarDialCell({ stat }: { stat: BossPillarDialStat }) {
  const pctFill =
    stat.maxScore > 0 ? Math.min(100, Math.round((stat.sum / stat.maxScore) * 100)) : 0;
  const pillarGradient = BOSS_PILLAR_DIAL_GRADIENTS[stat.pillarKey as BossPillarDialKey];

  return (
    <div className="flex min-w-0 flex-col items-center justify-center px-3 py-3 sm:px-5 sm:py-4">
      <StrokeRingGauge
        size="pillar"
        pctFill={pctFill}
        gradientStops={pillarGradient.stops}
        centerPrimary={`${pctFill}`}
        percentSuffix
        ariaLabel={`${stat.label}: ${pctFill}% of pillar maximum, ${stat.sum} of ${stat.maxScore} points`}
      />
      <div className="mt-4 flex max-w-[9rem] flex-col items-center gap-1.5 text-center sm:mt-5">
        <span
          className="h-0.5 w-9 shrink-0 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${pillarGradient.stops[0].color}, ${pillarGradient.stops[pillarGradient.stops.length - 1].color})`,
          }}
          aria-hidden
        />
        <span className="text-xs font-semibold leading-snug text-slate-700 sm:text-sm">
          {stat.label}
        </span>
      </div>
    </div>
  );
}

function PillarScoresPanel({
  pillarStats,
  className = "",
}: {
  pillarStats: BossPillarDialStat[];
  className?: string;
}) {
  return (
    <div className={`${DIAL_CARD_SHELL} flex min-w-0 flex-1 flex-col ${className}`}>
      <div className={CARD_HEADER}>Pillar scores</div>
      <div className="flex flex-1 items-center justify-center px-2 py-4 sm:px-3 sm:py-5">
        <div className="grid w-full grid-cols-2 sm:grid-cols-4">
          {pillarStats.map((stat) => (
            <PillarDialCell key={stat.pillarKey} stat={stat} />
          ))}
        </div>
      </div>
    </div>
  );
}

export type BossAnswerMixCounts = {
  onTrack: number;
  building: number;
  needsAttention: number;
  /** Playbooks with no score yet (excluded from on-track / building / needs-attention counts). */
  notAnswered?: number;
};

type AnswerMixBarProps = BossAnswerMixCounts & {
  className?: string;
  /** Slate card header label */
  title?: string;
  scoreMixCategories?: WorkshopScoreMixCategories;
  prospectBreakdown?: ProspectDimensionBreakdown;
  totalPlaybooks?: number;
  /** Opens the in-session playbook sheet when a popover playbook is clicked. */
  onPlaybookClick?: (ref: string) => void;
};

const POPOVER_CLOSE_MS = 120;
const POPOVER_MAX_HEIGHT = 220;

const NOT_ANSWERED_GREY = "#cbd5e1";

const MIX_SEGMENTS = [
  { key: "onTrack", label: "On track", color: "#4ADE80" },
  { key: "building", label: "Building", color: "#E5C84A" },
  { key: "needsAttention", label: "Needs attention", color: "#C73E54" },
  { key: "notAnswered", label: "Not answered", color: NOT_ANSWERED_GREY },
] as const;

type LevelLegendDef = { level: number; label: string; color: string };

const IMPACT_LEGEND: LevelLegendDef[] = PROSPECT_IMPACT_LEVELS.map((level) => ({
  level,
  label: WORKSHOP_IMPACT_META[level].label,
  color: level === 3 ? "#1e3a8a" : level === 2 ? "#3b82f6" : "#94a3b8",
}));

const URGENCY_LEGEND: LevelLegendDef[] = ([4, 3, 2, 1] as const).map((level) => ({
  level,
  label: WORKSHOP_PRIORITY_META[POINTS_TO_URGENCY[level]].label,
  color:
    level === 4 ? "#ef4444" : level === 3 ? "#eab308" : level === 2 ? "#2563eb" : "#94a3b8",
}));

const EASE_LEGEND: LevelLegendDef[] = PROSPECT_EASE_LEVELS.map((level) => ({
  level,
  label: WORKSHOP_EASE_META[level].label,
  color: level === 3 ? "#22c55e" : level === 2 ? "#eab308" : "#ef4444",
}));

function dimensionLegendItems<T extends number>(
  prefix: string,
  defs: LevelLegendDef[],
  levelCounts: Record<number, number>,
  playbooks: DimensionPlaybookLists<T>
): LegendItem[] {
  return [
    ...defs.map(({ level, label, color }) => ({
      id: `${prefix}-${level}`,
      label,
      color,
      count: levelCounts[level] ?? 0,
      playbooks: playbooks.byLevel[level as T] ?? [],
    })),
    {
      id: `${prefix}-unset`,
      label: "Not set",
      color: NOT_ANSWERED_GREY,
      count: playbooks.unset.length,
      playbooks: playbooks.unset,
    },
  ];
}

function DimensionProgressRow({
  title,
  setCount,
  total,
  prefix,
  defs,
  levelCounts,
  playbooks,
  onPlaybookClick,
}: {
  title: string;
  setCount: number;
  total: number;
  prefix: string;
  defs: LevelLegendDef[];
  levelCounts: Record<number, number>;
  playbooks: DimensionPlaybookLists<number>;
  onPlaybookClick?: (ref: string) => void;
}) {
  const segments = dimensionLegendItems(prefix, defs, levelCounts, playbooks);
  return (
    <ProgressMetricRow
      title={title}
      trailing={<ProgressLegend items={segments} onPlaybookClick={onPlaybookClick} />}
      bar={
        <SegmentedProgressBar
          segments={segments}
          total={total}
          ariaLabel={`${title}: ${setCount} of ${total} playbooks rated`}
          onPlaybookClick={onPlaybookClick}
        />
      }
    />
  );
}

type LegendItem = {
  id: string;
  label: string;
  color: string;
  count: number;
  playbooks: ProgressCategoryPlaybook[];
};

function ProgressCategoryPopover({
  label,
  playbooks,
  accentColor,
  onPlaybookClick,
  children,
  className = "",
}: {
  label: string;
  playbooks: ProgressCategoryPlaybook[];
  accentColor?: string;
  onPlaybookClick?: (ref: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    if (playbooks.length === 0) return;
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer, playbooks.length]);

  const scheduleHide = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => setOpen(false), POPOVER_CLOSE_MS);
  }, [clearCloseTimer]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    function updatePosition() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const panelWidth = Math.min(280, window.innerWidth - 24);
      let left = rect.left + rect.width / 2 - panelWidth / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - panelWidth - 12));

      const estimatedHeight = Math.min(
        POPOVER_MAX_HEIGHT + 48,
        40 + playbooks.length * 26
      );
      let top = rect.bottom + 8;
      if (top + estimatedHeight > window.innerHeight - 12) {
        top = Math.max(12, rect.top - estimatedHeight - 8);
      }

      setPosition({ left, top });
    }

    updatePosition();
    const scrollOpts = { capture: true } as const;
    window.addEventListener("scroll", updatePosition, scrollOpts);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, scrollOpts);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, playbooks.length]);

  const interactive = playbooks.length > 0;
  const isBarTrigger = className.includes("block");
  const triggerActive =
    interactive && open && accentColor
      ? isBarTrigger
        ? {
            filter: "brightness(1.14) saturate(1.15)",
            boxShadow:
              "inset 0 3px 0 rgba(255,255,255,0.6), inset 0 -2px 0 rgba(0,0,0,0.12)",
          }
        : {
            backgroundColor: `${accentColor}20`,
            boxShadow: `0 0 0 1px ${accentColor}55`,
          }
      : undefined;

  const panel =
    open && position && playbooks.length > 0 ? (
      <div
        id={panelId}
        role="tooltip"
        className="fixed z-[220] max-w-[280px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5"
        style={{ left: position.left, top: position.top, width: Math.min(280, window.innerWidth - 24) }}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
      >
        {accentColor ? (
          <div
            className="h-2 w-full"
            style={{ backgroundColor: accentColor }}
            aria-hidden
          />
        ) : null}
        <div className="px-3 py-2.5">
          <p
            className="text-base font-semibold leading-tight"
            style={accentColor ? { color: accentColor } : undefined}
          >
            {label}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {playbooks.length} playbook{playbooks.length === 1 ? "" : "s"}
          </p>
          <ul className="mt-2 max-h-[220px] space-y-0.5 overflow-y-auto">
            {playbooks.map((playbook) => (
              <li key={playbook.ref}>
                {onPlaybookClick ? (
                  <button
                    type="button"
                    onClick={() => {
                      onPlaybookClick(playbook.ref);
                      setOpen(false);
                    }}
                    className="w-full rounded-md px-1.5 py-1 text-left text-sm leading-snug text-slate-700 transition-colors hover:bg-slate-100 hover:text-sky-700"
                  >
                    {playbook.name}
                  </button>
                ) : (
                  <span className="block px-1.5 py-1 text-sm leading-snug text-slate-700">
                    {playbook.name}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    ) : null;

  return (
    <>
      <span
        ref={triggerRef}
        className={`${interactive ? "cursor-pointer" : ""} ${isBarTrigger ? "" : "rounded px-1 py-px transition-[background-color,box-shadow,filter] duration-150"} ${className}`.trim()}
        style={triggerActive}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onFocus={show}
        onBlur={scheduleHide}
        aria-describedby={open ? panelId : undefined}
      >
        {children}
      </span>
      {typeof document !== "undefined" && panel ? createPortal(panel, document.body) : null}
    </>
  );
}

function ProgressMetricRow({
  title,
  trailing,
  bar,
}: {
  title: string;
  trailing?: React.ReactNode;
  bar: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="text-sm font-medium text-slate-800">{title}</span>
        {trailing ? (
          <div className="flex min-w-0 flex-wrap justify-end gap-x-1.5 gap-y-0.5 sm:gap-x-2">{trailing}</div>
        ) : null}
      </div>
      <div className="min-w-0">{bar}</div>
    </div>
  );
}

function ProgressLegend({
  items,
  onPlaybookClick,
}: {
  items: LegendItem[];
  onPlaybookClick?: (ref: string) => void;
}) {
  const visible = items.filter((item) => item.count > 0);
  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((item) => (
        <ProgressCategoryPopover
          key={item.id}
          label={item.label}
          playbooks={item.playbooks}
          accentColor={item.color}
          onPlaybookClick={onPlaybookClick}
        >
          <span className="inline-flex items-center gap-1 text-[11px] leading-tight text-slate-600">
            <span
              className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/5"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            {item.label}{" "}
            <span className="font-semibold tabular-nums text-slate-900">{item.count}</span>
          </span>
        </ProgressCategoryPopover>
      ))}
    </>
  );
}

function MixLegend({
  counts,
  categories,
  onPlaybookClick,
}: {
  counts: Record<(typeof MIX_SEGMENTS)[number]["key"], number>;
  categories: WorkshopScoreMixCategories;
  onPlaybookClick?: (ref: string) => void;
}) {
  const items: LegendItem[] = MIX_SEGMENTS.filter(
    ({ key }) => counts[key] > 0 || key !== "notAnswered"
  ).map(({ key, label, color }) => ({
    id: `mix-${key}`,
    label,
    color,
    count: counts[key],
    playbooks: categories[key],
  }));
  return <ProgressLegend items={items} onPlaybookClick={onPlaybookClick} />;
}

function SegmentedProgressBar({
  segments,
  total,
  ariaLabel,
  onPlaybookClick,
}: {
  segments: LegendItem[];
  total: number;
  ariaLabel: string;
  onPlaybookClick?: (ref: string) => void;
}) {
  const w = (n: number) => (total > 0 ? `${(n / total) * 100}%` : "0%");
  const hasSegments = segments.some((s) => s.count > 0);

  return (
    <div
      className="flex h-3.5 w-full overflow-hidden rounded-lg bg-slate-200/90 shadow-inner ring-1 ring-slate-200/80 sm:h-4"
      role="img"
      aria-label={ariaLabel}
    >
      {hasSegments
        ? segments.map(
            (seg) =>
              seg.count > 0 && (
                <div
                  key={seg.id}
                  className="h-full min-w-[6px] shrink-0"
                  style={{ width: w(seg.count) }}
                >
                  <ProgressCategoryPopover
                    label={seg.label}
                    playbooks={seg.playbooks}
                    accentColor={seg.color}
                    onPlaybookClick={onPlaybookClick}
                    className="block h-full w-full"
                  >
                    <div
                      className="h-full w-full"
                      style={{ background: seg.color }}
                      aria-hidden
                    />
                  </ProgressCategoryPopover>
                </div>
              )
          )
        : null}
    </div>
  );
}

export function BossAnswerMixBar({
  onTrack,
  building,
  needsAttention,
  notAnswered = 0,
  className = "",
  title = "Completeness",
  scoreMixCategories,
  prospectBreakdown,
  totalPlaybooks = PLAYBOOK_COUNT,
  onPlaybookClick,
}: AnswerMixBarProps) {
  const counts = {
    onTrack,
    building,
    needsAttention,
    notAnswered,
  };
  const scoredTotal = onTrack + building + needsAttention;
  const mixTotal = scoredTotal + notAnswered;

  return (
    <DialCard
      header={title}
      className={`mx-auto w-full max-w-[40rem] ${className}`}
      bodyClassName="space-y-5 px-4 py-4 sm:space-y-6 sm:px-5 sm:py-5"
    >
      <ProgressMetricRow
        title="Playbooks scored"
        trailing={
          scoreMixCategories ? (
            <MixLegend
              counts={counts}
              categories={scoreMixCategories}
              onPlaybookClick={onPlaybookClick}
            />
          ) : null
        }
        bar={
          mixTotal <= 0 ? (
            <div
              className="h-3.5 w-full rounded-lg bg-slate-200/90 sm:h-4"
              role="img"
              aria-label="No playbooks scored yet — progress will appear as you work through the grid."
            />
          ) : (
            <SegmentedProgressBar
              total={mixTotal}
              ariaLabel={`Playbooks scored: ${scoredTotal} of ${totalPlaybooks}`}
              onPlaybookClick={onPlaybookClick}
              segments={
                scoreMixCategories
                  ? (MIX_SEGMENTS.map(({ key, label, color }) => ({
                      id: `mix-bar-${key}`,
                      label,
                      color,
                      count: counts[key],
                      playbooks: scoreMixCategories[key],
                    })) as LegendItem[])
                  : []
              }
            />
          )
        }
      />

      {prospectBreakdown ? (
        <>
          <DimensionProgressRow
            title="Impact"
            prefix="impact"
            setCount={prospectBreakdown.impactSet}
            total={totalPlaybooks}
            defs={IMPACT_LEGEND}
            levelCounts={prospectBreakdown.impactLevels}
            playbooks={prospectBreakdown.impactPlaybooks}
            onPlaybookClick={onPlaybookClick}
          />
          <DimensionProgressRow
            title="Urgency"
            prefix="urgency"
            setCount={prospectBreakdown.urgencySet}
            total={totalPlaybooks}
            defs={URGENCY_LEGEND}
            levelCounts={prospectBreakdown.urgencyLevels}
            playbooks={prospectBreakdown.urgencyPlaybooks}
            onPlaybookClick={onPlaybookClick}
          />
          <DimensionProgressRow
            title="Ease"
            prefix="ease"
            setCount={prospectBreakdown.easeSet}
            total={totalPlaybooks}
            defs={EASE_LEGEND}
            levelCounts={prospectBreakdown.easeLevels}
            playbooks={prospectBreakdown.easePlaybooks}
            onPlaybookClick={onPlaybookClick}
          />
        </>
      ) : null}
    </DialCard>
  );
}

export function BossScoreDialStrip({ totalScore, pillarStats, className = "" }: BossScoreDialStripProps) {
  const hasScores = totalScore != null;
  const cappedTotal = hasScores ? Math.min(100, Math.max(0, totalScore)) : 0;
  const overallPct = hasScores ? Math.round(cappedTotal) : 0;

  return (
    <div className={`w-full ${className}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        <BossScoreHeroCard
          cappedTotal={cappedTotal}
          overallPct={overallPct}
          notStarted={!hasScores}
          className="mx-auto w-full max-w-[20rem] shrink-0 md:mx-0 md:w-[19.5rem]"
        />
        <PillarScoresPanel pillarStats={pillarStats} />
      </div>
    </div>
  );
}
