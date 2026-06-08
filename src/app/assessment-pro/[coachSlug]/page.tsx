"use client";

import { Outfit } from "next/font/google";
import Image from "next/image";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BossProAssessmentIntro } from "@/components/scorecard/BossProAssessmentIntro";
import { AssessmentPersonalisedGreeting } from "@/components/scorecard/AssessmentPersonalisedGreeting";
import { BossScoreProWordmark } from "@/components/scorecard/BossScoreWordmark";
import {
  assessmentContactToSessionPayload,
  LANDING_CONTACT_SESSION_KEY,
  mergeAssessmentContactWithSession,
  parseAssessmentContactParams,
  readLandingContactSession,
  resolveAssessmentProspectFirstName,
} from "@/lib/assessmentContactParams";
import { BOSS_PRO_INTRO } from "@/lib/bossProAssessmentCopy";
import {
  BOSS_PRO_SCORE_LABELS,
  bossProScoreAriaLabel,
} from "@/lib/bossProScoringLabels";
import { SCORECARD_PAGE_BG } from "@/lib/bossScorecardQuestions";
import { supabaseClient } from "@/lib/supabaseClient";
import { METHODOLOGY_VERSION } from "@/lib/bossMethodologyMigration";
import { QUESTIONS_BY_LEVEL } from "@/lib/assessmentQuestions";
import { splitFullName } from "@/lib/splitFullName";

const outfit = Outfit({ subsets: ["latin"] });

type AnswersMap = Record<string, 0 | 1 | 2>;

function computeTotalScore(answers: AnswersMap): number {
  return Object.values(answers).reduce<number>(
    (sum, v) => sum + (v === 0 || v === 1 || v === 2 ? v : 0),
    0
  );
}

function buildUniformAnswers(value: 0 | 1 | 2): AnswersMap {
  const next: AnswersMap = {};
  for (const level of Object.keys(QUESTIONS_BY_LEVEL)) {
    const questions = QUESTIONS_BY_LEVEL[Number(level)] ?? [];
    for (const question of questions) {
      next[question.ref] = value;
    }
  }
  return next;
}

export default function BossProAssessmentPage({
  params,
}: {
  params: Promise<{ coachSlug: string }>;
}) {
  const { coachSlug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromLanding = searchParams.get("from_landing");
  const landingVariant =
    fromLanding === "a" ||
    fromLanding === "b" ||
    fromLanding === "c" ||
    fromLanding === "d"
      ? fromLanding
      : null;
  const fromDashboard = searchParams.get("from") === "dashboard";
  const startTracked = useRef(false);
  const directLeadCaptured = useRef(false);
  const urlContact = useMemo(
    () => parseAssessmentContactParams(searchParams),
    [searchParams]
  );

  const landingSession = landingVariant ? readLandingContactSession() : null;
  const initialContact = mergeAssessmentContactWithSession(
    urlContact,
    landingSession
  );

  const [coachName, setCoachName] = useState<string | null>(null);
  const [coachBusiness, setCoachBusiness] = useState<string | null>(null);
  const [coachAvatarUrl, setCoachAvatarUrl] = useState<string | null>(null);
  const [coachLinkedinUrl, setCoachLinkedinUrl] = useState<string | null>(null);
  const [loadingCoach, setLoadingCoach] = useState(true);

  const [step, setStep] = useState<"intro" | "assessment">("intro");
  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionPhase, setQuestionPhase] = useState<"idle" | "exiting" | "entering">("idle");
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(initialContact.fullName ?? "");
  const [email, setEmail] = useState(initialContact.email ?? "");
  const [phone, setPhone] = useState(initialContact.phone ?? "");
  const [businessName, setBusinessName] = useState(
    initialContact.businessName ?? ""
  );

  const prospectFirstName = useMemo(
    () =>
      resolveAssessmentProspectFirstName(urlContact, {
        sessionContact: landingSession,
        fullName,
      }),
    [urlContact, landingSession, fullName]
  );

  const [clientDashboardChecked, setClientDashboardChecked] = useState(false);
  const [isClientFromDashboard, setIsClientFromDashboard] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadCoach() {
      setLoadingCoach(true);
      const { data, error } = await supabaseClient
        .from("coaches")
        .select("slug, profiles(full_name, coach_business_name, avatar_url, linkedin_url)")
        .eq("slug", coachSlug)
        .maybeSingle();

      if (cancelled) return;
      if (!error && data) {
        const prof = (data as { profiles?: { full_name?: string; coach_business_name?: string; avatar_url?: string; linkedin_url?: string } | null }).profiles;
        if (prof) {
          setCoachName(prof.full_name ?? null);
          setCoachBusiness(prof.coach_business_name ?? null);
          setCoachAvatarUrl(prof.avatar_url ?? null);
          setCoachLinkedinUrl(prof.linkedin_url ?? null);
        }
        if (!prof?.full_name && !prof?.coach_business_name && (data as { slug?: string }).slug?.toUpperCase() === "BCA") {
          setCoachBusiness("Central (BCA)");
        }
      }
      setLoadingCoach(false);
    }
    loadCoach();
    return () => {
      cancelled = true;
    };
  }, [coachSlug]);

  const landingUrl = useMemo(
    () => `/landing/a?coach=${encodeURIComponent(coachSlug)}`,
    [coachSlug]
  );

  useEffect(() => {
    if (landingVariant || directLeadCaptured.current) return;
    if (!urlContact.email) return;

    directLeadCaptured.current = true;
    try {
      sessionStorage.setItem(
        LANDING_CONTACT_SESSION_KEY,
        JSON.stringify(assessmentContactToSessionPayload(urlContact))
      );
    } catch {
      // ignore
    }

    fetch("/api/leads/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coachSlug: coachSlug?.trim() || null,
        assessment_type: "diagnostic_50",
        contact: {
          first_name: urlContact.firstName ?? undefined,
          last_name: urlContact.lastName ?? undefined,
          full_name: urlContact.fullName ?? undefined,
          email: urlContact.email,
          phone: urlContact.phone ?? undefined,
          business_name: urlContact.businessName ?? undefined,
        },
      }),
    }).catch(() => {});
  }, [coachSlug, landingVariant, urlContact]);

  function handleStartAssessment() {
    const emailVal = email.trim();
    if (emailVal) {
      fetch("/api/leads/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coachSlug: coachSlug?.trim() || null,
          assessment_type: "diagnostic_50",
          contact: {
            full_name: fullName.trim() || undefined,
            email: emailVal,
            phone: phone.trim() || undefined,
            business_name: businessName.trim() || undefined,
          },
        }),
      }).catch(() => {});
    }
    if (landingVariant && emailVal) {
      fetch("/api/landing/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variant: landingVariant,
          coach_slug: coachSlug?.trim() || null,
          event_type: "opt_in",
        }),
      }).catch(() => {});
    }
    setStep("assessment");
  }

  useEffect(() => {
    if (landingVariant) return;
    if (!fromDashboard) {
      setClientDashboardChecked(true);
      return;
    }
    if (clientDashboardChecked) return;

    try {
      const raw = sessionStorage.getItem("boss_client_dashboard");
      if (raw) {
        const data = JSON.parse(raw) as {
          contact?: { full_name?: string | null; email?: string | null; business_name?: string | null };
          coach_slug?: string;
        };
        if (data.contact) {
          setFullName(data.contact.full_name ?? "");
          setEmail(data.contact.email ?? "");
          setBusinessName(data.contact.business_name ?? "");
          setStep("assessment");
          setIsClientFromDashboard(true);
          setClientDashboardChecked(true);
          return;
        }
      }
    } catch {
      // ignore invalid or missing sessionStorage
    }

    let cancelled = false;
    async function checkClientDashboard() {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (cancelled) return;
        if (session?.access_token) {
          const res = await fetch("/api/client/me", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (cancelled) return;
          if (res.ok) {
            const body = (await res.json()) as {
              contact?: { full_name?: string | null; email?: string | null; business_name?: string | null };
            };
            if (body.contact) {
              setFullName(body.contact.full_name ?? "");
              setEmail(body.contact.email ?? "");
              setBusinessName(body.contact.business_name ?? "");
              setStep("assessment");
              setIsClientFromDashboard(true);
              setClientDashboardChecked(true);
              return;
            }
          }
          setClientDashboardChecked(true);
          window.location.href = landingUrl;
          return;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      if (cancelled) return;
      setClientDashboardChecked(true);
      window.location.href = landingUrl;
    }
    checkClientDashboard();
    return () => {
      cancelled = true;
    };
  }, [landingVariant, fromDashboard, coachSlug, landingUrl, clientDashboardChecked]);

  useEffect(() => {
    if (!landingVariant || startTracked.current) return;
    startTracked.current = true;
    fetch("/api/landing/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variant: landingVariant,
        coach_slug: coachSlug?.trim() || null,
        event_type: "start",
      }),
    }).catch(() => {});
  }, [landingVariant, coachSlug]);

  useEffect(() => {
    if (!landingVariant) return;
    const session = readLandingContactSession();
    if (!session) return;
    const merged = mergeAssessmentContactWithSession(urlContact, session);
    if (merged.fullName) setFullName(merged.fullName);
    if (merged.email) setEmail(merged.email);
    if (merged.phone) setPhone(merged.phone);
    if (merged.businessName) setBusinessName(merged.businessName);
    setStep("assessment");
  }, [landingVariant, urlContact]);

  const levelQuestions = useMemo(
    () => QUESTIONS_BY_LEVEL[currentLevel] ?? [],
    [currentLevel]
  );

  const clampedQuestionIndex = useMemo(() => {
    const len = levelQuestions.length;
    if (len === 0) return 0;
    return Math.min(currentQuestionIndex, len - 1);
  }, [currentQuestionIndex, levelQuestions.length]);

  const currentQuestion = useMemo(
    () => levelQuestions[clampedQuestionIndex] ?? null,
    [levelQuestions, clampedQuestionIndex]
  );

  const isFirstQuestion = currentLevel === 1 && clampedQuestionIndex === 0;
  const TOTAL_LEVELS = 5;
  const LEVEL_NAMES = [
    "Overwhelm",
    "Overworked",
    "Organised",
    "Overseer",
    "Owner",
  ] as const;
  const LEVEL_COLORS = [
    { bg: "#ef4444", border: "#dc2626" },
    { bg: "#f97316", border: "#ea580c" },
    { bg: "#facc15", border: "#eab308" },
    { bg: "#22c55e", border: "#16a34a" },
    { bg: "#3b82f6", border: "#2563eb" },
  ] as const;
  const CHEVRON_CLIP =
    "polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%, 18px 50%)";
  function levelCompletionCount(level: number): number {
    const qs = QUESTIONS_BY_LEVEL[level] ?? [];
    return qs.reduce((sum, q) => sum + (answers[q.ref] != null ? 1 : 0), 0);
  }

  function moveToNextQuestion(newAnswers: AnswersMap) {
    const isLastQuestion =
      currentLevel === TOTAL_LEVELS &&
      clampedQuestionIndex === levelQuestions.length - 1;
    if (isLastQuestion) {
      void handleSubmitAssessment(newAnswers);
      return;
    }

    setQuestionPhase("exiting");
    window.setTimeout(() => {
      if (clampedQuestionIndex < levelQuestions.length - 1) {
        setCurrentQuestionIndex((i) => i + 1);
      } else {
        setCurrentLevel((l) => l + 1);
        setCurrentQuestionIndex(0);
      }
      setQuestionPhase("entering");
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setQuestionPhase("idle");
        });
      });
    }, 180);
  }

  async function handleSubmitAssessment(overrideAnswers?: AnswersMap) {
    const answersToSubmit = overrideAnswers ?? answers;
    setSubmitting(true);
    setSubmitError(null);
    const total_score = computeTotalScore(answersToSubmit);

    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coachSlug: coachSlug?.trim() || "BCA",
          from_landing: landingVariant ?? undefined,
          assessment_type: "diagnostic_50",
          methodology_version: METHODOLOGY_VERSION,
          contact: {
            full_name: fullName,
            email,
            phone: phone || undefined,
            business_name: businessName,
          },
          answers: answersToSubmit,
          total_score,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const base = body?.error ?? "Failed to save assessment";
        const detail = body?.detail
          ? ` — ${body.detail}${body?.code ? ` (${body.code})` : ""}`
          : "";
        throw new Error(`${base}${detail}`);
      }
      try {
        const { first_name, last_name } = splitFullName(fullName);
        sessionStorage.setItem(
          "boss_assessment_result",
          JSON.stringify({
            answers: answersToSubmit,
            total_score,
            contact: {
              first_name: first_name ?? undefined,
              last_name: last_name ?? undefined,
              full_name: fullName.trim() || undefined,
              email: email.trim() || undefined,
              phone: phone.trim() || undefined,
            },
          })
        );
      } catch {
        // ignore storage errors
      }
      router.push(`/assessment-pro/${coachSlug}/thank-you`);
    } catch (err: any) {
      setSubmitError(err?.message ?? "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (fromDashboard && !clientDashboardChecked) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ background: SCORECARD_PAGE_BG }}
      >
        <p className="text-sm text-slate-600">Loading…</p>
      </div>
    );
  }

  if (step === "intro") {
    return (
      <div
        className={`flex min-h-[100dvh] flex-col text-slate-900 ${outfit.className}`}
        style={{ background: SCORECARD_PAGE_BG }}
      >
        <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 pb-10 pt-6 md:px-10 md:pb-12 md:pt-8">
          <div className="mb-8 flex flex-col items-center gap-3 text-center md:mb-10 md:gap-4">
            <Image
              src="/profit-coach-logo.svg"
              alt="Profit Coach"
              width={240}
              height={60}
              className="h-10 w-auto md:h-11"
              priority
            />
            <h1 className="pt-2 pr-8 text-5xl font-semibold tracking-tight sm:pr-10 sm:text-6xl md:pr-12 md:text-7xl">
              <BossScoreProWordmark variant="hero" />
            </h1>
            <p className="text-base font-medium uppercase tracking-[0.22em] text-slate-500 sm:text-lg">
              {BOSS_PRO_INTRO.titleAssessment}
            </p>
          </div>

          <main className="flex flex-1 flex-col">
            <BossProAssessmentIntro
              onStart={handleStartAssessment}
              disabled={submitting}
              firstName={prospectFirstName}
            />
          </main>
        </div>
      </div>
    );
  }

  // Assessment step
  return (
    <div
      className={`min-h-screen px-6 py-12 md:px-12 md:py-16 text-slate-900 flex justify-center items-start ${outfit.className}`}
      style={{ background: SCORECARD_PAGE_BG }}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 flex-1 overflow-visible">
        <header className="space-y-3 overflow-visible border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Assessment Journey
            </p>
            <h1 className="mt-1 pr-6 pt-1.5 text-3xl font-semibold text-slate-900 md:text-4xl">
              <BossScoreProWordmark variant="header" />
            </h1>
          </div>
          {(coachName || coachBusiness) && (
            <p className="text-sm text-slate-600">
              For <span className="font-medium text-slate-800">{coachName ?? "Coach"}</span>
              {coachBusiness ? ` @ ${coachBusiness}` : null}
            </p>
          )}
          <AssessmentPersonalisedGreeting
            firstName={prospectFirstName}
            variant="header"
          />
          <div className="mt-8 w-full overflow-x-visible overflow-y-visible pt-1">
            <div className="relative z-0 flex w-full min-w-0 flex-nowrap items-stretch gap-0 overflow-visible">
            {Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).map((level) => {
              const answered = levelCompletionCount(level);
              const totalForLevel = QUESTIONS_BY_LEVEL[level]?.length ?? 0;
              const isComplete = totalForLevel > 0 && answered === totalForLevel;
              const isActive = level === currentLevel;
              const color = LEVEL_COLORS[level - 1];
              const progressPct =
                totalForLevel > 0
                  ? Math.min(100, (answered / totalForLevel) * 100)
                  : 0;
              const visuallyMuted = !isActive && !isComplete;
              const ariaLabel = [
                `Level ${level}, ${LEVEL_NAMES[level - 1]}`,
                isComplete
                  ? "completed"
                  : `${answered} of ${totalForLevel} questions answered`,
                isActive ? "current step" : "",
              ]
                .filter(Boolean)
                .join(". ");
              return (
                <button
                  key={level}
                  type="button"
                  aria-current={isActive ? "step" : undefined}
                  aria-label={ariaLabel}
                  onClick={() => {
                    setCurrentLevel(level);
                    setCurrentQuestionIndex(0);
                  }}
                  className={`relative min-w-0 flex-1 -mr-3.5 px-3 py-3 text-sm font-semibold text-white transition hover:brightness-105 last:mr-0 self-stretch ${
                    isActive ? "z-20" : "z-0"
                  }`}
                  style={{
                    backgroundColor: color.bg,
                    border: `2px solid ${
                      isActive ? "rgba(255,255,255,0.95)" : color.border
                    }`,
                    clipPath: CHEVRON_CLIP,
                    opacity: visuallyMuted ? 0.5 : 1,
                  }}
                >
                  <span className="relative z-[1] block text-[0.62rem] uppercase tracking-[0.14em] leading-none opacity-90">
                    Level {level}
                  </span>
                  <span className="relative z-[1] mt-1 block text-base font-bold leading-none">
                    {LEVEL_NAMES[level - 1]}
                  </span>
                  {isComplete ? (
                    <span className="relative z-[1] mt-1 inline-flex items-center gap-1.5 text-[0.68rem] font-bold leading-none opacity-100">
                      <span
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[10px] leading-none text-white shadow-sm"
                        aria-hidden
                      >
                        ✓
                      </span>
                      Complete
                    </span>
                  ) : (
                    <span className="relative z-[1] mt-1 block text-[0.68rem] leading-none opacity-90">
                      {answered}/{totalForLevel}
                    </span>
                  )}
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 z-[1] h-[4px] transition-[width] duration-300"
                    style={{
                      width: `${progressPct}%`,
                      backgroundColor: color.border,
                      opacity: progressPct > 0 ? 0.92 : 0,
                    }}
                    aria-hidden
                  />
                </button>
              );
            })}
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <div className="grid w-full grid-cols-10 gap-2">
              {levelQuestions.map((q, idx) => {
                const answered = answers[q.ref] != null;
                const isCurrent = idx === clampedQuestionIndex;
                return (
                  <span
                    key={q.ref}
                    className={`inline-flex h-7 w-full items-center justify-center rounded-full border text-xs font-semibold transition ${
                      answered
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : isCurrent
                        ? "border-slate-400 bg-slate-300 text-slate-700"
                        : "border-slate-300 bg-slate-100 text-slate-400"
                    }`}
                    aria-label={
                      answered
                        ? `Question ${idx + 1} answered`
                        : `Question ${idx + 1} not answered`
                    }
                  >
                    {answered ? "✓" : idx + 1}
                  </span>
                );
              })}
            </div>
          </div>
        </header>

        <main className="flex flex-col gap-6 pt-6 pb-8 flex-1 flex items-start w-full">
          {currentQuestion ? (
            <>
              <div className="w-full px-4 md:px-8">
                <div
                  className={`flex min-h-[11rem] items-center justify-center transition-all duration-200 ${
                    questionPhase === "exiting"
                      ? "-translate-y-3 opacity-0"
                      : questionPhase === "entering"
                      ? "translate-y-2 opacity-0"
                      : "translate-y-0 opacity-100"
                  }`}
                >
                  <p className="text-left text-2xl font-normal leading-snug text-slate-800 md:text-4xl">
                    {currentQuestion.question}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap justify-start gap-4 px-4 md:px-8">
                {[0, 1, 2].map((value) => {
                  const label = BOSS_PRO_SCORE_LABELS[value as 0 | 1 | 2];
                  const score = answers[currentQuestion.ref];
                  const selected = score === value;
                  const colorClasses =
                    value === 0
                      ? selected
                        ? "border-rose-400 bg-rose-100 text-rose-800"
                        : "border-rose-300 text-rose-600 hover:bg-rose-50"
                      : value === 1
                      ? selected
                        ? "border-amber-400 bg-amber-100 text-amber-800"
                        : "border-amber-300 text-amber-700 hover:bg-amber-50"
                      : selected
                      ? "border-emerald-400 bg-emerald-100 text-emerald-800"
                      : "border-emerald-300 text-emerald-700 hover:bg-emerald-50";
                  return (
                    <button
                      key={value}
                      type="button"
                      className={`rounded-xl border-2 px-6 py-4 text-lg font-semibold transition whitespace-nowrap min-w-[7rem] ${colorClasses}`}
                      aria-label={bossProScoreAriaLabel(value as 0 | 1 | 2)}
                      disabled={submitting || questionPhase !== "idle"}
                      onClick={() => {
                        const newAnswers = {
                          ...answers,
                          [currentQuestion.ref]: value as 0 | 1 | 2,
                        };
                        setAnswers(newAnswers);
                        moveToNextQuestion(newAnswers);
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <details className="flex flex-col items-start w-full px-4 md:px-8">
                <summary className="cursor-pointer list-none text-base md:text-lg text-slate-500 hover:text-sky-600 [&::-webkit-details-marker]:hidden inline-flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs border border-slate-400" aria-hidden>ⓘ</span>
                  Not sure? See examples
                </summary>
                <div className="mt-3 max-w-2xl rounded-lg border border-slate-200 bg-white p-4 text-lg text-slate-700 shadow-md space-y-3">
                  <p><span className="mr-1">🔴</span>{currentQuestion.scoringGuide.red}</p>
                  <p><span className="mr-1">🟡</span>{currentQuestion.scoringGuide.amber}</p>
                  <p><span className="mr-1">🟢</span>{currentQuestion.scoringGuide.green}</p>
                </div>
              </details>
              {!isFirstQuestion && (
                <button
                  type="button"
                  className="text-sm md:text-base text-slate-500 hover:text-slate-700 hover:underline mt-2 inline-flex items-center gap-1.5 px-4 md:px-8"
                  onClick={() => {
                    if (clampedQuestionIndex > 0) {
                      setCurrentQuestionIndex((i) => i - 1);
                    } else {
                      setCurrentLevel((l) => l - 1);
                      const prevLevelQuestions = QUESTIONS_BY_LEVEL[currentLevel - 1] ?? [];
                      setCurrentQuestionIndex(Math.max(0, prevLevelQuestions.length - 1));
                    }
                  }}
                >
                  ← Previous
                </button>
              )}
            </>
          ) : null}
        </main>

        {submitError && (
          <p className="mt-1 text-xs text-rose-600">{submitError}</p>
        )}
      </div>
      <button
        type="button"
        disabled={submitting}
        onClick={() => {
          const acceleratedAnswers = buildUniformAnswers(1);
          setAnswers(acceleratedAnswers);
          void handleSubmitAssessment(acceleratedAnswers);
        }}
        className="fixed bottom-4 right-4 z-50 rounded-full border border-slate-300 bg-white/95 px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Auto-complete all assessment answers with the same value and continue to report"
      >
        Accelerate: auto-complete all
      </button>
    </div>
  );
}

