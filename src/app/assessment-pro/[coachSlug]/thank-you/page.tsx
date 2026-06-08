"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { BossProReportResults } from "@/components/scorecard/BossProReportResults";
import {
  readLandingContactSession,
  type LandingContactSession,
} from "@/lib/assessmentContactParams";
import {
  resolveReportCalendarContact,
  type CalendarContactParams,
} from "@/lib/calendarContactParams";
import {
  buildFakeScores,
  getTotalScore,
  type AnswersMap,
} from "@/lib/bossScores";

const STORAGE_KEY = "boss_assessment_result";

export default function AssessmentThankYouPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const coachSlugFromPath = (params?.coachSlug as string) ?? "";
  const coachSlug =
    searchParams?.get("coach")?.trim() || coachSlugFromPath;

  const [answers, setAnswers] = useState<AnswersMap | null>(null);
  const [totalScore, setTotalScore] = useState<number | null>(null);
  const [calendarContact, setCalendarContact] =
    useState<CalendarContactParams | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;

    let storedContact: LandingContactSession | null = null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          contact?: {
            first_name?: string;
            last_name?: string;
            email?: string;
            phone?: string;
            full_name?: string;
          };
        };
        if (parsed.contact) {
          storedContact = {
            firstName: parsed.contact.first_name,
            lastName: parsed.contact.last_name,
            email: parsed.contact.email,
            phone: parsed.contact.phone,
            fullName: parsed.contact.full_name,
          };
        }
      }
    } catch {
      // ignore
    }

    setCalendarContact(
      resolveReportCalendarContact({
        searchParams,
        sessionContact: storedContact ?? readLandingContactSession(),
      })
    );

    const preview =
      searchParams?.get("preview") === "1" ||
      searchParams?.get("preview") === "true";
    const scoreParam = searchParams?.get("score");
    const parsed = scoreParam ? parseInt(scoreParam, 10) : NaN;
    const targetScore = Number.isFinite(parsed) ? parsed : 38;

    if (preview || scoreParam) {
      const fake = buildFakeScores(targetScore);
      setAnswers(fake);
      setTotalScore(getTotalScore(fake));
      return;
    }

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const fake = buildFakeScores(38);
        setAnswers(fake);
        setTotalScore(getTotalScore(fake));
        return;
      }
      const data = JSON.parse(raw) as {
        answers?: AnswersMap;
        total_score?: number;
      };
      const a = data?.answers ?? {};
      setAnswers(a);
      setTotalScore(
        typeof data?.total_score === "number"
          ? data.total_score
          : getTotalScore(a)
      );
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      const fake = buildFakeScores(38);
      setAnswers(fake);
      setTotalScore(getTotalScore(fake));
    }
  }, [mounted, searchParams]);

  if (!mounted || answers === null || totalScore === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <p className="text-slate-600">Loading your results…</p>
      </div>
    );
  }

  const isPreview =
    searchParams?.get("preview") === "1" ||
    searchParams?.get("preview") === "true";

  return (
    <BossProReportResults
      answers={answers}
      totalScore={totalScore}
      coachSlug={coachSlug}
      isPreview={isPreview}
      calendarContact={calendarContact}
    />
  );
}
