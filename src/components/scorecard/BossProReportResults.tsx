"use client";

import Image from "next/image";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BossGridTransposed } from "@/components/BossGrid";
import { BossWheel } from "@/components/BossCharts";
import { CalendarEmbed } from "@/components/CalendarEmbed";
import { BossScoreDialStrip } from "@/components/coach/BossScoreDialStrip";
import { WorkshopOwnerLevelBars } from "@/components/coach/WorkshopOwnerLevelBars";
import { BossScoreProThankYouHeading } from "@/components/scorecard/BossScoreWordmark";
import { ScorecardPreviewCoachSwitcher } from "@/components/scorecard/ScorecardPreviewCoachSwitcher";
import { ScorecardPreviewFloatingControls } from "@/components/scorecard/ScorecardPreviewFloatingControls";
import {
  BOSS_PRO_FOCUS_SECTION_INTRO,
  getBossProLevelDetail,
} from "@/lib/bossProAssessmentCopy";
import {
  BOSS_LEVEL_NUMBERS,
  BOSS_SCORE_SATURATED,
  bossLevelSaturated,
  type BossScoreHue,
} from "@/lib/bossScorecardColors";
import {
  getCtaCopy,
  getFocusSectionLead,
  getFocusSectionSubtitle,
  getWarmIntro,
  LEVEL_IMAGES,
} from "@/lib/bossScorecardCopy";
import type { CalendarContactParams } from "@/lib/calendarContactParams";
import { PLAYBOOK_COUNT } from "@/lib/bossData";
import { getOverallLevel } from "@/lib/insightEngine";
import { getPrimaryCoachSlug, PRIMARY_COACH_CALENDAR_EMBED_CODE } from "@/lib/primaryCoach";
import type { BossLevel } from "@/lib/bossScorecardScores";
import { getCtaTier } from "@/lib/bossScorecardScores";
import {
  computeAreaFocusPriorities,
  computeAreaScores,
  computeBossPillarDialStats,
  type AnswersMap,
} from "@/lib/bossScores";
import { useWheelColorScheme } from "@/lib/useWheelColorScheme";
import { useWheelViewMode } from "@/lib/useWheelViewMode";

const BRAND_BLUE_DARK = "#0c5290";
const BRAND_BLUE_LIGHT = "#75c8ff";

const SCORECARD_PAGE_BG = [
  "radial-gradient(1000px 520px at 8% 0%, rgba(14,165,233,0.14), transparent 60%)",
  "radial-gradient(900px 460px at 90% 10%, rgba(59,130,246,0.12), transparent 58%)",
  "linear-gradient(180deg, #f8fbff 0%, #eef5ff 45%, #e8f1ff 100%)",
].join(", ");

const WORKSHOP_CARD_SHELL =
  "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.015)]";

const WORKSHOP_CARD_HEADER =
  "border-b border-slate-600/40 bg-slate-700 px-4 py-2.5 text-sm font-semibold tracking-wide text-white";

const LEVEL_COLORS: { solid: string }[] = [
  { solid: "#FC2975" },
  { solid: "#FF7400" },
  { solid: "#B743F0" },
  { solid: "#07BC84" },
  { solid: "#238BF7" },
];

function svgN(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function bossLevelFromNumber(level: number): BossLevel {
  const map: Record<number, BossLevel> = {
    1: "Overwhelmed",
    2: "Overworked",
    3: "Organised",
    4: "Overseer",
    5: "Owner",
  };
  return map[Math.min(5, Math.max(1, level))] ?? "Overwhelmed";
}

function levelColors(level1to5: number) {
  return LEVEL_COLORS[Math.max(0, Math.min(4, level1to5 - 1))];
}

function HeroLevelIcon({ level }: { level: BossLevel }) {
  const solid = bossLevelSaturated(level);
  const iconSrc = LEVEL_IMAGES[level];

  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl md:h-16 md:w-16 md:rounded-2xl"
      style={{ backgroundColor: solid }}
      aria-hidden
    >
      <div
        className="h-10 w-10 shrink-0 md:h-11 md:w-11"
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
  );
}

function HeroDial({ score }: { score: number }) {
  const size = 260;
  const stroke = 24;
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - stroke) / 2;
  const gradId = "boss-pro-hero-grad";

  const startAngle = -Math.PI / 2;
  const sweep = Math.min((score / 100) * 2 * Math.PI, 2 * Math.PI * 0.999);
  const endAngle = startAngle + sweep;

  const x0 = cx + radius * Math.cos(startAngle);
  const y0 = cy + radius * Math.sin(startAngle);
  const x1 = cx + radius * Math.cos(endAngle);
  const y1 = cy + radius * Math.sin(endAngle);

  const largeArc = sweep > Math.PI ? 1 : 0;
  const progressArc =
    score > 0
      ? `M ${svgN(x0)} ${svgN(y0)} A ${svgN(radius)} ${svgN(radius)} 0 ${largeArc} 1 ${svgN(x1)} ${svgN(y1)}`
      : null;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient
            id={gradId}
            gradientUnits="userSpaceOnUse"
            x1={svgN(x0)}
            y1={svgN(y0)}
            x2={svgN(x1)}
            y2={svgN(y1)}
          >
            <stop offset="0%" stopColor={BRAND_BLUE_DARK} />
            <stop offset="100%" stopColor={BRAND_BLUE_LIGHT} />
          </linearGradient>
        </defs>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#eef2f6"
          strokeWidth={stroke}
        />
        {progressArc ? (
          <path
            d={progressArc}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-6xl font-semibold tabular-nums text-[#0c5290] md:text-[4.5rem] md:leading-none">
          {score}
        </span>
        <span className="mt-0.5 text-xs font-medium text-slate-500">
          out of 100
        </span>
      </div>
    </div>
  );
}

function PlaybookBreakdownBanner({ answers }: { answers: AnswersMap }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className="group relative w-full overflow-hidden rounded-2xl border border-[#0c5290]/15 text-left text-white shadow-[0_16px_48px_-20px_rgba(12,82,144,0.65)] transition hover:brightness-[1.03] md:rounded-3xl"
      >
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#0c5290] via-[#0a5f9e] to-[#238BF7]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(circle at 20% 20%, black 0%, transparent 70%)",
          }}
          aria-hidden
        />
        <div className="relative flex items-center justify-between gap-4 p-5 md:gap-6 md:p-6">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 backdrop-blur-sm md:h-12 md:w-12">
              <LayoutGrid className="h-5 w-5 text-white md:h-6 md:w-6" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70 md:text-[11px]">
                Full breakdown
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight md:text-xl">
                View every playbook score
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/85">
                All {PLAYBOOK_COUNT} playbooks across 5 levels — expand to see exactly
                where you scored in the Profit System.
              </p>
            </div>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20 transition group-hover:bg-white/25 md:h-11 md:w-11">
            <ChevronDown
              className={`h-5 w-5 text-white transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
              strokeWidth={2.25}
            />
          </span>
        </div>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${expanded ? "mt-4 grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_4px_24px_-12px_rgba(15,23,42,0.12)] md:rounded-3xl">
            <BossGridTransposed
              answers={answers}
              glass
              glassTheme="light"
              glassAlwaysShowPlaybookNames
              hideGlassScoreBar
              gridCornerLabel="Areas"
              scoreBarLabels="neutral"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PriorityCard({
  index,
  name,
  level,
  description,
  status,
  areaScore,
  areaMax,
}: {
  index: number;
  name: string;
  level: number;
  description: string;
  status: 0 | 1;
  areaScore: number;
  areaMax: number;
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
        style={{ background: bgImage, filter: "saturate(0.9)" }}
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
            <span className="font-semibold text-white/95">Area score:</span>{" "}
            <span className="font-semibold tabular-nums text-white">
              {areaScore}/{areaMax}
            </span>
            <span className="ml-2 text-white/70">
              ({Math.round((areaScore / areaMax) * 100)}%)
            </span>
          </p>
          <p className="mt-2 text-sm text-white/80">
            <span className="font-semibold text-white/95">Weakest level:</span>{" "}
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

type CoachProfile = {
  full_name: string | null;
  coach_business_name: string | null;
  avatar_url: string | null;
};

export function BossProReportResults({
  answers,
  totalScore,
  coachSlug,
  coachName: coachNameProp,
  isPreview = false,
  coachGlance = false,
  calendarContact,
}: {
  answers: AnswersMap;
  totalScore: number;
  coachSlug: string;
  coachName?: string | null;
  isPreview?: boolean;
  coachGlance?: boolean;
  calendarContact?: CalendarContactParams | null;
}) {
  const [wheelColorScheme] = useWheelColorScheme();
  const [wheelViewMode] = useWheelViewMode();
  const [calendarEmbed, setCalendarEmbed] = useState<string | null>(null);
  const [coachProfile, setCoachProfile] = useState<CoachProfile | null>(null);
  const effectiveSlug = coachSlug || getPrimaryCoachSlug();

  useEffect(() => {
    if (coachGlance || !effectiveSlug) return;
    fetch(`/api/public/coaches/${encodeURIComponent(effectiveSlug)}/calendar`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.calendar_embed_code) setCalendarEmbed(data.calendar_embed_code);
      })
      .catch(() => {});

    fetch(`/api/coach-by-slug?slug=${encodeURIComponent(effectiveSlug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setCoachProfile({
            full_name: data.full_name ?? null,
            coach_business_name: data.coach_business_name ?? null,
            avatar_url: data.avatar_url ?? null,
          });
        }
      })
      .catch(() => {});
  }, [effectiveSlug, coachGlance]);

  const coachName =
    coachNameProp ??
    coachProfile?.full_name ??
    coachProfile?.coach_business_name ??
    "your coach";

  const coachFirstName = coachName.split(/\s+/)[0] ?? coachName;

  const overall = getOverallLevel(totalScore);
  const bossLevel = bossLevelFromNumber(overall.level);
  const levelHue = Math.min(5, Math.max(1, overall.level)) as BossScoreHue;

  const ctaTier = getCtaTier(totalScore);
  const cta = useMemo(() => getCtaCopy(ctaTier, coachFirstName), [ctaTier, coachFirstName]);
  const warmIntro = useMemo(
    () => getWarmIntro(ctaTier, coachFirstName),
    [ctaTier, coachFirstName]
  );
  const levelDetail = useMemo(
    () => getBossProLevelDetail(overall.level),
    [overall.level]
  );
  const focusSectionLead = useMemo(
    () => getFocusSectionLead(ctaTier),
    [ctaTier]
  );
  const focusSectionSubtitle = useMemo(
    () => getFocusSectionSubtitle(ctaTier, coachFirstName),
    [ctaTier, coachFirstName]
  );

  const areaScores = useMemo(() => computeAreaScores(answers), [answers]);
  const pillarStats = useMemo(() => computeBossPillarDialStats(answers), [answers]);
  const focusItems = useMemo(
    () => computeAreaFocusPriorities(answers, 3),
    [answers]
  );

  const initials = coachName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const displayCalendarEmbed =
    calendarEmbed ?? (isPreview ? PRIMARY_COACH_CALENDAR_EMBED_CODE : null);

  return (
    <div
      className={coachGlance ? "text-slate-900" : "min-h-screen text-slate-900"}
      style={{ background: SCORECARD_PAGE_BG }}
    >
      {!coachGlance ? (
        <header className="border-b border-slate-200/70 bg-white/35 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 md:px-6 md:py-4">
            <Image
              src="/profit-coach-logo.svg"
              alt="Profit Coach"
              width={220}
              height={56}
              className="h-10 w-auto md:h-11"
              priority
            />
            {isPreview ? (
              <ScorecardPreviewCoachSwitcher
                currentSlug={effectiveSlug}
                alwaysShow
              />
            ) : null}
          </div>
        </header>
      ) : null}

      <main
        className={
          coachGlance
            ? "space-y-10"
            : "mx-auto max-w-5xl space-y-16 px-4 pb-10 pt-4 md:space-y-20 md:px-6 md:pb-14 md:pt-5"
        }
      >
        <section>
          {!coachGlance ? <BossScoreProThankYouHeading /> : null}

          <div className={coachGlance ? "relative" : "relative mt-[50px] md:mt-[54px]"}>
            <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600 shadow-sm ring-4 ring-[#f8fbff]">
                Your score
              </span>
            </div>

            <div className="relative overflow-hidden rounded-[40px] border border-slate-200/70 bg-white/70 px-5 py-[42px] shadow-[0_20px_80px_-32px_rgba(15,23,42,0.18)] backdrop-blur-xl md:px-8 md:py-[50px]">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.14]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(148,163,184,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.4) 1px, transparent 1px)",
                  backgroundSize: "72px 72px",
                  maskImage:
                    "radial-gradient(circle at 50% 40%, black 30%, transparent 75%)",
                }}
                aria-hidden
              />
              <div className="relative flex flex-col gap-8 md:flex-row md:justify-center md:gap-12">
                <div className="flex items-center justify-center">
                  <HeroDial score={totalScore} />
                </div>

                <div className="flex items-center justify-center">
                  <div className="max-w-lg">
                    <div className="flex items-center gap-4 md:gap-5">
                      <HeroLevelIcon level={bossLevel} />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
                          Level {BOSS_LEVEL_NUMBERS[bossLevel]}
                        </p>
                        <h2
                          className="text-4xl font-bold tracking-tight md:text-5xl"
                          style={{ color: BOSS_SCORE_SATURATED[levelHue] }}
                        >
                          {overall.name}
                        </h2>
                      </div>
                    </div>
                    <div className="mt-5 space-y-3 text-left md:mt-6">
                      {levelDetail.map((paragraph, i) => (
                        <p
                          key={i}
                          className="text-lg leading-normal text-slate-600"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-8 flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              The Profit System
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              Your{" "}
              <span className="font-bold">Breakdown</span>
            </h2>
            <p className="mt-3 max-w-lg text-base text-slate-500">
              Level-by-level completeness and your BOSS wheel — every area scored
              from aggregated playbook points.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
            <section className={`${WORKSHOP_CARD_SHELL} flex flex-col`}>
              <div className={WORKSHOP_CARD_HEADER}>Owner level completeness</div>
              <div className="px-6 py-8 sm:px-8 sm:py-9">
                <WorkshopOwnerLevelBars answers={answers} />
              </div>
            </section>

            <section className={`${WORKSHOP_CARD_SHELL} flex min-h-0 flex-col overflow-hidden`}>
              <div className={WORKSHOP_CARD_HEADER}>BOSS wheel</div>
              <div className="flex min-h-[320px] flex-1 items-center justify-center p-4 sm:min-h-[380px] sm:p-5">
                <div className="aspect-square h-auto w-full max-w-full">
                  <BossWheel
                    size="workshop"
                    areaScores={areaScores}
                    totalScore={totalScore}
                    answers={answers}
                    colorScheme={wheelColorScheme}
                    viewMode={wheelViewMode}
                    showLegend={false}
                    scorePlacement="wheel-lower-left"
                    aria-label="BOSS area scores wheel"
                  />
                </div>
              </div>
            </section>
          </div>
        </section>

        <section className="-mt-8 md:-mt-10">
          <BossScoreDialStrip
            totalScore={totalScore}
            pillarStats={pillarStats}
            showHeroScore={false}
            compactPillarCard
            pillarDialSize="large"
          />
        </section>

        <section>
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Priority areas
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              Your Top{" "}
              <span className="font-bold">3 Priorities</span>
            </h2>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-500">
              {BOSS_PRO_FOCUS_SECTION_INTRO}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {focusItems.map((item, idx) => (
              <PriorityCard
                key={item.areaId}
                index={idx + 1}
                name={item.name}
                level={item.worstLevel}
                status={item.status}
                areaScore={item.score}
                areaMax={item.maxScore}
                description={
                  item.status === 0
                    ? `This area has the lowest aggregated score across its playbooks. Fixing Level ${item.worstLevel} here unlocks real momentum.`
                    : `Almost there — tighten the Level ${item.worstLevel} playbooks in this area to lock progress in and free up energy for the next priority.`
                }
              />
            ))}
          </div>
        </section>

        {!coachGlance ? (
          <section className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 px-4 md:px-6">
            <div className="mx-auto w-full max-w-6xl">
              <PlaybookBreakdownBanner answers={answers} />
            </div>
          </section>
        ) : null}

        <div className="flex flex-col items-center text-center">
          <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
            {focusSectionLead}
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-500 md:text-lg">
            {focusSectionSubtitle}
          </p>
          {!coachGlance ? (
            <div
              className="mt-5 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm"
              aria-hidden
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14" />
                <path d="m19 12-7 7-7-7" />
              </svg>
            </div>
          ) : null}
        </div>

        {!coachGlance ? (
          <section className="mt-6 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_60px_-24px_rgba(15,23,42,0.25)]">
            <div className="grid items-center gap-8 p-8 md:grid-cols-2 md:gap-10 md:p-10 lg:gap-14 lg:p-12">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                  Let&apos;s review your results together
                </h3>
                <p className="mt-5 text-base leading-relaxed text-slate-600 md:text-lg">
                  {warmIntro}
                </p>
                <p className="mt-5 text-sm font-semibold text-slate-800">
                  Here&apos;s what we can cover on your call:
                </p>
                <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-600 md:text-base">
                  <li className="flex gap-2.5">
                    <span className="mt-0.5 shrink-0 text-[#0c5290]" aria-hidden>
                      ✓
                    </span>
                    <span>What to focus on first from your diagnostic results</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="mt-0.5 shrink-0 text-[#0c5290]" aria-hidden>
                      ✓
                    </span>
                    <span>A deeper dive into the playbooks that matter most right now</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="mt-0.5 shrink-0 text-[#0c5290]" aria-hidden>
                      ✓
                    </span>
                    <span>A clear plan for the next 90 days</span>
                  </li>
                </ul>
                {ctaTier !== "low" ? (
                  <a
                    href="#book-session"
                    className="mt-8 inline-flex items-center justify-center rounded-xl bg-[#0c5290] px-6 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#0a4580]"
                  >
                    {cta.button}
                  </a>
                ) : null}
              </div>

              <div className="flex justify-center md:justify-end">
                {coachProfile?.avatar_url ? (
                  <img
                    src={coachProfile.avatar_url}
                    alt=""
                    className="aspect-[4/5] w-full max-w-sm rounded-2xl object-cover shadow-lg ring-1 ring-slate-200/80"
                  />
                ) : (
                  <div className="flex aspect-[4/5] w-full max-w-sm items-center justify-center rounded-2xl bg-[#0c5290] text-5xl font-semibold text-white shadow-lg">
                    {initials}
                  </div>
                )}
              </div>
            </div>

            <div
              id="book-session"
              className="border-t border-slate-100 bg-slate-50/80 px-6 py-8 md:px-10 md:py-10"
            >
              <div className="mx-auto max-w-3xl text-center">
                <h3 className="text-xl font-semibold text-slate-900 md:text-2xl">
                  Book your session
                </h3>
                <p className="mt-2 text-sm text-slate-500 md:text-base">
                  Pick a time that works for you.
                </p>
              </div>
              <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                {displayCalendarEmbed ? (
                  <CalendarEmbed
                    embedCode={displayCalendarEmbed}
                    contact={calendarContact}
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      Loading calendar…
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      If nothing appears, your coach can add their booking embed in
                      settings.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}
      </main>

      {isPreview ? (
        <ScorecardPreviewFloatingControls coachSlug={effectiveSlug} />
      ) : null}
    </div>
  );
}
