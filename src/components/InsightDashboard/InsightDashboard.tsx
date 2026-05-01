"use client";

import { useState } from "react";
import Link from "next/link";
import { AREAS } from "@/lib/bossData";
import { WHEEL_COLORS } from "@/lib/bossData";
import {
  getOverallLevel,
  LEVEL_NAMES,
  LEVEL_SUBTITLES,
  PILLAR_KEYS,
  PILLAR_NAMES,
  type InsightPriorityPlaybook,
} from "@/lib/insightEngine";
import type { StoredInsights } from "@/lib/insightGenerator";
import type { AnswersMap } from "@/lib/bossScores";
import {
  computeFocusAreas,
  computeLevelScores,
  computePillarScoresWithFoundation,
} from "@/lib/bossScores";

type LevelColorScheme = "original" | "diagram";

/** Original blue–teal gradient scheme (saved for revert) */
const LEVEL_COLORS_ORIGINAL: { gradient: string; accent: string }[] = [
  { gradient: "linear-gradient(90deg, #093a6d, #0c5290)", accent: "#0c5290" },
  { gradient: "linear-gradient(90deg, #0c5290, #3183d9)", accent: "#3183d9" },
  { gradient: "linear-gradient(90deg, #3183d9, #42a1ee)", accent: "#42a1ee" },
  { gradient: "linear-gradient(90deg, #42a1ee, #1ca0c2)", accent: "#1ca0c2" },
  { gradient: "linear-gradient(90deg, #1ca0c2, #5dcce3)", accent: "#5dcce3" },
];

/** Vibrant multi-color scheme (custom palette) */
const LEVEL_COLORS_DIAGRAM: { gradient: string; accent: string }[] = [
  { gradient: "linear-gradient(90deg, #FC2975, #e91e6a)", accent: "#FC2975" },
  { gradient: "linear-gradient(90deg, #FF7400, #e66a00)", accent: "#FF7400" },
  { gradient: "linear-gradient(90deg, #B743F0, #9a38cc)", accent: "#B743F0" },
  { gradient: "linear-gradient(90deg, #07BC84, #06a372)", accent: "#07BC84" },
  { gradient: "linear-gradient(90deg, #238BF7, #1a74d9)", accent: "#238BF7" },
];

function getLevelColors(scheme: LevelColorScheme) {
  return scheme === "diagram" ? LEVEL_COLORS_DIAGRAM : LEVEL_COLORS_ORIGINAL;
}

/** Level icons for dashboard progress bar (Overwhelm, Overworked, Organised, Overseer, Owner) */
const LEVEL_ICONS = [
  "/levels/overwhelm.png",
  "/levels/overworked.png",
  "/levels/organised.png",
  "/levels/overseer.png",
  "/levels/owner.png",
];

const PILLAR_META: Record<(typeof PILLAR_KEYS)[number], { accent: string; gradient: string }> = {
  foundation: { accent: "#A855F7", gradient: "linear-gradient(90deg, #A855F7, #c084fc)" },
  vision: { accent: "#0c5290", gradient: "linear-gradient(90deg, #093a6d, #0c5290)" },
  velocity: { accent: "#42a1ee", gradient: "linear-gradient(90deg, #3183d9, #42a1ee)" },
  value: { accent: "#5dcce3", gradient: "linear-gradient(90deg, #1ca0c2, #5dcce3)" },
};

const PILLAR_LABELS: Record<(typeof PILLAR_KEYS)[number], string> = {
  foundation: "Foundation",
  vision: "Clarify Vision",
  velocity: "Control Velocity",
  value: "Create Value",
};

const PILLAR_SUBTITLES: Record<(typeof PILLAR_KEYS)[number], string> = {
  foundation: "Your personal habits, energy, mindset and leadership",
  vision: "Purpose, strategy, positioning and disciplined planning",
  velocity: "Cash flow, revenue, marketing and operations",
  value: "Financials, systems, infrastructure and team",
};

const STATUS_DOT: Record<0 | 1, string> = { 0: "#ef4444", 1: "#f59e0b" };

type TabId = "levels" | "pillars" | "areas";

export type CoachingSectionContext = {
  tab: "levels" | "pillars" | "areas";
  levelIdx?: number;
  pillarIdx?: number;
  areaIdx?: number;
  insightTitle: string;
  insightBody: string;
  priorityPlaybooks: InsightPriorityPlaybook[];
};

export type InsightDashboardProps = {
  answers: AnswersMap;
  totalScore: number;
  insights: StoredInsights | null;
  insightsGenerating?: boolean;
  onRefreshInsights?: () => void;
  onGetCoaching?: (context: CoachingSectionContext) => void;
  playbookLinkBase?: string;
};

function describeArc(
  startAngle: number,
  endAngle: number,
  radius: number,
  cx: number,
  cy: number
): string {
  const polarToCart = (angle: number, r: number) => ({
    x: cx + r * Math.cos((angle * Math.PI) / 180),
    y: cy - r * Math.sin((angle * Math.PI) / 180),
  });
  const s = polarToCart(startAngle, radius);
  const e = polarToCart(endAngle, radius);
  const large = startAngle - endAngle > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
}

function SpeedDialGauge({ score, size = 160 }: { score: number; size?: number }) {
  const radius = (size - 20) / 2;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const startAngle = 225;
  const endAngle = -45;
  const totalArc = 270;
  const strokeW = 12;
  const fillAngle = startAngle - (score / 100) * totalArc;

  return (
    <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`} className="shrink-0">
      <defs>
        <linearGradient id="insightDialGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#093a6d" />
          <stop offset="50%" stopColor="#42a1ee" />
          <stop offset="100%" stopColor="#5dcce3" />
        </linearGradient>
      </defs>
      <path
        d={describeArc(startAngle, endAngle, radius, cx, cy)}
        fill="none"
        stroke="#edf2f7"
        strokeWidth={strokeW}
        strokeLinecap="round"
      />
      <path
        d={describeArc(startAngle, Math.max(fillAngle, endAngle), radius, cx, cy)}
        fill="none"
        stroke="url(#insightDialGrad)"
        strokeWidth={strokeW}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
      <text
        x={cx}
        y={cy - 10}
        textAnchor="middle"
        className="font-mono text-[32px] font-bold text-slate-900"
      >
        {score}
      </text>
      <text
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        className="text-[10px] font-medium text-slate-400"
      >
        out of 100
      </text>
    </svg>
  );
}

function PriorityPill({
  name,
  status,
  accent,
  href,
}: {
  name: string;
  status: 0 | 1;
  accent: string;
  href?: string;
}) {
  const dotColor = STATUS_DOT[status];
  const className =
    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors";
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
  if (href) {
    return (
      <Link
        href={href}
        className={`${className} hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1`}
        style={style}
      >
        {content}
      </Link>
    );
  }
  return (
    <span className={className} style={style}>
      {content}
    </span>
  );
}

function ProgressBar({
  percent,
  gradient,
  height = 12,
}: {
  percent: number;
  gradient: string;
  height?: number;
}) {
  return (
    <div
      className="overflow-hidden rounded-lg bg-slate-100"
      style={{ height }}
    >
      <div
        className="h-full rounded-lg transition-all duration-700 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: gradient }}
      />
    </div>
  );
}

function ScoreRow({
  tag,
  tagColor,
  name,
  subtitle,
  score,
  gradient,
  selected,
  onClick,
  iconSrc,
}: {
  tag: string | null;
  tagColor: string;
  name: string;
  subtitle: string;
  score: number;
  gradient: string;
  selected: boolean;
  onClick: () => void;
  iconSrc?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col gap-4 rounded-xl border px-5 pt-4 pb-3 text-left shadow-sm transition-all"
      style={{
        background: selected ? `${tagColor}08` : "white",
        borderColor: selected ? `${tagColor}25` : "#e2e8f0",
        borderWidth: "1px",
      }}
    >
      {iconSrc ? (
        <div className="flex w-full flex-col gap-4 pb-3">
          <div className="flex w-full items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg"
              style={{ backgroundColor: tagColor }}
            >
              <div
                className="h-9 w-9 shrink-0"
                style={{
                  maskImage: `url(${iconSrc})`,
                  maskSize: "contain",
                  maskRepeat: "no-repeat",
                  maskPosition: "center",
                  WebkitMaskImage: `url(${iconSrc})`,
                  WebkitMaskSize: "contain",
                  WebkitMaskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  backgroundColor: "white",
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-medium" style={{ color: "#030403" }}>{name}</h3>
              {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
            </div>
            <span
              className="shrink-0 text-2xl font-medium tabular-nums"
              style={{ color: tagColor }}
            >
              {score}%
            </span>
          </div>
          <div className="mt-1">
            <ProgressBar percent={score} gradient={gradient} />
          </div>
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          {tag && (
            <p
              className="mb-0.5 text-xs font-bold uppercase tracking-[0.25em]"
              style={{ color: tagColor }}
            >
              {tag}
            </p>
          )}
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-lg font-medium" style={{ color: "#030403" }}>{name}</h3>
              {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
            </div>
            <span
              className="text-2xl font-medium tabular-nums"
              style={{ color: tagColor }}
            >
              {score}%
            </span>
          </div>
          <ProgressBar percent={score} gradient={gradient} />
        </div>
      )}
    </button>
  );
}

function PillarDivider({
  label,
  color,
  isFirst,
}: {
  label: string;
  color: string;
  isFirst: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 ${isFirst ? "" : "mt-2.5"}`}
      style={{ padding: "6px 16px" }}
    >
      <span className="text-base font-bold leading-none" style={{ color }}>
        —
      </span>
      <span
        className="text-xs font-bold uppercase tracking-[0.2em]"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  );
}

function InsightPanel({
  insight,
  accentColor,
  isOverview,
  priorityPlaybooks,
  playbookLinkBase,
  onGetCoaching,
  sectionContext,
}: {
  insight: { title: string; body: string };
  accentColor: string;
  isOverview: boolean;
  priorityPlaybooks: InsightPriorityPlaybook[];
  playbookLinkBase?: string;
  onGetCoaching?: (context: CoachingSectionContext) => void;
  sectionContext?: CoachingSectionContext | null;
}) {
  return (
    <div
      className="flex flex-1 flex-col justify-center border-l border-slate-100 bg-slate-50/80 p-6 transition-colors"
      style={{ flexBasis: "40%" }}
    >
      <div
        className="mb-3.5 flex h-8 w-8 items-center justify-center rounded-lg"
        style={{
          background: isOverview
            ? "linear-gradient(135deg, #94a3b8, #cbd5e1)"
            : `linear-gradient(135deg, ${accentColor}, ${accentColor}99)`,
        }}
      >
        {isOverview ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        )}
      </div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
        {isOverview ? "Overview" : "Insight"}
      </p>
      <h4 className="mb-2 text-lg font-bold leading-tight text-slate-800">
        {insight.title}
      </h4>
      <div className="whitespace-pre-line text-base leading-relaxed text-slate-600">
        {insight.body}
      </div>
      {!isOverview && priorityPlaybooks.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            Your priority playbooks
          </p>
          <div className="flex flex-col gap-2">
            {priorityPlaybooks.map((p) => (
              <PriorityPill
                key={p.ref}
                name={p.name}
                status={p.status}
                accent={accentColor}
                href={playbookLinkBase ? `${playbookLinkBase}/${p.ref}` : undefined}
              />
            ))}
          </div>
        </div>
      )}
      {!isOverview && (
        <button
          type="button"
          onClick={() => onGetCoaching?.(sectionContext!)}
          disabled={!sectionContext || !onGetCoaching}
          className="mt-4 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
          style={{
            background: `linear-gradient(135deg, ${accentColor}dd, ${accentColor}aa)`,
            boxShadow: `0 2px 8px ${accentColor}25`,
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Get AI coaching on this
        </button>
      )}
    </div>
  );
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
      context.pillarIdx === 0 ? [0] : context.pillarIdx === 1 ? [1, 2, 3] : context.pillarIdx === 2 ? [4, 5, 6] : [7, 8, 9];
    filtered = filtered.filter((i) => areaIndices.includes(i.area));
  }
  if (context.areaIdx != null) {
    filtered = filtered.filter((i) => i.area === context.areaIdx);
  }
  return filtered.slice(0, count).map((i) => ({ ref: i.ref, name: i.name, status: i.status }));
}

const FALLBACK_INSIGHT = { title: "Overview", body: "Insights will appear here once generated." };

export function InsightDashboard({
  answers,
  totalScore,
  insights,
  insightsGenerating = false,
  onRefreshInsights,
  onGetCoaching,
  playbookLinkBase,
}: InsightDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("levels");
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [selectedPillar, setSelectedPillar] = useState<number | null>(null);
  const [selectedArea, setSelectedArea] = useState<number | null>(null);
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [levelColorScheme, setLevelColorScheme] = useState<LevelColorScheme>("diagram");

  const levelColors = getLevelColors(levelColorScheme);
  const levelScores = computeLevelScores(answers);
  const pillarScores = computePillarScoresWithFoundation(answers);
  const overall = getOverallLevel(totalScore);

  const resetSelection = () => {
    setSelectedLevel(null);
    setSelectedPillar(null);
    setSelectedArea(null);
  };

  const shortInsight = insights?.overallShort ?? null;
  const longInsight = insights?.overallLong ?? null;

  let currentInsight: { title: string; body: string };
  let currentAccent: string;
  let isOverview: boolean;
  let priorityPlaybooks: InsightPriorityPlaybook[] = [];

  if (activeTab === "levels") {
    isOverview = selectedLevel === null;
    if (isOverview) {
      currentInsight = insights?.levelsDefault ?? FALLBACK_INSIGHT;
      currentAccent = "#94a3b8";
    } else {
      const levelIdx = selectedLevel as number;
      currentInsight = insights?.levels?.[String(levelIdx)] ?? FALLBACK_INSIGHT;
      priorityPlaybooks = getPriorityPlaybooksForContext(answers, { levelIdx }, 3);
      currentAccent = levelColors[levelIdx].accent;
    }
  } else if (activeTab === "pillars") {
    isOverview = selectedPillar === null;
    if (isOverview) {
      currentInsight = insights?.pillarsDefault ?? FALLBACK_INSIGHT;
      currentAccent = "#94a3b8";
    } else {
      const pillarIdx = selectedPillar as 0 | 1 | 2 | 3;
      const key = PILLAR_KEYS[pillarIdx];
      currentInsight = insights?.pillars?.[key] ?? FALLBACK_INSIGHT;
      priorityPlaybooks = getPriorityPlaybooksForContext(answers, { pillarIdx }, 3);
      currentAccent = PILLAR_META[key].accent;
    }
  } else {
    isOverview = selectedArea === null;
    if (isOverview) {
      currentInsight = insights?.areasDefault ?? FALLBACK_INSIGHT;
      currentAccent = "#94a3b8";
    } else {
      const areaIdx = selectedArea as number;
      currentInsight = insights?.areas?.[String(areaIdx)] ?? FALLBACK_INSIGHT;
      priorityPlaybooks = getPriorityPlaybooksForContext(answers, { areaIdx }, 3);
      currentAccent = WHEEL_COLORS[areaIdx];
    }
  }

  const levelPercentByDisplayIndex = (displayIdx: number) => levelScores[displayIdx]?.percent ?? 0;
  const pillarPercents = [
    Math.round((pillarScores.foundation / 10) * 100),
    Math.round((pillarScores.vision / 30) * 100),
    Math.round((pillarScores.velocity / 30) * 100),
    Math.round((pillarScores.value / 30) * 100),
  ];
  const areaPercents = AREAS.map((_, areaIdx) => {
    let sum = 0;
    for (let level = 1; level <= 5; level++) {
      const ref = `${level}.${areaIdx}`;
      const v = answers[ref];
      if (v === 0 || v === 1 || v === 2) sum += v;
    }
    return Math.round((sum / 10) * 100);
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Speed dial card */}
      <section className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-7">
          <SpeedDialGauge score={totalScore} />
          <div className="min-w-0 flex-1">
            <p
              className="mb-1.5 text-xs font-bold uppercase tracking-widest"
              style={{ color: levelColors[overall.level - 1]?.accent ?? "#0c5290" }}
            >
              Level {overall.level} — {overall.name}
            </p>
            <p className="text-base leading-relaxed text-slate-600">
              {insightsGenerating
                ? "Generating your insights…"
                : shortInsight?.body ?? "Your personalised insight will appear here once generated."}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => setOverviewExpanded((e) => !e)}
            className="text-sm font-semibold text-sky-600 hover:text-sky-700"
          >
            {overviewExpanded ? "Hide full overview" : "See full overview"}
          </button>
          {onRefreshInsights && (
            <button
              type="button"
              onClick={onRefreshInsights}
              disabled={insightsGenerating}
              className="text-sm font-semibold text-slate-600 hover:text-slate-800 disabled:opacity-50"
            >
              {insightsGenerating ? "Refreshing…" : "Refresh insights"}
            </button>
          )}
          {overviewExpanded && (
            <div className="mt-3 whitespace-pre-line text-base leading-relaxed text-slate-600">
              {longInsight?.body ?? "Expand after insights have been generated."}
            </div>
          )}
        </div>
      </section>

      {/* Level color scheme picker + Tabs */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Level colors:</span>
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setLevelColorScheme("original")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                levelColorScheme === "original"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Original
            </button>
            <button
              type="button"
              onClick={() => setLevelColorScheme("diagram")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                levelColorScheme === "diagram"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Diagram
            </button>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2">
        <div className="flex rounded-xl bg-slate-100 p-1">
          {(["levels", "pillars", "areas"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                resetSelection();
              }}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === tab
                  ? "border-slate-200 bg-white text-slate-900 shadow-sm"
                  : "border-transparent bg-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <span
          title="Tap any item for specific guidance. Tap again to return to overview."
          className="flex h-6 w-6 shrink-0 cursor-help items-center justify-center rounded-full bg-slate-100 text-slate-400"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </span>
        </div>
      </div>

      {/* Two-panel card */}
      <section className="flex min-h-[420px] overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm">
        <div
          className="flex flex-col gap-3 p-5"
          style={{ flex: "1 1 55%" }}
        >
          {activeTab === "levels" &&
            levelScores.map((ls, i) => (
              <ScoreRow
                key={ls.level}
                tag={null}
                tagColor={levelColors[i].accent}
                name={LEVEL_NAMES[ls.level]}
                subtitle={LEVEL_SUBTITLES[ls.level] ?? ""}
                score={levelPercentByDisplayIndex(i)}
                gradient={levelColors[i].gradient}
                selected={selectedLevel === i}
                onClick={() => setSelectedLevel(selectedLevel === i ? null : i)}
                iconSrc={LEVEL_ICONS[i]}
              />
            ))}

          {activeTab === "pillars" &&
            PILLAR_KEYS.map((key, i) => (
              <ScoreRow
                key={key}
                tag={i === 0 ? "Foundation" : `Pillar ${i}`}
                tagColor={PILLAR_META[key].accent}
                name={PILLAR_NAMES[key]}
                subtitle={PILLAR_SUBTITLES[key]}
                score={pillarPercents[i] ?? 0}
                gradient={PILLAR_META[key].gradient}
                selected={selectedPillar === i}
                onClick={() => setSelectedPillar(selectedPillar === i ? null : i)}
              />
            ))}

          {activeTab === "areas" && (
            <>
              {PILLAR_KEYS.map((key, pillarIdx) => {
                const indices = key === "foundation" ? [0] : key === "vision" ? [1, 2, 3] : key === "velocity" ? [4, 5, 6] : [7, 8, 9];
                const isFirst = pillarIdx === 0;
                return (
                  <div key={key}>
                    <PillarDivider
                      label={PILLAR_LABELS[key]}
                      color={PILLAR_META[key].accent}
                      isFirst={isFirst}
                    />
                    {indices.map((areaIdx) => (
                      <ScoreRow
                        key={areaIdx}
                        tag={null}
                        tagColor={WHEEL_COLORS[areaIdx]}
                        name={AREAS[areaIdx].name}
                        subtitle=""
                        score={areaPercents[areaIdx] ?? 0}
                        gradient={`linear-gradient(90deg, ${WHEEL_COLORS[areaIdx]}, ${WHEEL_COLORS[areaIdx]}bb)`}
                        selected={selectedArea === areaIdx}
                        onClick={() => setSelectedArea(selectedArea === areaIdx ? null : areaIdx)}
                      />
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>

        <InsightPanel
          insight={currentInsight}
          accentColor={currentAccent}
          isOverview={isOverview}
          priorityPlaybooks={priorityPlaybooks}
          playbookLinkBase={playbookLinkBase}
          onGetCoaching={onGetCoaching}
          sectionContext={
            !isOverview
              ? {
                  tab: activeTab,
                  levelIdx: selectedLevel ?? undefined,
                  pillarIdx: selectedPillar ?? undefined,
                  areaIdx: selectedArea ?? undefined,
                  insightTitle: currentInsight.title,
                  insightBody: currentInsight.body,
                  priorityPlaybooks,
                }
              : null
          }
        />
      </section>
    </div>
  );
}
