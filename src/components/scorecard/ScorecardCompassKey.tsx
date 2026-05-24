"use client";

import { SmileyRatingScale } from "@/components/scorecard/SmileyRatingScale";
import {
  SCORECARD_QUESTIONS,
  SMILEY_LABELS,
  VENN_PETAL_QUESTIONS,
} from "@/lib/bossScorecardQuestions";
import {
  scoreToPastelColor,
  type ScorecardAnswers,
  type ScorecardScore,
} from "@/lib/bossScorecardScores";

/** Petal numbers shown on the compass (Q2–Q10 only). */
const COMPASS_PETAL_NUMBERS: Partial<Record<string, number>> = (() => {
  const map: Partial<Record<string, number>> = {};
  (["vision", "velocity", "value"] as const).forEach((pillar, pi) => {
    VENN_PETAL_QUESTIONS[pillar].forEach((id, mi) => {
      map[id] = pi * 3 + mi + 1;
    });
  });
  return map;
})();

function AnswerBadge({ score }: { score: ScorecardScore | undefined }) {
  if (score == null) {
    return (
      <span className="shrink-0 text-sm font-medium text-slate-400">—</span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-2">
      <span
        className="h-3.5 w-3.5 rounded-full ring-1 ring-slate-200/80"
        style={{ backgroundColor: scoreToPastelColor(score) }}
        aria-hidden
      />
      <span className="text-sm font-semibold text-slate-700">
        {SMILEY_LABELS[score]}
      </span>
    </span>
  );
}

export function ScorecardCompassKey({
  answers,
}: {
  answers: ScorecardAnswers;
}) {
  return (
    <div className="mt-8 border-t border-slate-100 pt-8">
      <div className="mx-auto max-w-lg text-center">
        <h3 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
          Key
        </h3>
        <p className="mt-2 text-base leading-relaxed text-slate-500">
          Petal colours reflect how you rated each area. Use this key to read
          your compass and review your answers.
        </p>
      </div>

      <div className="mx-auto mt-6 max-w-3xl">
        <SmileyRatingScale
          layout="horizontal"
          variant="legend"
          disabled
          onSelect={() => {}}
        />
      </div>

      <div className="mx-auto mt-8 max-w-3xl">
        <h4 className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          Your answers
        </h4>
        <ol className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/60">
          {SCORECARD_QUESTIONS.map((q) => {
            const score = answers[q.id];
            const petalNum = COMPASS_PETAL_NUMBERS[q.id];

            return (
              <li
                key={q.id}
                className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {petalNum != null ? (
                      <span className="shrink-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                        {petalNum}
                      </span>
                    ) : null}
                    <span className="text-sm font-semibold text-slate-800">
                      {q.areaName}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    {q.question}
                  </p>
                </div>
                <AnswerBadge score={score} />
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
