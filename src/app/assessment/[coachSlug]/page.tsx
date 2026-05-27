"use client";

import { Outfit } from "next/font/google";
import Image from "next/image";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BossScoreWordmark } from "@/components/scorecard/BossScoreWordmark";
import { OpenTextStep } from "@/components/scorecard/OpenTextStep";
import { QualifyingStackForm } from "@/components/scorecard/QualifyingStackForm";
import {
  SCORECARD_REPORT_GENERATING_MS,
  ScorecardReportGenerating,
} from "@/components/scorecard/ScorecardReportGenerating";
import { ScorecardAssessmentIntro } from "@/components/scorecard/ScorecardAssessmentIntro";
import { ScorecardProgressBar } from "@/components/scorecard/ScorecardProgressBar";
import { SmileyRatingScale } from "@/components/scorecard/SmileyRatingScale";
import { SCORECARD_INTRO } from "@/lib/bossScorecardCopy";
import {
  BEST_PRACTICE_QUESTIONS,
  OPEN_TEXT_HEADING,
  OUTCOME_QUESTIONS,
  QUALIFYING_HEADING,
  QUALIFYING_JOURNEY_FIELDS,
  QUALIFYING_SUPPORT_FIELDS,
  QUALIFYING_SUPPORT_HEADING,
  getScorecardProgress,
  SCORECARD_PAGE_BG,
  type QualifyingData,
} from "@/lib/bossScorecardQuestions";
import {
  buildScorecardResult,
  computeScorecardTotal,
  getBossLevel,
  isJourneyQualifyingComplete,
  isQualifyingComplete,
  isScorecardComplete,
  isSupportQualifyingComplete,
  type ScorecardAnswers,
  type ScorecardScore,
} from "@/lib/bossScorecardScores";
import { resolveLandingTrackCoachSlug } from "@/lib/landingAnalytics";
import { getPrimaryCoachSlug } from "@/lib/primaryCoach";
import {
  assessmentContactToSessionPayload,
  LANDING_CONTACT_SESSION_KEY,
  mergeAssessmentContactWithSession,
  parseAssessmentContactParams,
  readLandingContactSession,
  resolveAssessmentProspectFirstName,
} from "@/lib/assessmentContactParams";

const outfit = Outfit({ subsets: ["latin"] });

const RESULT_STORAGE_KEY = "boss_scorecard_result";

type Screen =
  | { kind: "intro"; step: number }
  | { kind: "question"; step: number; questionId: string }
  | { kind: "outcome"; step: number; questionId: string }
  | { kind: "qualifying_journey"; step: number }
  | { kind: "qualifying_support"; step: number }
  | { kind: "open_text"; step: number };

function buildScreens(): Screen[] {
  const screens: Screen[] = [{ kind: "intro", step: 0 }];
  screens.push(
    ...BEST_PRACTICE_QUESTIONS.map((q) => ({
      kind: "question" as const,
      step: q.step,
      questionId: q.id,
    }))
  );
  OUTCOME_QUESTIONS.forEach((q, index) => {
    screens.push({
      kind: "outcome",
      step: 11 + index,
      questionId: q.id,
    });
  });
  screens.push({ kind: "qualifying_journey", step: 14 });
  screens.push({ kind: "qualifying_support", step: 15 });
  screens.push({ kind: "open_text", step: 16 });
  return screens;
}

/** General /score and BCA links use the primary coach; real coach slugs pass through. */
function assessmentCoachSlugForApi(raw: string): string | undefined {
  const slug = raw.trim().toLowerCase();
  if (!slug || slug === "bca") return undefined;
  if (slug === getPrimaryCoachSlug()) return undefined;
  return slug;
}

const SCREENS = buildScreens();

export default function ScorecardAssessmentPage({
  params,
}: {
  params: Promise<{ coachSlug: string }>;
}) {
  const { coachSlug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPreview = searchParams.get("preview") === "1";
  const fromLanding = searchParams.get("from_landing");
  const landingVariant =
    isPreview
      ? "d"
      : fromLanding === "a" ||
          fromLanding === "b" ||
          fromLanding === "c" ||
          fromLanding === "d"
        ? fromLanding
        : null;
  const startTracked = useRef(false);
  const directLeadCaptured = useRef(false);
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReportedScreen = useRef(0);

  const urlContact = useMemo(
    () => parseAssessmentContactParams(searchParams),
    [searchParams]
  );
  const isFromLandingFunnel = landingVariant != null;
  const trackCoachSlug = useMemo(
    () =>
      isFromLandingFunnel
        ? resolveLandingTrackCoachSlug(searchParams, {
            fromLanding: true,
            fallbackCoachSlug: coachSlug,
          })
        : null,
    [isFromLandingFunnel, searchParams, coachSlug]
  );
  const landingSession = isFromLandingFunnel ? readLandingContactSession() : null;
  const initialContact = mergeAssessmentContactWithSession(
    urlContact,
    landingSession
  );

  const [screenIndex, setScreenIndex] = useState(0);
  const [answers, setAnswers] = useState<ScorecardAnswers>({});
  const [qualifying, setQualifying] = useState<QualifyingData>({});
  const [openText, setOpenText] = useState("");
  const [qualifyingError, setQualifyingError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [gateChecked, setGateChecked] = useState(false);

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

  const currentScreen = SCREENS[screenIndex] ?? SCREENS[0];
  const progress = getScorecardProgress(currentScreen.step);

  useEffect(() => {
    setGateChecked(true);
  }, []);

  useEffect(() => {
    if (isFromLandingFunnel || directLeadCaptured.current) return;
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
  }, [coachSlug, isFromLandingFunnel, urlContact]);

  useEffect(() => {
    if (!isFromLandingFunnel || startTracked.current) return;
    startTracked.current = true;
    fetch("/api/landing/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variant: landingVariant,
        coach_slug: trackCoachSlug,
        event_type: "start",
      }),
    }).catch(() => {});
  }, [isFromLandingFunnel, landingVariant, trackCoachSlug]);

  useEffect(() => {
    if (!isFromLandingFunnel) return;
    const session = readLandingContactSession();
    if (!session) return;
    const merged = mergeAssessmentContactWithSession(urlContact, session);
    if (merged.fullName) setFullName(merged.fullName);
    if (merged.email) setEmail(merged.email);
    if (merged.phone) setPhone(merged.phone);
    if (merged.businessName) setBusinessName(merged.businessName);
  }, [isFromLandingFunnel, urlContact]);

  const reportProgress = useCallback(
    (screen: number, abandoned = false) => {
      if (!email.trim() && !abandoned) return;
      if (!abandoned && screen <= lastReportedScreen.current) return;
      if (!abandoned) lastReportedScreen.current = screen;

      fetch("/api/scorecard/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coachSlug: assessmentCoachSlugForApi(coachSlug ?? "") ?? null,
          contact: {
            email: email.trim() || undefined,
            full_name: fullName.trim() || undefined,
            phone: phone.trim() || undefined,
          },
          screen,
          abandoned,
        }),
      }).catch(() => {});
    },
    [coachSlug, email, fullName, phone]
  );

  useEffect(() => {
    if (!gateChecked || screenIndex === 0) return;
    if (progressTimer.current) clearTimeout(progressTimer.current);
    progressTimer.current = setTimeout(() => {
      reportProgress(currentScreen.step);
    }, 400);
    return () => {
      if (progressTimer.current) clearTimeout(progressTimer.current);
    };
  }, [gateChecked, screenIndex, currentScreen.step, reportProgress]);

  useEffect(() => {
    function onBeforeUnload() {
      reportProgress(currentScreen.step, true);
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [currentScreen.step, reportProgress]);

  function advanceScreen() {
    setScreenIndex((i) => Math.min(i + 1, SCREENS.length - 1));
  }

  function goBack() {
    setQualifyingError(null);
    setScreenIndex((i) => Math.max(0, i - 1));
  }

  const canGoBack = screenIndex > 0;

  function handleScoreSelect(questionId: string, score: ScorecardScore) {
    const next = { ...answers, [questionId]: score };
    setAnswers(next);
    window.setTimeout(() => advanceScreen(), 280);
  }

  async function handleSubmit() {
    if (!isScorecardComplete(answers)) {
      setSubmitError("Please complete all scored questions.");
      return;
    }
    if (!isQualifyingComplete(qualifying)) {
      setQualifyingError("Please complete all questions.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setIsGeneratingReport(true);
    const generatingStarted = Date.now();
    const totalScore = computeScorecardTotal(answers);
    const bossLevel = getBossLevel(totalScore);
    const prospectFirstName = resolveAssessmentProspectFirstName(urlContact, {
      fullName,
    });

    const trimmedOpenText = openText.trim() || null;

    const result = buildScorecardResult(
      answers,
      qualifying,
      trimmedOpenText,
      prospectFirstName
    );

    try {
      const savePromise = fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coachSlug: assessmentCoachSlugForApi(coachSlug ?? ""),
          from_landing: landingVariant ?? undefined,
          landing_brand: searchParams.get("landing_brand") === "1" ? true : undefined,
          landing_coach_slug: searchParams.has("landing_coach_slug")
            ? searchParams.get("landing_coach_slug")?.trim() || null
            : undefined,
          assessment_type: "boss_scorecard",
          contact: {
            full_name: fullName,
            email,
            phone: phone || undefined,
            business_name: businessName,
          },
          answers,
          total_score: totalScore,
          boss_level: bossLevel,
          qualifying_data: qualifying,
          open_text: trimmedOpenText,
          last_screen_reached: 16,
        }),
      });

      const [res] = await Promise.all([
        savePromise,
        new Promise<void>((resolve) => {
          const elapsed = Date.now() - generatingStarted;
          const remaining = Math.max(0, SCORECARD_REPORT_GENERATING_MS - elapsed);
          window.setTimeout(resolve, remaining);
        }),
      ]);

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to save scorecard");
      }
      try {
        sessionStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(result));
      } catch {
        // ignore
      }
      router.push(`/assessment/${coachSlug}/thank-you`);
    } catch (err: unknown) {
      setIsGeneratingReport(false);
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!gateChecked) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ background: SCORECARD_PAGE_BG }}
      >
        <p className="text-sm text-slate-600">Loading…</p>
      </div>
    );
  }

  const question =
    currentScreen.kind === "question"
      ? BEST_PRACTICE_QUESTIONS.find((q) => q.id === currentScreen.questionId)
      : currentScreen.kind === "outcome"
        ? OUTCOME_QUESTIONS.find((q) => q.id === currentScreen.questionId)
        : null;

  const scoredQuestionId =
    question &&
    (currentScreen.kind === "question" || currentScreen.kind === "outcome")
      ? question.id
      : null;
  const existingScore = scoredQuestionId
    ? answers[scoredQuestionId]
    : undefined;
  const canGoNext =
    !!scoredQuestionId &&
    existingScore != null &&
    existingScore >= 1 &&
    existingScore <= 5;

  return (
    <div
      className={`flex min-h-[100dvh] flex-col text-slate-900 ${outfit.className}`}
      style={{ background: SCORECARD_PAGE_BG }}
    >
      <div
        className={`mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 pt-6 md:px-10 md:pt-8 ${
          currentScreen.kind === "intro" ? "pb-10 md:pb-12" : "pb-48 md:pb-52"
        }`}
      >
        <div
          className={`flex flex-col items-center text-center ${
            currentScreen.kind === "intro"
              ? "mb-8 gap-3 md:mb-10 md:gap-4"
              : "mb-8 gap-2.5 md:mb-10"
          }`}
        >
          <Image
            src="/profit-coach-logo.svg"
            alt="Profit Coach"
            width={240}
            height={60}
            className="h-10 w-auto md:h-11"
            priority
          />
          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl">
            <BossScoreWordmark />
          </h1>
          {currentScreen.kind === "intro" ? (
            <p className="text-base font-medium uppercase tracking-[0.22em] text-slate-500 sm:text-lg">
              {SCORECARD_INTRO.titleAssessment}
            </p>
          ) : null}
        </div>

        <main className="flex flex-1 flex-col">
          <div
            className={
              currentScreen.kind === "intro" ? "relative" : "relative pt-8"
            }
          >
            <button
              type="button"
              onClick={goBack}
              disabled={submitting || isGeneratingReport || !canGoBack}
              tabIndex={canGoBack ? 0 : -1}
              aria-hidden={!canGoBack}
              className={`absolute left-0 top-0 z-10 inline-flex items-center gap-1.5 text-sm font-medium transition disabled:opacity-50 ${
                canGoBack
                  ? "visible text-slate-500 hover:text-slate-800"
                  : "pointer-events-none invisible"
              }`}
            >
              <span aria-hidden>←</span>
              Back
            </button>

            <button
              type="button"
              onClick={advanceScreen}
              disabled={submitting || isGeneratingReport || !canGoNext}
              tabIndex={canGoNext ? 0 : -1}
              aria-hidden={!canGoNext}
              className={`absolute right-0 top-0 z-10 inline-flex items-center gap-1.5 text-sm font-medium transition disabled:opacity-50 ${
                canGoNext
                  ? "visible text-slate-500 hover:text-slate-800"
                  : "pointer-events-none invisible"
              }`}
            >
              Next
              <span aria-hidden>→</span>
            </button>

          {currentScreen.kind === "intro" ? (
            <ScorecardAssessmentIntro
              onStart={advanceScreen}
              disabled={submitting || isGeneratingReport}
              firstName={prospectFirstName}
            />
          ) : null}

          {currentScreen.kind === "question" && question ? (
            <div className="rounded-3xl bg-white p-7 shadow-xl ring-1 ring-slate-200 md:p-11 lg:p-14">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                {question.areaName}
              </p>
              <h2 className="mt-4 text-2xl font-normal leading-snug text-slate-800 md:text-[1.75rem] lg:text-[2rem]">
                {question.question}
              </h2>
              <div className="mt-6 md:mt-8">
                <SmileyRatingScale
                  value={answers[question.id]}
                  onSelect={(score) => handleScoreSelect(question.id, score)}
                  disabled={submitting}
                  layout="horizontal"
                />
              </div>
            </div>
          ) : null}

          {currentScreen.kind === "outcome" && question ? (
            <div className="rounded-3xl bg-white p-7 shadow-xl ring-1 ring-slate-200 md:p-11 lg:p-14">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                Outcomes
              </p>
              <h2 className="mt-4 text-2xl font-normal leading-snug text-slate-800 md:text-[1.75rem] lg:text-[2rem]">
                {question.question}
              </h2>
              <div className="mt-6 md:mt-8">
                <SmileyRatingScale
                  value={answers[question.id]}
                  onSelect={(score) => {
                    setAnswers((prev) => ({ ...prev, [question.id]: score }));
                    window.setTimeout(() => advanceScreen(), 280);
                  }}
                  disabled={submitting}
                  layout="horizontal"
                />
              </div>
            </div>
          ) : null}

          {currentScreen.kind === "qualifying_journey" ? (
            <div className="rounded-3xl bg-white p-7 pb-8 shadow-xl ring-1 ring-slate-200 md:p-11 md:pb-12 lg:p-14 lg:pb-14">
              <h2 className="text-2xl font-semibold leading-snug text-slate-900 md:text-3xl">
                {QUALIFYING_HEADING}
              </h2>
              <div className="mt-6 md:mt-8">
                <QualifyingStackForm
                  fields={QUALIFYING_JOURNEY_FIELDS}
                  data={qualifying}
                  onChange={(data) => {
                    setQualifying(data);
                    setQualifyingError(null);
                  }}
                  error={qualifyingError}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isJourneyQualifyingComplete(qualifying)) {
                    setQualifyingError("Please answer all questions.");
                    return;
                  }
                  advanceScreen();
                }}
                disabled={submitting}
                className="mt-8 w-full rounded-full bg-[#0c5290] py-4 text-sm font-bold uppercase tracking-wide text-white shadow hover:bg-[#0a4580] disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          ) : null}

          {currentScreen.kind === "qualifying_support" ? (
            <div className="rounded-3xl bg-white p-7 pb-8 shadow-xl ring-1 ring-slate-200 md:p-11 md:pb-12 lg:p-14 lg:pb-14">
              <h2 className="text-2xl font-semibold leading-snug text-slate-900 md:text-3xl">
                {QUALIFYING_SUPPORT_HEADING}
              </h2>
              <div className="mt-6 md:mt-8">
                <QualifyingStackForm
                  fields={QUALIFYING_SUPPORT_FIELDS}
                  data={qualifying}
                  onChange={(data) => {
                    setQualifying(data);
                    setQualifyingError(null);
                  }}
                  error={qualifyingError}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isSupportQualifyingComplete(qualifying)) {
                    setQualifyingError("Please answer all questions.");
                    return;
                  }
                  advanceScreen();
                }}
                disabled={submitting}
                className="mt-8 w-full rounded-full bg-[#0c5290] py-4 text-sm font-bold uppercase tracking-wide text-white shadow hover:bg-[#0a4580] disabled:opacity-50"
              >
                Continue
              </button>
              {qualifyingError ? (
                <p className="mt-3 text-sm text-red-600">{qualifyingError}</p>
              ) : null}
            </div>
          ) : null}

          {currentScreen.kind === "open_text" && isGeneratingReport ? (
            <ScorecardReportGenerating />
          ) : null}

          {currentScreen.kind === "open_text" && !isGeneratingReport ? (
            <div className="rounded-3xl bg-white p-7 pb-8 shadow-xl ring-1 ring-slate-200 md:p-11 md:pb-12 lg:p-14 lg:pb-14">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                Optional
              </p>
              <h2 className="mt-4 text-2xl font-semibold leading-snug text-slate-900 md:text-3xl">
                {OPEN_TEXT_HEADING}
              </h2>
              <div className="mt-6 md:mt-8">
                <OpenTextStep
                  value={openText}
                  onChange={setOpenText}
                />
              </div>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="mt-8 w-full rounded-full bg-[#0c5290] py-4 text-sm font-bold uppercase tracking-wide text-white shadow hover:bg-[#0a4580] disabled:opacity-50"
              >
                Show My Results
              </button>
              {submitError ? (
                <p className="mt-3 text-sm text-red-600">{submitError}</p>
              ) : null}
            </div>
          ) : null}
          </div>
        </main>
      </div>

      {!isGeneratingReport && currentScreen.kind !== "intro" ? (
        <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 shadow-[0_-10px_40px_-16px_rgba(15,23,42,0.14)] backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto w-[min(100%,56rem)] px-5 py-5 md:px-10 md:py-6">
            <ScorecardProgressBar
              currentStep={progress.currentStep}
              completedSteps={progress.completedSteps}
            />
          </div>
        </footer>
      ) : null}
    </div>
  );
}
