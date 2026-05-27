"use client";

import { useEffect, useRef, useState } from "react";
import { SCORECARD_PROGRESS_FILL } from "@/components/scorecard/ScorecardProgressBar";

const INSIGHTS_GENERATING_MESSAGES = [
  "Reviewing your BOSS scores…",
  "Identifying what matters most…",
  "Writing personalised insights…",
  "Preparing your coaching summary…",
  "Almost ready…",
] as const;

/** Target loading duration before the bar reaches ~94% (unless insights finish sooner). */
export const INSIGHTS_GENERATING_DURATION_MS = 45_000;

const MESSAGE_THRESHOLDS = [0, 0.18, 0.4, 0.62, 0.82] as const;

const PROGRESS_COMPLETE_FILL =
  "linear-gradient(90deg, #16a34a 0%, #22c55e 55%, #4ade80 100%)";

const COMPLETE_PROGRESS_THRESHOLD = 94;

function messageIndexForProgress(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  let index = 0;
  for (let i = 0; i < MESSAGE_THRESHOLDS.length; i++) {
    if (clamped >= MESSAGE_THRESHOLDS[i]) index = i;
  }
  return Math.min(index, INSIGHTS_GENERATING_MESSAGES.length - 1);
}

/** Fast to ~38%, then eases through the rest so the bar moves the whole time. */
function progressPercentForTime(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  if (clamped <= 0.14) {
    return (clamped / 0.14) * 38;
  }
  const tail = (clamped - 0.14) / 0.86;
  return 38 + (1 - Math.pow(1 - tail, 1.35)) * 56;
}

type InsightsGeneratingProgressProps = {
  ready: boolean;
  error?: string | null;
  onFinished: () => void;
};

export function InsightsGeneratingProgress({
  ready,
  error,
  onFinished,
}: InsightsGeneratingProgressProps) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const finishedRef = useRef(false);
  const completingRef = useRef(false);
  const progressRef = useRef(0);
  progressRef.current = progress;

  useEffect(() => {
    if (ready || error || completingRef.current) return;

    const started = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = now - started;
      const t = Math.min(1, elapsed / INSIGHTS_GENERATING_DURATION_MS);
      setProgress(progressPercentForTime(t));
      setMessageIndex(messageIndexForProgress(t));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setProgress((prev) => Math.max(prev, 94));
        setMessageIndex(INSIGHTS_GENERATING_MESSAGES.length - 1);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, error]);

  useEffect(() => {
    if (!ready || error || finishedRef.current || completingRef.current) return;

    completingRef.current = true;
    const startProgress = progressRef.current;
    const startTime = performance.now();
    const duration = 650;
    let frame = 0;

    const animateComplete = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 2);
      setProgress(startProgress + (100 - startProgress) * eased);
      if (t < 1) {
        frame = requestAnimationFrame(animateComplete);
      } else {
        setProgress(100);
        setShowComplete(true);
        window.setTimeout(() => {
          if (!finishedRef.current) {
            finishedRef.current = true;
            onFinished();
          }
        }, 900);
      }
    };

    frame = requestAnimationFrame(animateComplete);
    return () => cancelAnimationFrame(frame);
  }, [ready, error, onFinished]);

  const isComplete = showComplete && progress >= COMPLETE_PROGRESS_THRESHOLD;
  const barScale = Math.max(0, Math.min(1, progress / 100));

  if (error) {
    return (
      <div className="space-y-4 py-1">
        <p className="text-center text-base font-medium leading-snug text-red-600">
          {error}
        </p>
        <button
          type="button"
          onClick={() => {
            if (!finishedRef.current) {
              finishedRef.current = true;
              onFinished();
            }
          }}
          className="mx-auto block text-sm font-semibold text-sky-600 hover:text-sky-700"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-1">
      {isComplete ? (
        <div className="flex flex-col items-center gap-2 py-1">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 shadow-md shadow-green-500/25 ring-4 ring-green-100"
            aria-hidden
          >
            <svg
              className="h-7 w-7 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-base font-semibold text-green-700">Insights ready</p>
        </div>
      ) : (
        <p
          key={messageIndex}
          className="min-h-[2.75rem] text-center text-base font-medium leading-snug text-slate-700 transition-opacity duration-500 ease-in-out sm:text-lg"
        >
          {INSIGHTS_GENERATING_MESSAGES[messageIndex]}
        </p>
      )}

      <div className="space-y-2.5">
        <div className="flex items-center justify-center text-xs font-semibold uppercase tracking-wide">
          <span className={isComplete ? "text-green-700" : "text-slate-500"}>
            {Math.round(progress)}% complete
          </span>
        </div>
        <div className="h-3.5 w-full overflow-hidden rounded-full bg-slate-200/90 md:h-4">
          <div
            className={`h-full w-full origin-left rounded-full will-change-transform ${
              isComplete ? "transition-[background] duration-300" : ""
            }`}
            style={{
              transform: `scaleX(${barScale})`,
              background: isComplete ? PROGRESS_COMPLETE_FILL : SCORECARD_PROGRESS_FILL,
            }}
          />
        </div>
      </div>
    </div>
  );
}
