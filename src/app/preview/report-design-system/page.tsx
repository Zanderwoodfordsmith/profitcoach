"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarEmbed } from "@/components/CalendarEmbed";
import {
  BossWheel,
  BossDoughnut,
  FocusAreas,
} from "@/components/BossCharts";
import { AREAS, WHEEL_COLORS } from "@/lib/bossData";
import {
  getOverallLevel,
  LEVEL_NAMES,
  LEVEL_SUBTITLES,
  PILLAR_KEYS,
  PILLAR_NAMES,
} from "@/lib/insightEngine";
import { buildPreviewInsights } from "@/lib/previewReportInsights";
import {
  buildFakeScores,
  computeAreaScores,
  computeLevelScores,
  computePillarScoresWithFoundation,
  computeScoreBreakdown,
  getTotalScore,
} from "@/lib/bossScores";
import { useWheelColorScheme } from "@/lib/useWheelColorScheme";
import { useWheelViewMode } from "@/lib/useWheelViewMode";

const LEVEL_ICONS = [
  "/levels/overwhelm.png",
  "/levels/overworked.png",
  "/levels/organised.png",
  "/levels/overseer.png",
  "/levels/owner.png",
] as const;

const DS = {
  canvas: "#f5f8fc",
  chathams: "#0c5290",
  velocity: "#42a1ee",
  teal: "#0d9488",
  ragRed: "#e11d48",
  ragAmber: "#f59e0b",
  ragGreen: "#10b981",
  slate900: "#0f172a",
  slate600: "#475569",
  slate200: "#e2e8f0",
} as const;

type ViewTab = "pillars" | "levels" | "areas";

const FALLBACK_INSIGHT = {
  title: "Overview",
  body: "Select a row or switch tabs to see coaching for that part of your scorecard.",
};

function progressFillStyle(pct: number): CSSProperties {
  if (pct >= 70) {
    return {
      background: `linear-gradient(90deg, ${DS.velocity} 0%, ${DS.chathams} 100%)`,
    };
  }
  if (pct >= 45) return { background: DS.ragGreen };
  if (pct >= 28) return { background: DS.ragAmber };
  return { background: DS.ragRed };
}

function DsProgressRow({
  label,
  pct,
  onClick,
  selected,
  rightNote,
}: {
  label: string;
  pct: number;
  onClick?: () => void;
  selected?: boolean;
  rightNote?: string;
}) {
  const inner = (
    <>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span
          className={`text-[13px] font-semibold ${selected ? "text-[#0c5290]" : "text-slate-800"}`}
        >
          {label}
        </span>
        <span
          className="text-[13px] font-medium tabular-nums text-slate-500"
          style={{ fontFamily: "var(--font-pc-ds-mono), ui-monospace, monospace" }}
        >
          {rightNote ?? `${pct}%`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#f1f5f9]">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%`, ...progressFillStyle(pct) }}
        />
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full rounded-2xl border px-4 py-3.5 text-left transition-colors ${
          selected
            ? "border-[#42a1ee]/30 bg-[#eaf2fb]/80 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)]"
            : "border-transparent bg-transparent hover:border-[#e2e8f0] hover:bg-slate-50/80"
        }`}
      >
        {inner}
      </button>
    );
  }

  return <div className="px-1 py-2">{inner}</div>;
}

function ReportDesignSystemContent() {
  const searchParams = useSearchParams();
  const [wheelColorScheme] = useWheelColorScheme();
  const [wheelViewMode] = useWheelViewMode();
  const [calendarEmbedCode, setCalendarEmbedCode] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ViewTab>("pillars");
  const [selectedPillar, setSelectedPillar] = useState<number | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [selectedArea, setSelectedArea] = useState<number | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(false);

  const { answers, totalScore, insights } = useMemo(() => {
    const preview =
      searchParams?.get("preview") === "1" || searchParams?.get("preview") === "true";
    const scoreParam = searchParams?.get("score");
    const target = scoreParam ? parseInt(scoreParam, 10) : undefined;
    const fake = buildFakeScores(
      preview || (scoreParam && Number.isFinite(target)) ? target : 67
    );
    return {
      answers: fake,
      totalScore: getTotalScore(fake),
      insights: buildPreviewInsights(),
    };
  }, [searchParams]);

  const pillarRaw = computePillarScoresWithFoundation(answers);
  const pillarPercents = [
    Math.round((pillarRaw.foundation / 10) * 100),
    Math.round((pillarRaw.vision / 30) * 100),
    Math.round((pillarRaw.velocity / 30) * 100),
    Math.round((pillarRaw.value / 30) * 100),
  ];

  const levelScores = computeLevelScores(answers);
  const breakdown = computeScoreBreakdown(answers);
  const overall = getOverallLevel(totalScore);

  const areaPercents = AREAS.map((_, areaIdx) => {
    let sum = 0;
    for (let level = 1; level <= 5; level++) {
      const ref = `${level}.${areaIdx}`;
      const v = answers[ref];
      if (v === 0 || v === 1 || v === 2) sum += v;
    }
    return Math.round((sum / 10) * 100);
  });

  const areaScores = useMemo(() => computeAreaScores(answers), [answers]);
  const coachSlugParam = searchParams?.get("coach")?.trim() ?? "";

  // Load coach-specific calendar embed when coach slug is provided in query.
  // Example: /preview/report-design-system?coach=bca
  // This keeps the design preview tied to the selected coach's booking widget.
  useEffect(() => {
    let cancelled = false;

    async function loadCalendarEmbed() {
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

    void loadCalendarEmbed();
    return () => {
      cancelled = true;
    };
  }, [coachSlugParam]);

  const resetDetailSelection = () => {
    setSelectedPillar(null);
    setSelectedLevel(null);
    setSelectedArea(null);
  };

  const switchTab = (tab: ViewTab) => {
    setActiveTab(tab);
    resetDetailSelection();
  };

  let panelInsight = FALLBACK_INSIGHT;
  let panelEyebrow = "Coaching note";

  if (activeTab === "pillars") {
    if (selectedPillar == null) {
      panelInsight = insights.pillarsDefault;
      panelEyebrow = "Four pillars";
    } else {
      const key = PILLAR_KEYS[selectedPillar];
      panelInsight = insights.pillars[key] ?? FALLBACK_INSIGHT;
      panelEyebrow = PILLAR_NAMES[key];
    }
  } else if (activeTab === "levels") {
    if (selectedLevel == null) {
      panelInsight = insights.levelsDefault;
      panelEyebrow = "Five levels";
    } else {
      panelInsight = insights.levels[String(selectedLevel)] ?? FALLBACK_INSIGHT;
      panelEyebrow = LEVEL_NAMES[selectedLevel + 1];
    }
  } else {
    if (selectedArea == null) {
      panelInsight = insights.areasDefault;
      panelEyebrow = "Ten areas";
    } else {
      panelInsight = insights.areas[String(selectedArea)] ?? FALLBACK_INSIGHT;
      panelEyebrow = AREAS[selectedArea].name;
    }
  }

  const canvasBg = {
    backgroundColor: DS.canvas,
    backgroundImage: `radial-gradient(circle at 20% 30%, rgba(66,161,238,0.14), transparent 55%), radial-gradient(circle at 80% 60%, rgba(13,148,136,0.11), transparent 55%)`,
  } as CSSProperties;

  return (
    <div className="min-h-screen pb-16" style={canvasBg}>
      <header className="border-b border-[#e2e8f0] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-4">
            <Image
              src="/brand/profit-coach-logo-colour-no-bg.png"
              alt="Profit Coach"
              width={160}
              height={40}
              className="h-9 w-auto"
              priority
            />
            <div className="hidden h-8 w-px bg-[#e2e8f0] sm:block" aria-hidden />
            <div>
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.28em]"
                style={{ color: DS.chathams }}
              >
                BOSS diagnostic report
              </p>
              <p className="text-sm text-slate-500">Profit System · preview</p>
            </div>
          </div>
          <Link
            href="/preview/thank-you"
            className="rounded-full border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-semibold text-[#0c5290] shadow-sm transition hover:border-[#42a1ee]/30 hover:brightness-[1.02] active:scale-[0.98]"
          >
            Compare thank-you view
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 pt-10 md:px-6">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.28em]"
          style={{ color: DS.chathams }}
        >
          Preview · design system layout
        </p>

        {/* Hero — glass score reveal */}
        <section
          className="rounded-[32px] border border-white/50 bg-white/55 px-6 py-8 shadow-[0_20px_60px_-24px_rgba(12,82,144,0.35)] backdrop-blur-xl md:px-10 md:py-10"
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl space-y-4">
              <h1 className="text-3xl font-light tracking-tight text-slate-900 md:text-4xl">
                Your Business Operating System score
              </h1>
              <p className="text-lg font-light leading-relaxed text-slate-600">
                {insights.overallShort.body}
              </p>
              <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                <span className="rounded-full border border-[#e2e8f0] bg-white/80 px-3 py-1 font-medium">
                  {breakdown.green} green · {breakdown.amber} amber · {breakdown.red} red
                </span>
                <span className="rounded-full border border-[#e2e8f0] bg-white/80 px-3 py-1 font-medium">
                  50 playbooks · weighted total
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-2 rounded-3xl border border-[#e2e8f0] bg-white/90 px-10 py-8 text-center shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)]">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.28em]"
                style={{ color: DS.chathams }}
              >
                Total score
              </p>
              <p
                className="text-5xl font-bold tracking-tight tabular-nums md:text-6xl"
                style={{ color: DS.chathams }}
              >
                {totalScore}
                <span className="text-2xl font-semibold text-slate-400">/100</span>
              </p>
              <p className="text-sm font-semibold text-slate-700">
                Level {overall.level} — {overall.name}
              </p>
            </div>
          </div>
          <div className="mt-8 border-t border-white/60 pt-6">
            <button
              type="button"
              onClick={() => setOverviewOpen((o) => !o)}
              className="text-sm font-semibold text-[#0c5290] underline-offset-2 hover:underline"
            >
              {overviewOpen ? "Hide full overview" : "See full overview"}
            </button>
            {overviewOpen ? (
              <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-slate-600">
                {insights.overallLong.body}
              </p>
            ) : null}
          </div>
        </section>

        {/* Tab switcher */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {(["pillars", "levels", "areas"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => switchTab(tab)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                activeTab === tab
                  ? "bg-[#0c5290] text-white shadow-[0_12px_40px_-12px_rgba(12,82,144,0.55)]"
                  : "border border-[#e2e8f0] bg-white text-slate-600 hover:border-[#42a1ee]/30"
              }`}
            >
              {tab === "pillars"
                ? "Four pillars"
                : tab === "levels"
                  ? "Five levels"
                  : "Ten areas"}
            </button>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          {/* Left — interactive rows */}
          <section
            className="rounded-3xl border border-[#e2e8f0] bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] md:p-8"
          >
            <h2 className="text-2xl font-light tracking-tight text-slate-900">
              {activeTab === "pillars"
                ? "Where your score clusters"
                : activeTab === "levels"
                  ? "Progress by owner stage"
                  : "Strength by operating area"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Tap a row for a coaching note. Tap again to return to the overview for this tab.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {activeTab === "pillars" &&
                PILLAR_KEYS.map((key, i) => (
                  <DsProgressRow
                    key={key}
                    label={PILLAR_NAMES[key]}
                    pct={pillarPercents[i] ?? 0}
                    selected={selectedPillar === i}
                    onClick={() =>
                      setSelectedPillar(selectedPillar === i ? null : i)
                    }
                  />
                ))}

              {activeTab === "levels" &&
                levelScores.map((ls, i) => (
                  <button
                    key={ls.level}
                    type="button"
                    onClick={() =>
                      setSelectedLevel(selectedLevel === i ? null : i)
                    }
                    className={`flex w-full flex-col gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                      selectedLevel === i
                        ? "border-[#42a1ee]/30 bg-[#eaf2fb]/80 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)]"
                        : "border-transparent hover:border-[#e2e8f0] hover:bg-slate-50/80"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                        style={{ backgroundColor: DS.chathams }}
                      >
                        <div
                          className="h-8 w-8 shrink-0"
                          style={{
                            maskImage: `url(${LEVEL_ICONS[i]})`,
                            maskSize: "contain",
                            maskRepeat: "no-repeat",
                            maskPosition: "center",
                            WebkitMaskImage: `url(${LEVEL_ICONS[i]})`,
                            WebkitMaskSize: "contain",
                            WebkitMaskRepeat: "no-repeat",
                            WebkitMaskPosition: "center",
                            backgroundColor: "white",
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="text-[15px] font-semibold text-slate-900">
                            {LEVEL_NAMES[ls.level]}
                          </h3>
                          <span
                            className="text-[13px] font-medium tabular-nums text-slate-500"
                            style={{
                              fontFamily: "var(--font-pc-ds-mono), ui-monospace, monospace",
                            }}
                          >
                            {ls.percent}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {LEVEL_SUBTITLES[ls.level]}
                        </p>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#f1f5f9] pl-14">
                      <div
                        className="h-full rounded-full transition-[width] duration-500 ease-out"
                        style={{
                          width: `${ls.percent}%`,
                          ...progressFillStyle(ls.percent),
                        }}
                      />
                    </div>
                  </button>
                ))}

              {activeTab === "areas" && (
                <div className="flex flex-col gap-1">
                  {PILLAR_KEYS.map((pkey) => {
                    const indices =
                      pkey === "foundation"
                        ? [0]
                        : pkey === "vision"
                          ? [1, 2, 3]
                          : pkey === "velocity"
                            ? [4, 5, 6]
                            : [7, 8, 9];
                    return (
                      <div key={pkey} className="pt-2 first:pt-0">
                        <p
                          className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.2em]"
                          style={{ color: DS.chathams }}
                        >
                          {pkey === "foundation"
                            ? "Foundation"
                            : pkey === "vision"
                              ? "Clarify vision"
                              : pkey === "velocity"
                                ? "Control velocity"
                                : "Create value"}
                        </p>
                        {indices.map((areaIdx) => (
                          <DsProgressRow
                            key={areaIdx}
                            label={AREAS[areaIdx].name}
                            pct={areaPercents[areaIdx] ?? 0}
                            selected={selectedArea === areaIdx}
                            onClick={() =>
                              setSelectedArea(
                                selectedArea === areaIdx ? null : areaIdx
                              )
                            }
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Right — insight card */}
          <aside
            className="h-fit rounded-3xl border border-[#e2e8f0] bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] md:p-8"
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.28em]"
              style={{ color: DS.chathams }}
            >
              {panelEyebrow}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">
              {panelInsight.title}
            </h3>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              {panelInsight.body}
            </p>
            <div
              className="mt-6 rounded-2xl border border-[#e2e8f0] bg-[#f5f8fc] p-4 text-sm text-slate-600"
            >
              <span className="font-semibold text-slate-800">RAG key · </span>
              Red is not in place, amber is partial, green is working. Bars use
              the brand gradient when you are strong, then solid status colours
              as the score tightens.
            </div>
          </aside>
        </div>

        {/* Charts row */}
        <section
          className="rounded-3xl border border-[#e2e8f0] bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] md:p-8"
        >
          <h2 className="text-2xl font-light tracking-tight text-slate-900">
            Visual breakdown
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Same wheel and doughnut as your client dashboard, shown here on the
            marketing-style canvas.
          </p>
          <div className="mt-8 grid items-center gap-10 lg:grid-cols-2">
            <div className="flex justify-center">
              <BossWheel
                areaScores={areaScores}
                totalScore={totalScore}
                answers={answers}
                colorScheme={wheelColorScheme}
                viewMode={wheelViewMode}
              />
            </div>
            <div className="flex flex-col items-center gap-4">
              <BossDoughnut scores={answers} />
            </div>
          </div>
        </section>

        {/* Focus + CTA */}
        <section
          className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"
        >
          <div className="rounded-3xl border border-[#e2e8f0] bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] md:p-8">
            <h2 className="text-2xl font-light tracking-tight text-slate-900">
              Fix-first priorities
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Weighted the same way as the live dashboard.
            </p>
            <div className="mt-6">
              <FocusAreas scores={answers} variant="full" />
            </div>
          </div>
          <div className="flex flex-col justify-between gap-6 rounded-[32px] border border-white/50 bg-gradient-to-br from-[#0c5290] to-[#061a2e] p-8 text-white shadow-[0_20px_60px_-24px_rgba(12,82,144,0.35)]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
                Next step
              </p>
              <h2 className="mt-3 text-2xl font-light leading-snug tracking-tight">
                Turn this score into a 90-day profit plan
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-white/75">
                Share this report with your coach and pick three playbooks to
                install first. Small, repeated upgrades beat another big strategy
                offsite.
              </p>
            </div>
            <Link
              href="/assessment/BCA"
              className="inline-flex w-fit items-center justify-center rounded-full bg-[#10b981] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_-10px_rgba(16,185,129,0.45)] transition hover:brightness-110 active:scale-[0.98]"
            >
              Retake diagnostic →
            </Link>
          </div>
        </section>

        {/* Area heat strip — echo 10-column grid */}
        <section className="rounded-3xl border border-[#e2e8f0] bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] md:p-8">
          <h2 className="text-2xl font-light tracking-tight text-slate-900">
            Ten-area snapshot
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            One cell per area; colour follows strength (pastel RAG from the
            system).
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-10">
            {AREAS.map((a, i) => {
              const p = areaPercents[i] ?? 0;
              const bg =
                p >= 70
                  ? "bg-[#b7e1cd]"
                  : p >= 45
                    ? "bg-[#fce8b2]"
                    : "bg-[#f4c7c3]";
              return (
                <div
                  key={a.id}
                  className={`flex min-h-[88px] flex-col justify-between rounded-2xl border border-[#e2e8f0] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ${bg}`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-700">
                    {a.code}
                  </p>
                  <p className="text-xs font-medium leading-snug text-slate-800">
                    {a.name}
                  </p>
                  <p
                    className="text-lg font-bold tabular-nums text-slate-900"
                    style={{
                      fontFamily: "var(--font-pc-ds-mono), ui-monospace, monospace",
                    }}
                  >
                    {p}%
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
            {AREAS.map((a, i) => (
              <span key={a.id} className="inline-flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: WHEEL_COLORS[i] }}
                />
                {a.name}
              </span>
            ))}
          </div>
        </section>
        {calendarEmbedCode ? (
          <section className="rounded-3xl border border-[#e2e8f0] bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] md:p-8">
            <h2 className="text-2xl font-light tracking-tight text-slate-900">
              Book your strategy call
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Coach calendar loaded from the selected coach profile.
            </p>
            <div className="mt-6">
              <CalendarEmbed embedCode={calendarEmbedCode} />
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default function ReportDesignSystemPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f5f8fc] text-slate-600">
          Loading report…
        </div>
      }
    >
      <ReportDesignSystemContent />
    </Suspense>
  );
}
