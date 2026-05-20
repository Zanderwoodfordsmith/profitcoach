"use client";

import { TOTAL_SCORECARD_STEPS } from "@/lib/bossScorecardQuestions";

/** Matches hero score arc on scorecard results (dark → light brand blue). */
export const SCORECARD_PROGRESS_FILL =
  "linear-gradient(90deg, #0c5290 0%, #42a1ee 55%, #75c8ff 100%)";

type ScorecardProgressBarProps = {
  /** Step label — which question the user is on (1–15). */
  currentStep: number;
  /** Finished steps only; current step counts after it is completed. */
  completedSteps?: number;
};

function progressLabel(step: number): string {
  return `Question ${step} of ${TOTAL_SCORECARD_STEPS}`;
}

export function ScorecardProgressBar({
  currentStep,
  completedSteps,
}: ScorecardProgressBarProps) {
  const completed = Math.max(
    0,
    Math.min(
      completedSteps ?? Math.max(0, currentStep - 1),
      TOTAL_SCORECARD_STEPS
    )
  );
  const pct = Math.min(100, (completed / TOTAL_SCORECARD_STEPS) * 100);

  return (
    <div className="w-full space-y-3 py-0.5">
      <div className="flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>{progressLabel(Math.min(currentStep, TOTAL_SCORECARD_STEPS))}</span>
        <span className="h-3.5 w-px shrink-0 bg-slate-300" aria-hidden />
        <span>{Math.round(pct)}% complete</span>
      </div>
      <div className="h-3.5 w-full overflow-hidden rounded-full bg-slate-200/90 md:h-4">
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${pct}%`,
            background: SCORECARD_PROGRESS_FILL,
          }}
        />
      </div>
    </div>
  );
}
