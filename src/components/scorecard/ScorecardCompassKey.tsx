"use client";

import { SmileyRatingScale } from "@/components/scorecard/SmileyRatingScale";
import {
  SCORECARD_QUESTIONS,
  SMILEY_LABELS,
  type ScorecardQuestion,
} from "@/lib/bossScorecardQuestions";
import {
  scoreToPastelColor,
  type ScorecardAnswers,
  type ScorecardScore,
} from "@/lib/bossScorecardScores";

function questionDisplayNumber(q: ScorecardQuestion): string {
  if (q.id.startsWith("q11")) return q.id.slice(1);
  return String(q.step);
}

function AnswerBadge({ score }: { score: ScorecardScore | undefined }) {
  if (score == null) {
    return (
      <span className="text-sm font-medium text-slate-400">—</span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-slate-200/80"
        style={{ backgroundColor: scoreToPastelColor(score) }}
        aria-hidden
      />
      <span className="font-semibold text-slate-700">{SMILEY_LABELS[score]}</span>
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

      <div className="mx-auto mt-8 max-w-4xl">
        <h4 className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          Your answers
        </h4>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th
                  scope="col"
                  className="w-14 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-4"
                >
                  #
                </th>
                <th
                  scope="col"
                  className="w-[9.5rem] px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:w-44 sm:px-4"
                >
                  Area
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-4"
                >
                  Question
                </th>
                <th
                  scope="col"
                  className="w-[8.5rem] px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:w-36 sm:px-4"
                >
                  Answer
                </th>
              </tr>
            </thead>
            <tbody>
              {SCORECARD_QUESTIONS.map((q) => {
                const score = answers[q.id];

                return (
                  <tr
                    key={q.id}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <td className="align-top px-3 py-3.5 font-mono text-xs font-semibold tabular-nums text-slate-500 sm:px-4">
                      {questionDisplayNumber(q)}
                    </td>
                    <td className="align-top px-3 py-3.5 font-semibold text-slate-800 sm:px-4">
                      {q.areaName}
                    </td>
                    <td className="align-top px-3 py-3.5 leading-relaxed text-slate-600 sm:px-4">
                      {q.question}
                    </td>
                    <td className="align-top px-3 py-3.5 sm:px-4">
                      <AnswerBadge score={score} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
