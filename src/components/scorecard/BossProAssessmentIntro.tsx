"use client";

import { AssessmentPersonalisedGreeting } from "@/components/scorecard/AssessmentPersonalisedGreeting";
import { BOSS_PRO_INTRO } from "@/lib/bossProAssessmentCopy";

type BossProAssessmentIntroProps = {
  onStart: () => void;
  disabled?: boolean;
  firstName?: string | null;
};

const LEGEND_STYLES = [
  "border-rose-300 bg-rose-50 text-rose-700",
  "border-amber-300 bg-amber-50 text-amber-800",
  "border-emerald-300 bg-emerald-50 text-emerald-800",
] as const;

export function BossProAssessmentIntro({
  onStart,
  disabled = false,
  firstName,
}: BossProAssessmentIntroProps) {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-xl ring-1 ring-slate-200 md:p-12 lg:p-14">
      <div className="mx-auto max-w-xl space-y-10 text-center md:space-y-12">
        <div className="space-y-2 md:space-y-2.5">
          <AssessmentPersonalisedGreeting firstName={firstName} />
          <p className="text-xl leading-relaxed text-slate-600 md:text-2xl md:leading-relaxed">
            {BOSS_PRO_INTRO.subtitle}
          </p>
        </div>

        <div className="space-y-6 md:space-y-8">
          <p className="text-xl font-medium text-slate-800 md:text-[1.35rem]">
            {BOSS_PRO_INTRO.instruction}
          </p>
          <div
            className="flex flex-wrap items-center justify-center gap-3"
            aria-hidden
          >
            {BOSS_PRO_INTRO.ratingLegend.map((item, index) => (
              <span
                key={item.label}
                className={`rounded-xl border-2 px-5 py-3 text-base font-semibold md:px-6 md:py-3.5 md:text-lg ${LEGEND_STYLES[index]}`}
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-5 md:mt-6 md:space-y-6">
          <button
            type="button"
            onClick={onStart}
            disabled={disabled}
            className="w-full rounded-full bg-[#0c5290] py-4 text-sm font-bold uppercase tracking-wide text-white shadow hover:bg-[#0a4580] disabled:opacity-50 md:py-[1.125rem]"
          >
            {BOSS_PRO_INTRO.startCta}
          </button>

          <details className="group text-left">
            <summary className="cursor-pointer list-none text-center text-sm font-medium text-slate-500 marker:content-none hover:text-slate-700 [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-1.5">
                {BOSS_PRO_INTRO.whatYouGetDetailsLabel}
                <span
                  className="text-slate-400 transition group-open:rotate-180"
                  aria-hidden
                >
                  ▾
                </span>
              </span>
            </summary>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-slate-600 md:text-base">
              {BOSS_PRO_INTRO.whatYouGetBullets.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}
