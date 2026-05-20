"use client";

import { useRouter } from "next/navigation";
import { ScorecardProgressBar } from "@/components/scorecard/ScorecardProgressBar";
import { SmileyRatingScale } from "@/components/scorecard/SmileyRatingScale";
import {
  BEST_PRACTICE_QUESTIONS,
  SCORECARD_PAGE_BG,
} from "@/lib/bossScorecardQuestions";

export default function PreviewScorecardPage() {
  const router = useRouter();
  const question = BEST_PRACTICE_QUESTIONS[0];

  return (
    <div
      className="min-h-screen px-4 py-8"
      style={{ background: SCORECARD_PAGE_BG }}
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <ScorecardProgressBar currentStep={3} />
        <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            BOSS Scorecard preview
          </p>
          <h1 className="mt-4 text-2xl leading-snug text-slate-800 md:text-3xl">
            {question.question}
          </h1>
          <div className="mt-8">
            <SmileyRatingScale onSelect={() => {}} />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => router.push("/preview/scorecard-assessment")}
            className="rounded-full bg-[#0c5290] px-6 py-3 text-sm font-bold text-white shadow"
          >
            Full assessment flow
          </button>
          <button
            type="button"
            onClick={() =>
              router.push("/preview/scorecard-results?preview=1&coach=pam")
            }
            className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm"
          >
            Sample results only
          </button>
        </div>
      </div>
    </div>
  );
}
