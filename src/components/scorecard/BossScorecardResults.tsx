"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { CalendarEmbed } from "@/components/CalendarEmbed";
import { BossScorecardVennDiagram } from "@/components/scorecard/BossScorecardVennDiagram";
import { ScorecardCompassKey } from "@/components/scorecard/ScorecardCompassKey";
import { BossScoreThankYouHeading } from "@/components/scorecard/BossScoreWordmark";
import { ScorecardInsightCard } from "@/components/scorecard/ScorecardInsightCard";
import { ScorecardPreviewFloatingControls } from "@/components/scorecard/ScorecardPreviewFloatingControls";
import { BOSS_FOUNDATION_COLOR } from "@/lib/bossData";
import { PILLAR_ACCENT_COLORS } from "@/lib/bossScorecardQuestions";
import {
  getCtaCopy,
  FOCUS_SECTION_INTRO,
  getFocusSectionLead,
  getFocusSectionSubtitle,
  getNextSteps,
  getScorecardLevelDetail,
  getWarmIntro,
  LEVEL_IMAGES,
} from "@/lib/bossScorecardCopy";
import {
  BOSS_LEVEL_NUMBERS,
  bossLevelSaturated,
} from "@/lib/bossScorecardColors";
import { getPrimaryCoachSlug, PRIMARY_COACH_CALENDAR_EMBED_CODE } from "@/lib/primaryCoach";
import type { BossLevel } from "@/lib/bossScorecardScores";
import {
  computeScorecardFocusAreas,
  getCtaTier,
  type ScorecardResultPayload,
} from "@/lib/bossScorecardScores";

const BRAND_BLUE_DARK = "#0c5290";
const BRAND_BLUE_LIGHT = "#75c8ff";

const SCORECARD_PAGE_BG = [
  "radial-gradient(1000px 520px at 8% 0%, rgba(14,165,233,0.14), transparent 60%)",
  "radial-gradient(900px 460px at 90% 10%, rgba(59,130,246,0.12), transparent 58%)",
  "linear-gradient(180deg, #f8fbff 0%, #eef5ff 45%, #e8f1ff 100%)",
].join(", ");

function svgN(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
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

function HeroDial({ score }: { score: number; level: BossLevel }) {
  const size = 260;
  const stroke = 24;
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - stroke) / 2;
  const gradId = "scorecard-hero-grad";

  // 12 o'clock, clockwise
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

function PillarProgressBars({
  pillarScores,
}: {
  pillarScores: ScorecardResultPayload["pillarScores"];
}) {
  const pillars = [
    {
      key: "owner",
      label: "Owner Performance",
      avg: pillarScores.owner,
      color: BOSS_FOUNDATION_COLOR,
    },
    {
      key: "vision",
      label: "Vision",
      avg: pillarScores.vision,
      color: PILLAR_ACCENT_COLORS.vision,
    },
    {
      key: "velocity",
      label: "Velocity",
      avg: pillarScores.velocity,
      color: PILLAR_ACCENT_COLORS.velocity,
    },
    {
      key: "value",
      label: "Value",
      avg: pillarScores.value,
      color: PILLAR_ACCENT_COLORS.value,
    },
  ] as const;

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="mx-auto max-w-lg text-center">
        <h3 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
          How Your Pillars Score
        </h3>
        <p className="mt-2 text-base leading-relaxed text-slate-500">
          Roll-up scores across Owner Performance, Vision, Velocity, and
          Value, shown as a percentage.
        </p>
      </div>
      <div className="mx-auto mt-5 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {pillars.map(({ key, label, avg, color }) => {
          const pct = avg != null ? Math.round((avg / 5) * 100) : null;
          return (
            <div
              key={key}
              className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3.5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-slate-700">
                  {label}
                </span>
                <span
                  className="shrink-0 text-sm font-semibold tabular-nums"
                  style={{ color: pct != null ? color : undefined }}
                >
                  {pct != null ? `${pct}%` : "—"}
                </span>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200/80">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct ?? 0}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type CoachProfile = {
  full_name: string | null;
  coach_business_name: string | null;
  avatar_url: string | null;
};

export function BossScorecardResults({
  result,
  coachSlug,
  coachName: coachNameProp,
  isPreview = false,
  coachGlance = false,
}: {
  result: ScorecardResultPayload;
  coachSlug: string;
  coachName?: string | null;
  isPreview?: boolean;
  /** Compact read-only view for coaches (modal) — hides prospect CTAs and calendar. */
  coachGlance?: boolean;
}) {
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

  const ctaTier = getCtaTier(result.totalScore);
  const cta = useMemo(() => getCtaCopy(ctaTier, coachFirstName), [ctaTier, coachFirstName]);
  const warmIntro = useMemo(
    () => getWarmIntro(ctaTier, coachFirstName),
    [ctaTier, coachFirstName]
  );
  const levelDetail = useMemo(
    () => getScorecardLevelDetail(result.bossLevel),
    [result.bossLevel]
  );
  const nextSteps = useMemo(() => getNextSteps(ctaTier), [ctaTier]);
  const focusSectionLead = useMemo(
    () => getFocusSectionLead(ctaTier),
    [ctaTier]
  );
  const focusSectionSubtitle = useMemo(
    () => getFocusSectionSubtitle(ctaTier, coachFirstName),
    [ctaTier, coachFirstName]
  );
  const focusItems = useMemo(
    () => computeScorecardFocusAreas(result.answers, 3),
    [result.answers]
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
          <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 md:px-6 md:py-4">
            <Image
              src="/profit-coach-logo.svg"
              alt="Profit Coach"
              width={220}
              height={56}
              className="h-10 w-auto md:h-11"
              priority
            />
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
        {/* Hero */}
        <section>
          {!coachGlance ? <BossScoreThankYouHeading /> : null}

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
                <HeroDial score={result.totalScore} level={result.bossLevel} />
              </div>

              <div className="flex items-center justify-center">
                <div className="max-w-lg">
                  <div className="flex items-center gap-4 md:gap-5">
                    <HeroLevelIcon level={result.bossLevel} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
                        Level {BOSS_LEVEL_NUMBERS[result.bossLevel]}
                      </p>
                      <h2
                        className="text-4xl font-bold tracking-tight md:text-5xl"
                        style={{ color: bossLevelSaturated(result.bossLevel) }}
                      >
                        {result.bossLevel}
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

        {/* BOSS Compass */}
        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_4px_24px_-12px_rgba(15,23,42,0.10)] md:p-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              The Profit System
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              BOSS{" "}
              <span className="font-bold">Compass</span>
            </h2>
            <p className="mt-3 max-w-lg text-base text-slate-500">
              Each petal shows how you scored in that area. Overlaps show Money,
              Time, and Team outcomes.
            </p>
          </div>
          <BossScorecardVennDiagram
            answers={result.answers}
            outcomeScores={result.outcomeScores}
          />
          <ScorecardCompassKey answers={result.answers} />
          <PillarProgressBars pillarScores={result.pillarScores} />
        </section>

        {/* Insight cards */}
        <section>
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Priority areas
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              BOSS{" "}
              <span className="font-bold">Focus</span>
            </h2>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-500">
              {FOCUS_SECTION_INTRO}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {focusItems.map((item, idx) => (
              <ScorecardInsightCard key={item.id} index={idx + 1} item={item} />
            ))}
          </div>
        </section>

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
                  <span>What to focus on first from your scorecard results</span>
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
                <CalendarEmbed embedCode={displayCalendarEmbed} />
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
