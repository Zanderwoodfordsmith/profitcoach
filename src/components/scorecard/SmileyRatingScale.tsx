"use client";

import {
  SMILEY_COLORS,
  SMILEY_LABELS,
} from "@/lib/bossScorecardQuestions";
import type { ScorecardScore } from "@/lib/bossScorecardScores";

type SmileyRatingScaleProps = {
  value?: ScorecardScore;
  onSelect: (score: ScorecardScore) => void;
  disabled?: boolean;
  /** Horizontal row saves vertical space on long questions; vertical stacks on narrow screens. */
  layout?: "horizontal" | "vertical";
};

const SCORES = [1, 2, 3, 4, 5] as const;

/**
 * Quadratic mouth curves — path shapes are reversed vs SVG intuition so
 * 1 big frown, 2 frown, 3 flat, 4 small smile, 5 big smile render correctly.
 */
const MOUTH_BY_SCORE: Record<ScorecardScore, string> = {
  1: "M 9 28 Q 20 18 31 28",
  2: "M 12 26 Q 20 22 28 26",
  3: "M 12 28 L 28 28",
  4: "M 12 27 Q 20 31 28 27",
  5: "M 9 28 Q 20 38 31 28",
};

function SmileyFace({ score }: { score: ScorecardScore }) {
  const mouth = MOUTH_BY_SCORE[score];

  return (
    <svg viewBox="0 0 40 40" className="h-11 w-11 sm:h-12 sm:w-12" aria-hidden>
      <circle cx="14" cy="15" r="2.8" fill="#171717" />
      <circle cx="26" cy="15" r="2.8" fill="#171717" />
      <path
        d={mouth}
        fill="none"
        stroke="#171717"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SmileyRatingScale({
  value,
  onSelect,
  disabled = false,
  layout = "horizontal",
}: SmileyRatingScaleProps) {
  if (layout === "vertical") {
    return (
      <div
        className="flex w-full flex-col gap-2.5"
        role="radiogroup"
        aria-label="Rate from 1 to 5"
      >
        {SCORES.map((score) => {
          const selected = value === score;
          const color = SMILEY_COLORS[score];
          return (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${score}: ${SMILEY_LABELS[score]}`}
              disabled={disabled}
              onClick={() => onSelect(score)}
              className={`flex w-full items-center gap-4 rounded-xl border-2 px-4 py-3.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-50 ${
                selected
                  ? "border-slate-300 bg-white shadow-md ring-2 ring-offset-1"
                  : "border-slate-200 bg-white/90 hover:border-slate-300 hover:bg-white hover:shadow-sm"
              }`}
              style={
                selected
                  ? ({ ringColor: color } as React.CSSProperties)
                  : undefined
              }
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.35)]"
                style={{ backgroundColor: color }}
              >
                <SmileyFace score={score} />
              </span>
              <span className="text-base font-semibold text-slate-800">
                {SMILEY_LABELS[score]}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="grid w-full grid-cols-5 gap-1.5 sm:gap-2 md:gap-3"
      role="radiogroup"
      aria-label="Rate from 1 to 5"
    >
      {SCORES.map((score) => {
        const selected = value === score;
        const color = SMILEY_COLORS[score];
        return (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${score}: ${SMILEY_LABELS[score]}`}
            disabled={disabled}
            onClick={() => onSelect(score)}
            className={`flex flex-col items-center gap-3.5 rounded-xl border-2 px-1 py-3 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-50 sm:px-1.5 sm:py-3.5 ${
              selected
                ? "border-slate-300 bg-white shadow-md ring-2 ring-offset-1"
                : "border-transparent bg-white/60 hover:border-slate-200 hover:bg-white hover:shadow-sm"
            }`}
            style={
              selected
                ? ({ ringColor: color } as React.CSSProperties)
                : undefined
            }
          >
            <span
              className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.35)] sm:h-20 sm:w-20"
              style={{ backgroundColor: color }}
            >
              <SmileyFace score={score} />
            </span>
            <span className="text-center text-sm font-semibold leading-tight text-slate-600 sm:text-base">
              {SMILEY_LABELS[score]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
