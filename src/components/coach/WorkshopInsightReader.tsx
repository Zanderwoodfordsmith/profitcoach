"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { AREAS, BOSS_FOUNDATION_COLOR, WHEEL_COLORS } from "@/lib/bossData";
import {
  getOverallLevel,
  LEVEL_NAMES,
  PILLAR_KEYS,
  type InsightPriorityPlaybook,
} from "@/lib/insightEngine";
import type { StoredInsights } from "@/lib/insightGenerator";
import type { AnswersMap } from "@/lib/bossScores";
import { computeFocusAreas } from "@/lib/bossScores";
import { getTopPriorityPlaybooks } from "@/lib/playbookSessionNotes";
import { WorkshopPriorityPlaybookCard } from "@/components/coach/WorkshopPriorityPlaybookCard";
import { InsightsGeneratingProgress } from "@/components/coach/InsightsGeneratingProgress";
import {
  BOSS_SCORE_SATURATED,
  type BossScoreHue,
} from "@/lib/bossScorecardColors";

const FALLBACK_INSIGHT = { title: "Insight", body: "Insights will appear here once generated." };

const PILLAR_META: Record<(typeof PILLAR_KEYS)[number], { accent: string }> = {
  foundation: { accent: BOSS_FOUNDATION_COLOR },
  vision: { accent: "#0c5290" },
  velocity: { accent: "#42a1ee" },
  value: { accent: "#5dcce3" },
};

const PILLAR_LABELS: Record<(typeof PILLAR_KEYS)[number], string> = {
  foundation: "Foundation",
  vision: "Clarify Vision",
  velocity: "Control Velocity",
  value: "Create Value",
};

const STATUS_DOT: Record<0 | 1, string> = { 0: "#ef4444", 1: "#f59e0b" };

function levelAccent(levelIdx: number): string {
  const hue = Math.min(5, Math.max(1, levelIdx + 1)) as BossScoreHue;
  return BOSS_SCORE_SATURATED[hue];
}

function getPriorityPlaybooksForContext(
  answers: AnswersMap,
  context: { levelIdx?: number; pillarIdx?: number; areaIdx?: number },
  count: number
): InsightPriorityPlaybook[] {
  const items = computeFocusAreas(answers);
  let filtered = items;
  if (context.levelIdx != null) {
    const level = context.levelIdx + 1;
    filtered = filtered.filter((i) => i.level === level);
  }
  if (context.pillarIdx != null) {
    const areaIndices =
      context.pillarIdx === 0
        ? [0]
        : context.pillarIdx === 1
          ? [1, 2, 3]
          : context.pillarIdx === 2
            ? [4, 5, 6]
            : [7, 8, 9];
    filtered = filtered.filter((i) => areaIndices.includes(i.area));
  }
  if (context.areaIdx != null) {
    filtered = filtered.filter((i) => i.area === context.areaIdx);
  }
  return filtered.slice(0, count).map((i) => ({ ref: i.ref, name: i.name, status: i.status }));
}

function PriorityPill({
  name,
  status,
  accent,
  onClick,
}: {
  name: string;
  status: 0 | 1;
  accent: string;
  onClick?: () => void;
}) {
  const dotColor = STATUS_DOT[status];
  const className =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors";
  const style = {
    background: `${accent}08`,
    borderColor: `${accent}18`,
  };
  const content = (
    <>
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: dotColor }}
      />
      {name}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} cursor-pointer hover:opacity-90`}
        style={style}
      >
        {content}
      </button>
    );
  }
  return (
    <span className={className} style={style}>
      {content}
    </span>
  );
}

type ParsedTopic =
  | { kind: "overview" }
  | { kind: "levels"; specific: number | null }
  | { kind: "pillars"; specific: number | null }
  | { kind: "areas"; specific: number | null };

function parseTopic(value: string): ParsedTopic {
  if (value === "overview") return { kind: "overview" };
  const [kind, raw] = value.split(":");
  if (kind === "levels") {
    return { kind: "levels", specific: raw === "overview" ? null : Number(raw) };
  }
  if (kind === "pillars") {
    return { kind: "pillars", specific: raw === "overview" ? null : Number(raw) };
  }
  if (kind === "areas") {
    return { kind: "areas", specific: raw === "overview" ? null : Number(raw) };
  }
  return { kind: "overview" };
}

const TOPIC_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: "overview", label: "Overview — full score" },
  { value: "levels:overview", label: "All levels — overview" },
  ...([0, 1, 2, 3, 4] as const).map((i) => ({
    value: `levels:${i}`,
    label: LEVEL_NAMES[i + 1],
  })),
  { value: "pillars:overview", label: "All pillars — overview" },
  ...PILLAR_KEYS.map((key, i) => ({
    value: `pillars:${i}`,
    label: PILLAR_LABELS[key],
  })),
  { value: "areas:overview", label: "All areas — overview" },
  ...AREAS.map((area, i) => ({
    value: `areas:${i}`,
    label: area.name,
  })),
];

function topicSelectLabel(value: string): string {
  return TOPIC_SELECT_OPTIONS.find((o) => o.value === value)?.label ?? "Overview — full score";
}

function topicTabFromValue(value: string): "overview" | "levels" | "pillars" | "areas" {
  const parsed = parseTopic(value);
  if (parsed.kind === "overview") return "overview";
  return parsed.kind;
}

const INSIGHT_TOPIC_TABS = [
  { id: "overview" as const, label: "Overview" },
  { id: "levels" as const, label: "Levels" },
  { id: "pillars" as const, label: "Pillars" },
  { id: "areas" as const, label: "Areas" },
];

const LEVEL_SUB_OPTIONS: { value: string; label: string }[] = [
  { value: "levels:overview", label: "All levels" },
  ...([0, 1, 2, 3, 4] as const).map((i) => ({
    value: `levels:${i}`,
    label: `${i + 1}. ${LEVEL_NAMES[i + 1]}`,
  })),
];

const PILLAR_SUB_OPTIONS: { value: string; label: string }[] = [
  { value: "pillars:overview", label: "All pillars" },
  ...PILLAR_KEYS.map((key, i) => ({
    value: `pillars:${i}`,
    label: PILLAR_LABELS[key],
  })),
];

const AREA_SUB_OPTIONS: { value: string; label: string }[] = [
  { value: "areas:overview", label: "All areas" },
  ...AREAS.map((area, i) => ({
    value: `areas:${i}`,
    label: area.name,
  })),
];

const TAB_DEFAULT_VALUE: Record<
  Exclude<(typeof INSIGHT_TOPIC_TABS)[number]["id"], "overview">,
  string
> = {
  levels: "levels:overview",
  pillars: "pillars:overview",
  areas: "areas:overview",
};

function subOptionsForTab(tab: (typeof INSIGHT_TOPIC_TABS)[number]["id"]) {
  if (tab === "levels") return LEVEL_SUB_OPTIONS;
  if (tab === "pillars") return PILLAR_SUB_OPTIONS;
  if (tab === "areas") return AREA_SUB_OPTIONS;
  return [];
}

function InsightTopicTabs({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const activeTab = topicTabFromValue(value);
  const subOptions = subOptionsForTab(activeTab);

  const handleTabChange = (tab: (typeof INSIGHT_TOPIC_TABS)[number]["id"]) => {
    if (tab === "overview") {
      onChange("overview");
      return;
    }
    if (topicTabFromValue(value) === tab) return;
    onChange(TAB_DEFAULT_VALUE[tab]);
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Insight categories"
        className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1"
      >
        {INSIGHT_TOPIC_TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => handleTabChange(tab.id)}
              className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-all sm:px-3 sm:py-2 sm:text-sm ${
                selected
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {subOptions.length > 0 ? (
        <div
          role="tabpanel"
          aria-label={`${activeTab} insight topics`}
          className="mt-2.5 flex flex-wrap gap-x-2.5 gap-y-2"
        >
          {subOptions.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                aria-pressed={selected}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors sm:text-sm ${
                  selected
                    ? "bg-sky-100 text-sky-900 ring-1 ring-sky-200/80"
                    : "bg-slate-50 text-slate-600 ring-1 ring-slate-200/60 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function FullOverviewModal({
  open,
  onClose,
  levelLabel,
  levelAccentColor,
  body,
  answers,
  playbookNotes,
  onPlaybookClick,
}: {
  open: boolean;
  onClose: () => void;
  levelLabel: string;
  levelAccentColor: string;
  body: string;
  answers: AnswersMap;
  playbookNotes: Record<string, string>;
  onPlaybookClick?: (ref: string) => void;
}) {
  const topPlaybooks = useMemo(
    () => getTopPriorityPlaybooks(answers, playbookNotes, 3),
    [answers, playbookNotes]
  );

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="insight-full-overview-title"
      onClick={onClose}
    >
      <div
        className="relative my-4 w-full max-w-5xl rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-slate-900/10 sm:p-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-3 -top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition hover:bg-slate-50 hover:text-slate-800"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>

        <div className="min-w-0 border-b border-slate-200 pb-6">
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: levelAccentColor }}
          >
            {levelLabel}
          </p>
          <h2
            id="insight-full-overview-title"
            className="mt-1.5 text-lg font-semibold text-slate-900 sm:text-xl"
          >
            Full overview
          </h2>
        </div>
        <div className="max-h-[min(70vh,640px)] overflow-y-auto pt-6">
          <div className="whitespace-pre-line text-base leading-relaxed text-slate-600">
            {body}
          </div>
        </div>

        {topPlaybooks.length > 0 ? (
          <div className="mt-10 border-t border-slate-200 pt-8">
            <div className="mb-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Fix first
              </span>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Your Top{" "}
                <span className="font-bold">3 Priorities</span>
              </h3>
              <p className="mt-2 max-w-md text-sm text-slate-500 sm:text-base">
                These are the moves that unlock the next level — in order.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {topPlaybooks.map((item, idx) => (
                <WorkshopPriorityPlaybookCard
                  key={item.ref}
                  index={idx + 1}
                  name={item.name}
                  level={item.level}
                  status={item.status}
                  description={item.description}
                  onClick={
                    onPlaybookClick
                      ? () => {
                          onPlaybookClick(item.ref);
                          onClose();
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export type WorkshopInsightReaderProps = {
  answers: AnswersMap;
  totalScore: number;
  insights: StoredInsights | null;
  insightsGenerating?: boolean;
  insightsGenerationReady?: boolean;
  insightsGenerationError?: string | null;
  onInsightsGenerationFinished?: () => void;
  playbookNotes?: Record<string, string>;
  /** Opens the in-session playbook sheet (Boss Pro grid modal). */
  onPlaybookClick?: (ref: string) => void;
};

export function WorkshopInsightReader({
  answers,
  totalScore,
  insights,
  insightsGenerating = false,
  insightsGenerationReady = false,
  insightsGenerationError = null,
  onInsightsGenerationFinished,
  playbookNotes = {},
  onPlaybookClick,
}: WorkshopInsightReaderProps) {
  const [topicValue, setTopicValue] = useState("overview");
  const [fullOverviewOpen, setFullOverviewOpen] = useState(false);

  const overall = getOverallLevel(totalScore);
  const overallLevelColor =
    BOSS_SCORE_SATURATED[overall.level as BossScoreHue] ?? "#0c5290";
  const overallLevelLabel = `Level ${overall.level} — ${overall.name}`;

  const parsed = parseTopic(topicValue);

  const resolved = useMemo(() => {
    let accent = overallLevelColor;
    let insight = FALLBACK_INSIGHT;
    let isGlobalOverview = false;
    let isCategoryOverview = false;
    let playbooks: InsightPriorityPlaybook[] = [];

    if (parsed.kind === "overview") {
      isGlobalOverview = true;
      insight = insights?.overallShort ?? FALLBACK_INSIGHT;
    } else if (parsed.kind === "levels") {
      if (parsed.specific == null) {
        isCategoryOverview = true;
        insight = insights?.levelsDefault ?? FALLBACK_INSIGHT;
      } else {
        const levelIdx = parsed.specific;
        accent = levelAccent(levelIdx);
        insight = insights?.levels?.[String(levelIdx)] ?? FALLBACK_INSIGHT;
        playbooks = getPriorityPlaybooksForContext(answers, { levelIdx }, 3);
      }
    } else if (parsed.kind === "pillars") {
      if (parsed.specific == null) {
        isCategoryOverview = true;
        insight = insights?.pillarsDefault ?? FALLBACK_INSIGHT;
      } else {
        const pillarIdx = parsed.specific as 0 | 1 | 2 | 3;
        const key = PILLAR_KEYS[pillarIdx];
        accent = PILLAR_META[key].accent;
        insight = insights?.pillars?.[key] ?? FALLBACK_INSIGHT;
        playbooks = getPriorityPlaybooksForContext(answers, { pillarIdx }, 3);
      }
    } else if (parsed.specific == null) {
      isCategoryOverview = true;
      insight = insights?.areasDefault ?? FALLBACK_INSIGHT;
    } else {
      const areaIdx = parsed.specific;
      accent = WHEEL_COLORS[areaIdx];
      insight = insights?.areas?.[String(areaIdx)] ?? FALLBACK_INSIGHT;
      playbooks = getPriorityPlaybooksForContext(answers, { areaIdx }, 3);
    }

    return {
      accentColor: accent,
      insight,
      isGlobalOverview,
      isCategoryOverview,
      priorityPlaybooks: playbooks,
    };
  }, [answers, insights, overallLevelColor, parsed]);

  const longOverviewBody =
    insights?.overallLong?.body ?? "Full overview will appear once insights have been generated.";

  const showPriorityPlaybooks =
    !resolved.isGlobalOverview &&
    !resolved.isCategoryOverview &&
    resolved.priorityPlaybooks.length > 0;

  const selectedTopicLabel = topicSelectLabel(topicValue);
  const showInsightTitle =
    !insightsGenerating &&
    resolved.insight.title.trim().length > 0 &&
    resolved.insight.title.trim() !== selectedTopicLabel;

  const showFooterLink = resolved.isGlobalOverview && !insightsGenerating;
  const showFooterPlaybooks = showPriorityPlaybooks && !insightsGenerating;

  return (
    <>
      <InsightTopicTabs value={topicValue} onChange={setTopicValue} />

      <div className="mt-6">
        {insightsGenerating ? (
          <InsightsGeneratingProgress
            ready={insightsGenerationReady}
            error={insightsGenerationError}
            onFinished={() => onInsightsGenerationFinished?.()}
          />
        ) : (
          <>
            {showInsightTitle ? (
              <h4 className="mb-2 text-base font-semibold leading-tight text-slate-800">
                {resolved.insight.title}
              </h4>
            ) : null}
            <div className="whitespace-pre-line text-base leading-relaxed text-slate-600">
              {resolved.insight.body}
            </div>
          </>
        )}

        {showFooterLink ? (
          <button
            type="button"
            onClick={() => setFullOverviewOpen(true)}
            className="mt-4 text-sm font-semibold text-sky-600 hover:text-sky-700"
          >
            See full overview
          </button>
        ) : null}

        {showFooterPlaybooks ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              Priority playbooks
            </p>
            <div className="flex flex-wrap gap-2">
              {resolved.priorityPlaybooks.map((p) => (
                <PriorityPill
                  key={p.ref}
                  name={p.name}
                  status={p.status}
                  accent={resolved.accentColor}
                  onClick={onPlaybookClick ? () => onPlaybookClick(p.ref) : undefined}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <FullOverviewModal
        open={fullOverviewOpen}
        onClose={() => setFullOverviewOpen(false)}
        levelLabel={overallLevelLabel}
        levelAccentColor={overallLevelColor}
        body={longOverviewBody}
        answers={answers}
        playbookNotes={playbookNotes}
        onPlaybookClick={onPlaybookClick}
      />
    </>
  );
}
