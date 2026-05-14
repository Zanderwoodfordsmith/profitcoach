"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarEmbed } from "@/components/CalendarEmbed";
import { areaHeroGradient } from "@/components/playbooks/PlaybookCard";
import { BossWheel } from "@/components/BossCharts";
import { AREAS, PLAYBOOKS } from "@/lib/bossData";
import {
  getOverallLevel,
  LEVEL_NAMES,
  LEVEL_SUBTITLES,
  PILLAR_KEYS,
} from "@/lib/insightEngine";
import {
  buildFakeScores,
  computeAreaScores,
  computeFocusAreas,
  computePillarScoresWithFoundation,
  computeScoreBreakdown,
  getTotalScore,
  type AnswersMap,
} from "@/lib/bossScores";
import { useWheelColorScheme } from "@/lib/useWheelColorScheme";
import { useWheelViewMode } from "@/lib/useWheelViewMode";

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const LEVEL_COLORS: { key: string; solid: string; soft: string; gradient: string }[] = [
  { key: "overwhelm", solid: "#FC2975", soft: "#fce4ec", gradient: "linear-gradient(135deg,#FC2975,#FF7400)" },
  { key: "overworked", solid: "#FF7400", soft: "#fde7d3", gradient: "linear-gradient(135deg,#FF7400,#B743F0)" },
  { key: "organised", solid: "#B743F0", soft: "#f0e3fb", gradient: "linear-gradient(135deg,#B743F0,#07BC84)" },
  { key: "overseer", solid: "#07BC84", soft: "#d6f5e8", gradient: "linear-gradient(135deg,#07BC84,#238BF7)" },
  { key: "owner", solid: "#238BF7", soft: "#dbeafe", gradient: "linear-gradient(135deg,#238BF7,#0c5290)" },
];

const PILLAR_COLORS: Record<(typeof PILLAR_KEYS)[number], string> = {
  foundation: "#A855F7",
  vision: "#0c5290",
  velocity: "#42a1ee",
  value: "#1ca0c2",
};

const PILLAR_LABEL: Record<(typeof PILLAR_KEYS)[number], string> = {
  foundation: "Foundation",
  vision: "Clarify Vision",
  velocity: "Control Velocity",
  value: "Create Value",
};

const PILLAR_AREA_INDICES: Record<(typeof PILLAR_KEYS)[number], number[]> = {
  foundation: [0],
  vision: [1, 2, 3],
  velocity: [4, 5, 6],
  value: [7, 8, 9],
};

/** Worst playbook status per area row on the BOSS grid for one level (0 red, 1 amber, 2 green). */
function levelAreaRagStrip(
  answers: AnswersMap,
  level: number
): ("red" | "amber" | "green" | "neutral")[] {
  return AREAS.map((_, areaIdx) => {
    let answered = false;
    let worst = 2 as 0 | 1 | 2;
    for (const p of PLAYBOOKS) {
      if (p.level !== level || p.area !== areaIdx) continue;
      const v = answers[p.ref];
      if (v === 0 || v === 1 || v === 2) {
        answered = true;
        worst = Math.min(worst, v) as 0 | 1 | 2;
      }
    }
    if (!answered) return "neutral";
    if (worst === 0) return "red";
    if (worst === 1) return "amber";
    return "green";
  });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function levelColors(level1to5: number) {
  return LEVEL_COLORS[Math.max(0, Math.min(4, level1to5 - 1))];
}

function pillarPercent(sum: number, max: number) {
  return Math.round((sum / max) * 100);
}

function pillarMaxScore(key: (typeof PILLAR_KEYS)[number]) {
  return key === "foundation" ? 10 : 30;
}

function pillarLevel(percent: number) {
  if (percent < 20) return 1;
  if (percent < 40) return 2;
  if (percent < 60) return 3;
  if (percent < 80) return 4;
  return 5;
}

/* ------------------------------------------------------------------ */
/* Big circular speed-dial (hero)                                      */
/* ------------------------------------------------------------------ */

function HeroDial({ score, level }: { score: number; level: number }) {
  const size = 420;
  const stroke = 36;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;
  const gradId = "report-v3-hero-grad";
  const { gradient: _gradient } = levelColors(level);
  void _gradient;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF7400" />
            <stop offset="50%" stopColor="#FC2975" />
            <stop offset="100%" stopColor="#B743F0" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#eef2f6"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-baseline gap-3">
          <span
            className="text-7xl font-bold tabular-nums md:text-8xl"
            style={{
              background:
                "linear-gradient(135deg,#FC2975,#FF7400)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              fontFamily: "var(--font-pc-ds-mono), ui-monospace, monospace",
            }}
          >
            {score}
          </span>
          <div className="flex flex-col leading-tight text-slate-500">
            <span className="text-sm font-medium">out of</span>
            <span className="text-2xl font-bold text-slate-800 tabular-nums">100</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Level card (carousel item)                                          */
/* ------------------------------------------------------------------ */

function LevelCard({
  level,
  active,
  highlight,
  description,
  answers,
}: {
  level: number;
  active: boolean;
  highlight: boolean;
  description: string;
  answers: AnswersMap;
}) {
  const colors = levelColors(level);
  const areaStrip = useMemo(() => levelAreaRagStrip(answers, level), [answers, level]);

  const dashColor = (s: (typeof areaStrip)[number]) => {
    if (s === "red") return "#ef4444";
    if (s === "amber") return "#fbbf24";
    if (s === "green") return "#6ee7b7";
    return "#e2e8f0";
  };

  return (
    <div
      className={`flex w-[640px] shrink-0 flex-col gap-5 rounded-2xl border bg-white px-10 py-9 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.15)] transition-all ${
        highlight
          ? "border-slate-200 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.25)]"
          : "border-slate-100 opacity-60"
      } ${active ? "" : ""}`}
    >
      <div className="flex items-center gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-base font-bold text-white"
          style={{ background: colors.solid }}
        >
          {level}
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            You&rsquo;re at
          </span>
          <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
            Level {level}: {LEVEL_NAMES[level]}
          </h3>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-slate-600">{description}</p>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          This level &middot; 10 areas
        </p>
        <div className="flex gap-1" role="img" aria-label={`RAG strip for level ${level}`}>
          {areaStrip.map((s, i) => (
            <div
              key={i}
              title={AREAS[i]?.name}
              className="h-2 min-w-0 flex-1 rounded-sm"
              style={{ backgroundColor: dashColor(s) }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pillar speed-dial tab                                               */
/* ------------------------------------------------------------------ */

function PillarTab({
  label,
  percent,
  level,
  active,
  color,
  onClick,
}: {
  label: string;
  percent: number;
  level: number;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  const radius = 42;
  const circ = 2 * Math.PI * radius;
  const dash = (percent / 100) * circ;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-3 rounded-3xl border bg-white px-8 pt-7 pb-6 text-center transition-all ${
        active
          ? "border-slate-300 shadow-[0_18px_48px_-16px_rgba(15,23,42,0.28)]"
          : "border-slate-100 hover:border-slate-200 hover:shadow-md"
      }`}
      style={{
        boxShadow: active ? `0 14px 42px -16px ${color}66` : undefined,
        borderColor: active ? `${color}66` : undefined,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        aria-hidden
        className="block h-44 w-44 md:h-52 md:w-52"
      >
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={6}
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform="rotate(-90 50 50)"
        />
        <text
          x="50"
          y="55"
          textAnchor="middle"
          fill="#0f172a"
          fontSize="22"
          fontWeight="700"
        >
          {percent}
          <tspan fontSize="12" fill="#94a3b8">
            %
          </tspan>
        </text>
      </svg>
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color }}
      >
        Level {level}
      </span>
      <span className="text-base font-semibold text-slate-800">{label}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Pillar progress row (used inside breakdown card)                    */
/* ------------------------------------------------------------------ */

function PillarBreakdownRow({
  label,
  score,
  max = 10,
  color,
}: {
  label: string;
  score: number;
  max?: number;
  color: string;
}) {
  const pct = Math.min(100, Math.max(0, Math.round((score / max) * 100)));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: color }}
          />
          {label}
        </span>
        <span
          className="text-xs font-medium text-slate-500 tabular-nums"
          style={{
            fontFamily: "var(--font-pc-ds-mono), ui-monospace, monospace",
          }}
        >
          {score}/{max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#f1f5f9]">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Top priority card                                                   */
/* ------------------------------------------------------------------ */

function PriorityCard({
  index,
  name,
  level,
  description,
  status,
}: {
  index: number;
  name: string;
  level: number;
  description: string;
  status: 0 | 1;
}) {
  const isCritical = status === 0;
  const badgeLabel = isCritical ? "Critical" : "Needs work";
  const accent = isCritical ? "#f87171" : "#fcd34d";
  const levelSolid = levelColors(level).solid;
  const bgImage = isCritical
    ? "linear-gradient(135deg, #7f1d1d 0%, #b91c1c 38%, #dc2626 100%)"
    : "linear-gradient(135deg, #78350f 0%, #b45309 42%, #d97706 100%)";

  return (
    <div className="relative overflow-hidden rounded-3xl text-white shadow-[0_20px_60px_-24px_rgba(15,23,42,0.45)]">
      <div
        className="absolute inset-0"
        style={{
          background: bgImage,
          filter: "saturate(0.9)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg,rgba(15,23,42,0.05) 0%,rgba(15,23,42,0.45) 35%,rgba(15,23,42,0.85) 100%)",
        }}
      />
      <span
        className="absolute right-6 top-6 text-[88px] font-black leading-none tracking-tight"
        style={{ color: "rgba(255,255,255,0.18)", fontVariantNumeric: "tabular-nums" }}
      >
        0{index}.
      </span>
      <div className="relative flex h-full min-h-[320px] flex-col justify-between gap-6 p-6">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ background: accent, color: isCritical ? "white" : "#1c1917" }}
          >
            <span
              className={`h-2 w-2 rounded-full ${isCritical ? "bg-white" : "bg-amber-950/80"}`}
            />
            {badgeLabel}
          </span>
        </div>
        <div>
          <h3 className="text-2xl font-semibold leading-tight">{name}</h3>
          <p className="mt-2 text-sm text-white/80">
            <span className="font-semibold text-white/95">Current Level:</span>{" "}
            <span
              className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold text-white"
              style={{ background: levelSolid }}
            >
              {level}
            </span>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/90">{description}</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

type PillarTabKey = (typeof PILLAR_KEYS)[number];

export type ReportV3Variant = "preview" | "live";

export function ReportV3({
  answers,
  totalScore,
  coachSlug = "",
  variant = "live",
}: {
  answers: AnswersMap;
  totalScore: number;
  coachSlug?: string;
  variant?: ReportV3Variant;
}) {
  const [wheelColorScheme] = useWheelColorScheme();
  const [wheelViewMode] = useWheelViewMode();
  const [calendarEmbedCode, setCalendarEmbedCode] = useState<string | null>(null);
  const [activePillar, setActivePillar] = useState<PillarTabKey>("foundation");

  const overall = getOverallLevel(totalScore);
  const nextLevel = Math.min(5, overall.level + 1);
  const prevLevel = Math.max(1, overall.level - 1);

  const pillarRaw = computePillarScoresWithFoundation(answers);
  const pillarPercents: Record<PillarTabKey, number> = {
    foundation: pillarPercent(pillarRaw.foundation, 10),
    vision: pillarPercent(pillarRaw.vision, 30),
    velocity: pillarPercent(pillarRaw.velocity, 30),
    value: pillarPercent(pillarRaw.value, 30),
  };

  const breakdown = computeScoreBreakdown(answers);
  const focusItems = useMemo(() => computeFocusAreas(answers).slice(0, 3), [answers]);

  const areaScores = useMemo(() => computeAreaScores(answers), [answers]);

  const coachSlugParam = coachSlug.trim();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!coachSlugParam) {
        setCalendarEmbedCode(null);
        return;
      }
      const res = await fetch(
        `/api/public/coaches/${encodeURIComponent(coachSlugParam)}/calendar`
      );
      if (cancelled || !res.ok) {
        setCalendarEmbedCode(null);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        calendar_embed_code?: string | null;
      };
      setCalendarEmbedCode(data?.calendar_embed_code ?? null);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [coachSlugParam]);

  /* Stats */
  const criticalCount = breakdown.red;
  const needsWorkCount = breakdown.amber;
  const strongCount = breakdown.green;

  return (
    <div className="relative min-h-screen overflow-x-hidden pb-20">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(180deg, #eef2f7 0%, #e6ecf3 35%, #dee5ee 70%, #d8e0ea 100%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 10% 0%, rgba(186,213,236,0.55), transparent 55%), radial-gradient(circle at 90% 30%, rgba(203,213,225,0.55), transparent 55%)",
        }}
        aria-hidden
      />
      <header className="border-b border-slate-200/70 bg-white/35 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-4">
            <Image
              src="/profit-coach-logo.svg"
              alt="Profit Coach"
              width={200}
              height={56}
              className="h-9 w-auto"
              priority
            />
            <div className="hidden h-8 w-px bg-[#e2e8f0] sm:block" aria-hidden />
            <div>
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.28em]"
                style={{ color: levelColors(overall.level).solid }}
              >
                BOSS diagnostic report
              </p>
              <p className="text-sm text-slate-500">
                {variant === "preview" ? "Profit System · v3 preview" : "Profit System"}
              </p>
            </div>
          </div>
          {variant === "preview" ? (
            <div className="flex items-center gap-2">
              <Link
                href="/preview/report-design-system"
                className="rounded-full border border-[#e2e8f0] bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-[#42a1ee]/30"
              >
                See v2
              </Link>
              <Link
                href="/preview/thank-you"
                className="rounded-full border border-[#e2e8f0] bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-[#42a1ee]/30"
              >
                Thank-you view
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-20 px-4 pt-12 md:space-y-28 md:px-6 md:pt-16">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[40px] border border-slate-200/70 bg-white/70 px-6 py-10 shadow-[0_20px_80px_-32px_rgba(15,23,42,0.18)] backdrop-blur-xl md:px-12 md:py-14">
          {/* faint grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(148,163,184,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.4) 1px, transparent 1px)",
              backgroundSize: "72px 72px",
              maskImage:
                "radial-gradient(circle at 50% 40%, black 30%, transparent 75%)",
            }}
            aria-hidden
          />
          <div className="relative flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Assessment Complete
            </span>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
              Your Business{" "}
              <span className="font-bold text-slate-900">Report</span>
            </h1>
            <p className="mt-3 max-w-md text-base text-slate-500">
              Here&rsquo;s what we discovered about your business — and the exact
              path forward.
            </p>

            <div className="mt-10">
              <HeroDial score={totalScore} level={overall.level} />
            </div>
          </div>

          {/* Level cards carousel */}
          <div className="relative mt-10">
            <div className="overflow-x-auto pb-2">
              <div className="flex snap-x snap-mandatory gap-5 px-4 md:justify-center">
                {[prevLevel, overall.level, nextLevel].map((lvl, idx) => (
                  <div key={lvl} className="snap-center">
                    <LevelCard
                      level={lvl}
                      active={lvl === overall.level}
                      highlight={idx === 1}
                      answers={answers}
                      description={
                        lvl === overall.level
                          ? `You've built something real, but you're carrying the entire business on your shoulders. Every decision, every problem, every important sale still flows through you. You work 50-60+ hours a week and the business can't run a fortnight without you.`
                          : lvl < overall.level
                            ? `${LEVEL_SUBTITLES[lvl]} You moved past this stage — now lock in the systems so you don't slip back.`
                            : `${LEVEL_SUBTITLES[lvl]} This is the next horizon. Three focused upgrades unlock it.`
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* PILLAR DIAL TABS */}
        <section>
          <div className="mb-8 flex flex-col items-center text-center md:mb-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              Four pillars
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              Your Pillar{" "}
              <span className="font-bold">Scores</span>
            </h2>
            <p className="mt-3 max-w-md text-base text-slate-500">
              How each of the four pillars of your business is scoring right now.
            </p>
          </div>
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-5">
            {PILLAR_KEYS.map((key) => {
              const pct = pillarPercents[key];
              const lvl = pillarLevel(pct);
              return (
                <PillarTab
                  key={key}
                  label={PILLAR_LABEL[key]}
                  percent={pct}
                  level={lvl}
                  active={activePillar === key}
                  color={PILLAR_COLORS[key]}
                  onClick={() => setActivePillar(key)}
                />
              );
            })}
          </div>
        </section>

        {/* TOP 3 PRIORITIES */}
        <section>
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Fix first
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              Your Top{" "}
              <span className="font-bold">3 Priorities</span>
            </h2>
            <p className="mt-3 max-w-md text-base text-slate-500">
              These are the moves that unlock your next level — in order.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {focusItems.map((item, idx) => (
              <PriorityCard
                key={item.ref}
                index={idx + 1}
                name={item.name}
                level={item.level}
                status={item.status}
                description={
                  item.status === 0
                    ? `This is the highest-leverage move at Level ${item.level}. Install the playbook and you\u2019ll feel the gain within a fortnight.`
                    : `Almost there — finish the playbook to lock this in and free up energy for the next priority.`
                }
              />
            ))}
          </div>
        </section>

        {/* DETAILED BREAKDOWN */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_4px_24px_-12px_rgba(15,23,42,0.10)] md:p-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-600 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              Breakdown
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              Detailed Score{" "}
              <span className="font-bold">Breakdown</span>
            </h2>
            <p className="mt-3 max-w-md text-base text-slate-500">
              The Business Health Wheel, plus pillar-level detail. Use the pillar
              tabs above to spotlight one area.
            </p>
          </div>

          <div className="flex justify-center">
            <div className="w-full max-w-[720px]">
              <BossWheel
                areaScores={areaScores}
                totalScore={totalScore}
                answers={answers}
                colorScheme={wheelColorScheme}
                viewMode={wheelViewMode}
                showLegend={false}
                scorePlacement="wheel-lower-left"
              />
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {PILLAR_KEYS.map((key) => {
              const dim = activePillar !== key;
              const max = pillarMaxScore(key);
              const sum =
                key === "foundation"
                  ? pillarRaw.foundation
                  : key === "vision"
                    ? pillarRaw.vision
                    : key === "velocity"
                      ? pillarRaw.velocity
                      : pillarRaw.value;
              return (
                <div
                  key={key}
                  className={`rounded-2xl border bg-white p-5 transition-opacity md:p-6 ${
                    dim
                      ? "border-slate-100 opacity-60"
                      : "border-slate-200 shadow-[0_8px_30px_-16px_rgba(15,23,42,0.18)]"
                  }`}
                >
                  <div className="mb-4 flex items-baseline justify-between gap-3">
                    <h3
                      className="text-xl font-semibold tracking-tight"
                      style={{ color: PILLAR_COLORS[key] }}
                    >
                      {PILLAR_LABEL[key]}
                    </h3>
                    <span
                      className="text-xs font-medium tabular-nums text-slate-500"
                      style={{
                        fontFamily:
                          "var(--font-pc-ds-mono), ui-monospace, monospace",
                      }}
                    >
                      {sum}/{max}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3.5">
                    {PILLAR_AREA_INDICES[key].map((areaIdx) => {
                      const aSum = areaScores[areaIdx] ?? 0;
                      return (
                        <PillarBreakdownRow
                          key={areaIdx}
                          label={AREAS[areaIdx].name}
                          score={aSum}
                          max={10}
                          color={PILLAR_COLORS[key]}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

        </section>

        {/* STATS TRIO */}
        <section className="grid grid-cols-3 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_4px_24px_-12px_rgba(15,23,42,0.10)]">
          {[
            { value: criticalCount, label: "Critical Areas", color: "#FC2975" },
            { value: needsWorkCount, label: "Needs Work Areas", color: "#FF7400" },
            { value: strongCount, label: "Strong Areas", color: "#07BC84" },
          ].map((stat, idx) => (
            <div
              key={stat.label}
              className={`flex flex-col items-center justify-center gap-2 px-6 py-8 ${
                idx > 0 ? "border-l border-slate-200" : ""
              }`}
            >
              <span
                className="text-5xl font-bold tabular-nums md:text-6xl"
                style={{
                  color: stat.color,
                  fontFamily:
                    "var(--font-pc-ds-mono), ui-monospace, monospace",
                }}
              >
                {stat.value}
              </span>
              <span className="text-sm font-semibold text-slate-600 md:text-base">
                {stat.label}
              </span>
            </div>
          ))}
        </section>

        {/* CTA + CALENDAR */}
        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_60px_-24px_rgba(15,23,42,0.25)]">
          <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            {/* Left: discovery call CTA */}
            <div className="relative overflow-hidden bg-[#0c5290] p-8 text-white md:p-12">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.12]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
                  backgroundSize: "72px 72px",
                  maskImage:
                    "radial-gradient(circle at 30% 30%, black 0%, transparent 70%)",
                }}
              />
              <h2 className="relative text-3xl font-bold leading-tight tracking-tight md:text-4xl">
                Book Your Discovery Call
              </h2>
              <p className="relative mt-3 max-w-lg text-base leading-relaxed text-white/85">
                In 60 minutes, we&rsquo;ll build your personalised action plan for
                these {focusItems.length} areas. You&rsquo;ll leave with exactly
                what to fix, in what order, and how.
              </p>

              {coachSlugParam && calendarEmbedCode ? (
                <div className="relative mt-6 rounded-2xl bg-white p-3 shadow-inner">
                  <CalendarEmbed embedCode={calendarEmbedCode} />
                </div>
              ) : (
                <div className="relative mt-6 rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
                    Calendar embed slot
                  </p>
                  <p className="mt-1 text-sm text-white/80">
                    Pass{" "}
                    <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">
                      ?coach=BCA
                    </code>{" "}
                    on the URL to load the coach&rsquo;s embedded calendar here.
                  </p>
                </div>
              )}

              <div className="relative mt-6 flex flex-wrap gap-3">
                <Link
                  href="#"
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_-10px_rgba(16,185,129,0.55)] transition hover:brightness-110"
                >
                  Book Your Call
                  <span aria-hidden>→</span>
                </Link>
                <span className="inline-flex items-center gap-2 text-xs text-white/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  60-min session
                </span>
                <span className="inline-flex items-center gap-2 text-xs text-white/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Immediate actions
                </span>
                <span className="inline-flex items-center gap-2 text-xs text-white/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Personalised plan
                </span>
              </div>
            </div>

            {/* Right: coach card */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#0c5290] to-[#061a2e] p-8 text-white md:p-10">
              <div
                className="pointer-events-none absolute -right-24 -bottom-24 h-[420px] w-[420px] rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at center, rgba(255,255,255,0.18) 0%, transparent 60%)",
                }}
              />
              <div className="relative flex flex-col gap-6">
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0 rounded-full bg-white/10">
                    <div className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-white/80">
                      {coachSlugParam ? coachSlugParam[0]?.toUpperCase() : "S"}
                    </div>
                    <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-[#0c5290] bg-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                      Your coach
                    </p>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight">
                      {coachSlugParam
                        ? coachSlugParam.toUpperCase()
                        : "Sarah Mitchell"}
                    </h3>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-white/80">
                  Business scaling specialist with 15+ years helping owners get
                  their time and freedom back without sacrificing profit.
                </p>
                <Link
                  href="#"
                  className="inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  See coach profile
                </Link>
              </div>
            </div>
          </div>
        </section>

        <p className="pt-2 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Profit Coach. All rights reserved.
        </p>
      </main>
    </div>
  );
}

function ReportV3PreviewWrapper() {
  const searchParams = useSearchParams();
  const { answers, totalScore } = useMemo(() => {
    const preview =
      searchParams?.get("preview") === "1" ||
      searchParams?.get("preview") === "true";
    const scoreParam = searchParams?.get("score");
    const target = scoreParam ? parseInt(scoreParam, 10) : undefined;
    const fake = buildFakeScores(
      preview || (scoreParam && Number.isFinite(target)) ? target : 47
    );
    return {
      answers: fake as AnswersMap,
      totalScore: getTotalScore(fake),
    };
  }, [searchParams]);

  const coachSlug = searchParams?.get("coach")?.trim() ?? "";

  return (
    <ReportV3
      answers={answers}
      totalScore={totalScore}
      coachSlug={coachSlug}
      variant="preview"
    />
  );
}

export default function ReportV3Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
          Loading report…
        </div>
      }
    >
      <ReportV3PreviewWrapper />
    </Suspense>
  );
}
