"use client";

import { useMemo, useState } from "react";
import { getPlaybookMeta } from "@/lib/bossData";
import {
  collectWorkshopProspectPlotPoints,
  impactEaseQuadrantLabel,
  impactUrgencyQuadrantLabel,
  POINTS_TO_URGENCY,
  PROSPECT_EASE_LEVELS,
  WORKSHOP_EASE_META,
  WORKSHOP_IMPACT_META,
  WORKSHOP_PRIORITY_META,
  WORKSHOP_PRIORITIES,
  type PlaybookProspectScores,
  type ProspectEaseLevel,
  type ProspectImpactLevel,
  type ProspectUrgencyLevel,
  type WorkshopProspectPlotPoint,
} from "@/lib/playbookSessionNotes";
import {
  WorkshopProspectFocusHero,
  type WorkshopProspectFocusVariant,
} from "./WorkshopProspectFocusHero";

const CARD_SHELL =
  "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.015)]";

const CARD_HEADER =
  "border-b border-slate-600/40 bg-slate-700 px-4 py-2.5 text-sm font-semibold tracking-wide text-white sm:px-5";

const EASE_DOT: Record<ProspectEaseLevel, string> = {
  3: "bg-green-500",
  2: "bg-yellow-500",
  1: "bg-red-500",
};

type MatrixTab = "impact-ease" | "impact-urgency";
type ViewTab = "focus-first" | MatrixTab;

type PlacedPlot = WorkshopProspectPlotPoint & {
  name: string;
  cellKey: string;
  cellIndex: number;
  cellSize: number;
};

type WorkshopProspectMatrixProps = {
  playbookNotes: Record<string, string>;
  onPlaybookClick?: (ref: string) => void;
  clientName?: string | null;
  variant?: WorkshopProspectFocusVariant;
  className?: string;
};

function scoreLabel(
  scores: PlaybookProspectScores,
  dimension: "impact" | "urgency" | "ease"
): string {
  if (dimension === "impact") {
    const level = scores.impact;
    return level ? WORKSHOP_IMPACT_META[level].label : "—";
  }
  if (dimension === "urgency") {
    const level = scores.urgency;
    return level ? WORKSHOP_PRIORITY_META[POINTS_TO_URGENCY[level]].label : "—";
  }
  const level = scores.ease;
  return level ? WORKSHOP_EASE_META[level].label : "—";
}

function urgencyDotClass(urgency: ProspectUrgencyLevel | undefined): string {
  if (urgency === undefined) return "bg-slate-300";
  return WORKSHOP_PRIORITY_META[POINTS_TO_URGENCY[urgency]].dot;
}

function easeDotClass(ease: ProspectEaseLevel | undefined): string {
  if (ease === undefined) return "bg-slate-300";
  return EASE_DOT[ease];
}

function sortByUrgencyDesc(a: WorkshopProspectPlotPoint, b: WorkshopProspectPlotPoint): number {
  const urgencyDiff = (b.scores.urgency ?? 0) - (a.scores.urgency ?? 0);
  if (urgencyDiff !== 0) return urgencyDiff;
  return (b.importance ?? 0) - (a.importance ?? 0);
}

function sortByEaseDesc(a: WorkshopProspectPlotPoint, b: WorkshopProspectPlotPoint): number {
  const easeDiff = (b.scores.ease ?? 0) - (a.scores.ease ?? 0);
  if (easeDiff !== 0) return easeDiff;
  return (b.importance ?? 0) - (a.importance ?? 0);
}

function groupPlots<T extends WorkshopProspectPlotPoint>(
  plots: T[],
  cellKey: (plot: T) => string | null,
  sortWithinCell: (a: T, b: T) => number
): PlacedPlot[] {
  const grouped = new Map<string, T[]>();
  for (const plot of plots) {
    const key = cellKey(plot);
    if (!key) continue;
    const bucket = grouped.get(key) ?? [];
    bucket.push(plot);
    grouped.set(key, bucket);
  }

  const placed: PlacedPlot[] = [];
  for (const [key, bucket] of grouped) {
    const sorted = [...bucket].sort(sortWithinCell);
    sorted.forEach((plot, index) => {
      placed.push({
        ...plot,
        name: getPlaybookMeta(plot.ref)?.name ?? plot.ref,
        cellKey: key,
        cellIndex: index,
        cellSize: sorted.length,
      });
    });
  }
  return placed;
}

function plotTooltip(plot: PlacedPlot): string {
  return [
    plot.name,
    `Impact: ${scoreLabel(plot.scores, "impact")}`,
    `Urgency: ${scoreLabel(plot.scores, "urgency")}`,
    `Ease: ${scoreLabel(plot.scores, "ease")}`,
    plot.importance !== null ? `Importance: ${plot.importance}/10` : "Importance: —/10",
  ].join("\n");
}

function PlotRow({
  plot,
  tab,
  onPlaybookClick,
  onHover,
  onLeave,
  onSelect,
  active,
}: {
  plot: PlacedPlot;
  tab: MatrixTab;
  onPlaybookClick?: (ref: string) => void;
  onHover: (plot: PlacedPlot) => void;
  onLeave: () => void;
  onSelect: (plot: PlacedPlot) => void;
  active: boolean;
}) {
  const dotClass =
    tab === "impact-ease"
      ? urgencyDotClass(plot.scores.urgency)
      : easeDotClass(plot.scores.ease);

  const rowClass = `flex min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left transition ${
    active ? "bg-white shadow-sm ring-1 ring-sky-200" : "hover:bg-white/90"
  } ${plot.complete ? "opacity-100" : "opacity-50"}`;

  const content = (
    <>
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white ${dotClass}`}
        aria-hidden
      />
      <span className="min-w-0 truncate text-sm font-medium leading-snug text-slate-800">
        {plot.name}
      </span>
    </>
  );

  const handlers = {
    onMouseEnter: () => onHover(plot),
    onMouseLeave: onLeave,
    onFocus: () => onHover(plot),
    onBlur: onLeave,
  };

  return (
    <button
      type="button"
      title={plotTooltip(plot)}
      className={`${rowClass} w-full`}
      aria-label={plot.name}
      aria-pressed={active}
      onClick={() => {
        onSelect(plot);
        onPlaybookClick?.(plot.ref);
      }}
      {...handlers}
    >
      {content}
    </button>
  );
}

function MatrixCell({
  cellPlots,
  tab,
  onPlaybookClick,
  activeRef,
  onHover,
  onLeave,
  onSelect,
  highlightTone,
  cornerLabel,
}: {
  cellPlots: PlacedPlot[];
  tab: MatrixTab;
  onPlaybookClick?: (ref: string) => void;
  activeRef: string | null;
  onHover: (plot: PlacedPlot) => void;
  onLeave: () => void;
  onSelect: (plot: PlacedPlot) => void;
  highlightTone?: "emerald" | "amber";
  cornerLabel?: string | null;
}) {
  const toneClass =
    highlightTone === "emerald"
      ? "bg-emerald-50/70"
      : highlightTone === "amber"
        ? "bg-amber-50/75"
        : "bg-slate-50/80";

  return (
    <div
      className={`relative flex min-h-[6rem] flex-col gap-1 rounded-lg border border-slate-200 p-1.5 ${toneClass}`}
    >
      {cornerLabel ? (
        <span className="pointer-events-none absolute right-2 top-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs">
          {cornerLabel}
        </span>
      ) : null}
      {cellPlots.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-2 py-4 text-xs text-slate-300">
          —
        </div>
      ) : (
        cellPlots.map((plot) => (
          <PlotRow
            key={plot.ref}
            plot={plot}
            tab={tab}
            onPlaybookClick={onPlaybookClick}
            onHover={onHover}
            onLeave={onLeave}
            onSelect={onSelect}
            active={activeRef === plot.ref}
          />
        ))
      )}
    </div>
  );
}

function MatrixTooltip({ plot, tab }: { plot: PlacedPlot | null; tab: MatrixTab }) {
  if (!plot) {
    return (
      <div className="min-h-[8rem] rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-4 text-sm text-slate-500">
        Tap or click a playbook to see full scores.
      </div>
    );
  }

  return (
    <div className="min-h-[8rem] rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
      <p className="text-base font-semibold text-slate-900">{plot.name}</p>
      <p className="mt-0.5 text-sm text-slate-500">{plot.ref}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Impact</dt>
          <dd className="font-medium text-slate-800">{scoreLabel(plot.scores, "impact")}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Urgency</dt>
          <dd className="font-medium text-slate-800">{scoreLabel(plot.scores, "urgency")}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Ease</dt>
          <dd className="font-medium text-slate-800">{scoreLabel(plot.scores, "ease")}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-medium text-slate-700">Importance</dt>
          <dd className="text-base font-bold tabular-nums text-slate-900">
            {plot.importance !== null ? `${plot.importance}/10` : "—/10"}
          </dd>
        </div>
      </dl>
      {tab === "impact-ease" && plot.scores.urgency === undefined ? (
        <p className="mt-2 text-xs text-slate-500">Urgency not set — dot shown in grey.</p>
      ) : null}
      {tab === "impact-urgency" && plot.scores.ease === undefined ? (
        <p className="mt-2 text-xs text-slate-500">Ease not set — dot shown in grey.</p>
      ) : null}
      {!plot.complete ? (
        <p className="mt-2 text-xs text-amber-700">Incomplete scoring — faded on the chart.</p>
      ) : null}
    </div>
  );
}

function Legend({ tab }: { tab: MatrixTab }) {
  if (tab === "impact-ease") {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
          <span className="font-medium text-slate-500">Dot colour = urgency</span>
          {WORKSHOP_PRIORITIES.map((priority) => (
            <span key={priority} className="inline-flex items-center gap-1.5">
              <span
                className={`h-3 w-3 rounded-full ${WORKSHOP_PRIORITY_META[priority].dot}`}
                aria-hidden
              />
              {WORKSHOP_PRIORITY_META[priority].label}
            </span>
          ))}
        </div>
        <p className="text-sm text-slate-500">In each cell, playbooks are ordered most urgent first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
        <span className="font-medium text-slate-500">Dot colour = ease</span>
        {PROSPECT_EASE_LEVELS.slice()
          .reverse()
          .map((level) => (
            <span key={level} className="inline-flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded-full ${EASE_DOT[level]}`} aria-hidden />
              {WORKSHOP_EASE_META[level].label}
            </span>
          ))}
      </div>
      <p className="text-sm text-slate-500">In each cell, playbooks are ordered easiest first.</p>
    </div>
  );
}

function ImpactEaseMatrix({
  plots,
  onPlaybookClick,
  onHover,
  onLeave,
  onSelect,
  activePlot,
}: {
  plots: WorkshopProspectPlotPoint[];
  onPlaybookClick?: (ref: string) => void;
  onHover: (plot: PlacedPlot) => void;
  onLeave: () => void;
  onSelect: (plot: PlacedPlot) => void;
  activePlot: PlacedPlot | null;
}) {
  const placed = useMemo(
    () =>
      groupPlots(
        plots,
        (plot) =>
          plot.scores.impact !== undefined && plot.scores.ease !== undefined
            ? `${plot.scores.impact}-${plot.scores.ease}`
            : null,
        sortByUrgencyDesc
      ),
    [plots]
  );

  const easeColumns: ProspectEaseLevel[] = [1, 2, 3];
  const impactRows: ProspectImpactLevel[] = [3, 2, 1];

  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
      <div />
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${easeColumns.length}, minmax(0, 1fr))` }}
      >
        {easeColumns.map((level) => (
          <div key={level} className="text-center text-sm font-medium text-slate-600">
            {WORKSHOP_EASE_META[level].label}
          </div>
        ))}
      </div>

      {impactRows.map((impact) => (
        <div key={impact} className="contents">
          <div className="flex items-center justify-end pr-2 text-sm font-medium text-slate-600">
            {WORKSHOP_IMPACT_META[impact].label}
          </div>
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${easeColumns.length}, minmax(0, 1fr))` }}
          >
            {easeColumns.map((ease) => {
              const cellKey = `${impact}-${ease}`;
              const cellPlots = placed.filter((plot) => plot.cellKey === cellKey);
              return (
                <MatrixCell
                  key={cellKey}
                  cellPlots={cellPlots}
                  tab="impact-ease"
                  onPlaybookClick={onPlaybookClick}
                  activeRef={activePlot?.ref ?? null}
                  onHover={onHover}
                  onLeave={onLeave}
                  onSelect={onSelect}
                  highlightTone={impact === 3 && ease === 3 ? "emerald" : undefined}
                  cornerLabel={impactEaseQuadrantLabel(impact, ease)}
                />
              );
            })}
          </div>
        </div>
      ))}

      <div className="col-span-2 mt-2 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Legend tab="impact-ease" />
        <MatrixTooltip plot={activePlot} tab="impact-ease" />
      </div>
    </div>
  );
}

function ImpactUrgencyMatrix({
  plots,
  onPlaybookClick,
  onHover,
  onLeave,
  onSelect,
  activePlot,
}: {
  plots: WorkshopProspectPlotPoint[];
  onPlaybookClick?: (ref: string) => void;
  onHover: (plot: PlacedPlot) => void;
  onLeave: () => void;
  onSelect: (plot: PlacedPlot) => void;
  activePlot: PlacedPlot | null;
}) {
  const placed = useMemo(
    () =>
      groupPlots(
        plots,
        (plot) =>
          plot.scores.impact !== undefined && plot.scores.urgency !== undefined
            ? `${plot.scores.impact}-${plot.scores.urgency}`
            : null,
        sortByEaseDesc
      ),
    [plots]
  );

  const urgencyColumns: ProspectUrgencyLevel[] = [1, 2, 3, 4];
  const impactRows: ProspectImpactLevel[] = [3, 2, 1];

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[36rem] grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <div />
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${urgencyColumns.length}, minmax(0, 1fr))` }}
        >
          {urgencyColumns.map((level) => (
            <div key={level} className="text-center text-sm font-medium text-slate-600">
              {WORKSHOP_PRIORITY_META[POINTS_TO_URGENCY[level]].label}
            </div>
          ))}
        </div>

        {impactRows.map((impact) => (
          <div key={impact} className="contents">
            <div className="flex items-center justify-end pr-2 text-sm font-medium text-slate-600">
              {WORKSHOP_IMPACT_META[impact].label}
            </div>
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${urgencyColumns.length}, minmax(0, 1fr))` }}
            >
              {urgencyColumns.map((urgency) => {
                const cellKey = `${impact}-${urgency}`;
                const cellPlots = placed.filter((plot) => plot.cellKey === cellKey);
                return (
                  <MatrixCell
                    key={cellKey}
                    cellPlots={cellPlots}
                    tab="impact-urgency"
                    onPlaybookClick={onPlaybookClick}
                    activeRef={activePlot?.ref ?? null}
                    onHover={onHover}
                    onLeave={onLeave}
                    onSelect={onSelect}
                    highlightTone={impact === 3 && urgency === 4 ? "amber" : undefined}
                    cornerLabel={impactUrgencyQuadrantLabel(impact, urgency)}
                  />
                );
              })}
            </div>
          </div>
        ))}

        <div className="col-span-2 mt-2 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <Legend tab="impact-urgency" />
          <MatrixTooltip plot={activePlot} tab="impact-urgency" />
        </div>
      </div>
    </div>
  );
}

const VIEW_TABS: { id: ViewTab; label: string; axisY?: string; axisX?: string }[] = [
  { id: "focus-first", label: "Focus first" },
  { id: "impact-ease", label: "Impact × Ease", axisY: "Impact", axisX: "Ease" },
  { id: "impact-urgency", label: "Impact × Urgency", axisY: "Impact", axisX: "Urgency" },
];

export function WorkshopProspectMatrix({
  playbookNotes,
  onPlaybookClick,
  clientName,
  variant = "coach",
  className = "",
}: WorkshopProspectMatrixProps) {
  const [tab, setTab] = useState<ViewTab>("focus-first");
  const [activePlot, setActivePlot] = useState<PlacedPlot | null>(null);

  const plots = useMemo(
    () => collectWorkshopProspectPlotPoints(playbookNotes),
    [playbookNotes]
  );

  const unplaced = useMemo(() => {
    if (tab === "focus-first") return [];
    return plots
      .filter((plot) => {
        if (tab === "impact-ease") {
          return plot.scores.impact === undefined || plot.scores.ease === undefined;
        }
        return plot.scores.impact === undefined || plot.scores.urgency === undefined;
      })
      .map((plot) => ({
        ...plot,
        name: getPlaybookMeta(plot.ref)?.name ?? plot.ref,
      }));
  }, [plots, tab]);

  const activeTab = VIEW_TABS.find((entry) => entry.id === tab)!;
  const sectionTitle =
    variant === "client" ? "What to focus on first" : "Priority";
  const sectionSubcopy =
    variant === "client"
      ? "Your clearest priorities from today’s workshop."
      : "Score playbooks in the grid — importance combines impact, urgency, and ease.";

  return (
    <section className={`${CARD_SHELL} ${className}`}>
      <div className={CARD_HEADER}>{sectionTitle}</div>
      <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-slate-600">{sectionSubcopy}</p>
          <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-1">
            {VIEW_TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setTab(entry.id);
                  setActivePlot(null);
                }}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  tab === entry.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-5 sm:px-6 sm:py-6">
        {plots.length === 0 ? (
          <p className="text-sm text-slate-500">
            {variant === "client"
              ? "Your coach will score playbooks during the workshop to build your priority list."
              : "Open a playbook from the grid and set impact, urgency, and ease to plot it here."}
          </p>
        ) : tab === "focus-first" ? (
          <WorkshopProspectFocusHero
            playbookNotes={playbookNotes}
            clientName={clientName}
            variant={variant}
            onPlaybookClick={onPlaybookClick}
          />
        ) : (
          <>
            <p className="mb-4 text-sm font-medium text-slate-500">See the full picture</p>
            <div className="mb-4 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span>{activeTab.axisY} ↑</span>
              <span>{activeTab.axisX} →</span>
            </div>

            {tab === "impact-ease" ? (
              <ImpactEaseMatrix
                plots={plots}
                onPlaybookClick={onPlaybookClick}
                onHover={(plot) => setActivePlot(plot)}
                onLeave={() => setActivePlot(null)}
                onSelect={setActivePlot}
                activePlot={activePlot}
              />
            ) : (
              <ImpactUrgencyMatrix
                plots={plots}
                onPlaybookClick={onPlaybookClick}
                onHover={(plot) => setActivePlot(plot)}
                onLeave={() => setActivePlot(null)}
                onSelect={setActivePlot}
                activePlot={activePlot}
              />
            )}

            {unplaced.length > 0 ? (
              <div className="mt-6 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {variant === "client" ? "Still to decide together" : "Not on this chart"}
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {unplaced.map((plot) => (
                    <li key={plot.ref}>
                      {onPlaybookClick ? (
                        <button
                          type="button"
                          onClick={() => onPlaybookClick(plot.ref)}
                          className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-200"
                        >
                          {plot.name}
                          {!plot.complete ? " (incomplete)" : null}
                        </button>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
                          {plot.name}
                          {!plot.complete ? " (incomplete)" : null}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

export type { WorkshopProspectFocusVariant };
