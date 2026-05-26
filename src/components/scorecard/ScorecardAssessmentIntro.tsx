"use client";

import { AssessmentPersonalisedGreeting } from "@/components/scorecard/AssessmentPersonalisedGreeting";
import { SmileyRatingScale } from "@/components/scorecard/SmileyRatingScale";
import { SCORECARD_INTRO } from "@/lib/bossScorecardCopy";

type ScorecardAssessmentIntroProps = {
  onStart: () => void;
  disabled?: boolean;
  firstName?: string | null;
};

export function ScorecardAssessmentIntro({
  onStart,
  disabled = false,
  firstName,
}: ScorecardAssessmentIntroProps) {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-xl ring-1 ring-slate-200 md:p-12 lg:p-14">
      <div className="mx-auto max-w-xl space-y-10 text-center md:space-y-12">
        <div className="space-y-2 md:space-y-2.5">
          <AssessmentPersonalisedGreeting firstName={firstName} />
          <p className="text-xl leading-relaxed text-slate-600 md:text-2xl md:leading-relaxed">
            {SCORECARD_INTRO.subtitle}
          </p>
        </div>

        <div className="space-y-6 md:space-y-8">
          <p className="text-xl font-medium text-slate-800 md:text-[1.35rem]">
            {SCORECARD_INTRO.instruction}
          </p>
          <SmileyRatingScale
            layout="horizontal"
            variant="legend"
            disabled
            onSelect={() => {}}
          />
        </div>

        <div className="mt-4 space-y-5 md:mt-6 md:space-y-6">
          <button
            type="button"
            onClick={onStart}
            disabled={disabled}
            className="w-full rounded-full bg-[#0c5290] py-4 text-sm font-bold uppercase tracking-wide text-white shadow hover:bg-[#0a4580] disabled:opacity-50 md:py-[1.125rem]"
          >
            {SCORECARD_INTRO.startCta}
          </button>

          <details className="group text-left">
            <summary className="cursor-pointer list-none text-center text-sm font-medium text-slate-500 marker:content-none hover:text-slate-700 [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-1.5">
                {SCORECARD_INTRO.whatYouGetDetailsLabel}
                <span
                  className="text-slate-400 transition group-open:rotate-180"
                  aria-hidden
                >
                  ▾
                </span>
              </span>
            </summary>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-slate-600 md:text-base">
              {SCORECARD_INTRO.whatYouGetBullets.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}
