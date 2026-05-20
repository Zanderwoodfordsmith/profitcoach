"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { SCORECARD_PROGRESS_FILL } from "@/components/scorecard/ScorecardProgressBar";

const GENERATING_TITLE = "Boss Score Assessment Complete";

const GENERATING_MESSAGES = [
  "Analysing your responses…",
  "Crafting your report…",
  "Processing your data…",
  "Benchmarking against other businesses…",
] as const;

const PROGRESS_COMPLETE_FILL =
  "linear-gradient(90deg, #16a34a 0%, #22c55e 55%, #4ade80 100%)";

/** Total loading screen time (synced with assessment submit min wait). */
const DURATION_MS = 5100;

/** When each status line appears (fraction of DURATION_MS) — holds longer than equal splits. */
const MESSAGE_THRESHOLDS = [0, 0.2, 0.45, 0.7] as const;

const COMPLETE_PROGRESS_THRESHOLD = 94;

function messageIndexForProgress(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  let index = 0;
  for (let i = 0; i < MESSAGE_THRESHOLDS.length; i++) {
    if (clamped >= MESSAGE_THRESHOLDS[i]) index = i;
  }
  return Math.min(index, GENERATING_MESSAGES.length - 1);
}

/** Fast to ~38%, then eases through the rest so the bar moves the whole time. */
function progressPercentForTime(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  if (clamped <= 0.14) {
    return (clamped / 0.14) * 38;
  }
  const tail = (clamped - 0.14) / 0.86;
  return 38 + (1 - Math.pow(1 - tail, 1.35)) * 62;
}

const CONFETTI_COLORS = [
  "#0c5290",
  "#42a1ee",
  "#75c8ff",
  "#22c55e",
  "#eab308",
  "#f97316",
] as const;

type ConfettiMotion = "up" | "side" | "down";

const CONFETTI_PIECES = Array.from({ length: 54 }, (_, i) => {
  const motion: ConfettiMotion =
    i % 3 === 0 ? "up" : i % 3 === 1 ? "side" : "down";
  return {
    motion,
    left: `${4 + ((i * 19) % 92)}%`,
    top: motion === "down" ? `${(i * 13) % 35}%` : undefined,
    delay: `${(i % 9) * 0.07 + (i > 27 ? 0.3 : 0)}s`,
    duration: `${2.2 + (i % 5) * 0.5}s`,
    width: 5 + (i % 5) * 2,
    height: i % 4 === 0 ? 4 + (i % 3) * 2 : 6 + (i % 4) * 2,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    drift: -56 + ((i * 19) % 112),
    wobble: -32 + ((i * 13) % 64),
    round: i % 3 === 0,
  };
});

function ConfettiLayer() {
  return (
    <div
      className="pointer-events-none absolute -inset-x-16 -inset-y-24 overflow-visible md:-inset-x-24"
      aria-hidden
    >
      {CONFETTI_PIECES.map((piece, i) => {
        const motionClass =
          piece.motion === "up"
            ? "scorecard-confetti-up bottom-0"
            : piece.motion === "side"
              ? "scorecard-confetti-side top-[42%]"
              : "scorecard-confetti-down top-0";

        return (
          <span
            key={i}
            className={`absolute ${motionClass} ${
              piece.round ? "rounded-full" : "rounded-sm"
            }`}
            style={
              {
                left: piece.left,
                top: piece.motion === "down" ? piece.top : undefined,
                width: piece.width,
                height: piece.height,
                backgroundColor: piece.color,
                animationDelay: piece.delay,
                animationDuration: piece.duration,
                "--drift": `${piece.drift}px`,
                "--wobble": `${piece.wobble}px`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

function CompleteCheckmark() {
  return (
    <div className="flex flex-col items-center gap-3 py-1">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 shadow-md shadow-green-500/25 ring-4 ring-green-100 md:h-[4.5rem] md:w-[4.5rem]"
        aria-hidden
      >
        <svg
          className="h-8 w-8 text-white md:h-9 md:w-9"
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
      <p className="text-base font-semibold text-green-700 md:text-lg">
        Complete
      </p>
    </div>
  );
}

export function ScorecardReportGenerating() {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const started = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = now - started;
      const t = Math.min(1, elapsed / DURATION_MS);
      setProgress(progressPercentForTime(t));
      setMessageIndex(messageIndexForProgress(t));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setProgress(100);
        setMessageIndex(GENERATING_MESSAGES.length - 1);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const isComplete = progress >= COMPLETE_PROGRESS_THRESHOLD;
  const barScale = Math.max(0, Math.min(1, progress / 100));

  return (
    <div className="relative overflow-visible">
      <ConfettiLayer />

      <div className="relative rounded-3xl bg-white p-7 shadow-xl ring-1 ring-slate-200 md:p-11 lg:p-14">
        <h2 className="text-center text-2xl font-semibold leading-snug text-slate-900 md:text-3xl">
          {GENERATING_TITLE}
        </h2>

        <div className="mt-10 space-y-4 md:mt-12">
          {isComplete ? (
            <CompleteCheckmark />
          ) : (
            <p
              key={messageIndex}
              className="min-h-[2.75rem] text-center text-lg font-medium leading-snug text-slate-700 transition-opacity duration-500 ease-in-out md:min-h-[3rem] md:text-xl"
            >
              {GENERATING_MESSAGES[messageIndex]}
            </p>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-wide">
              <span
                className={
                  isComplete ? "text-green-700" : "text-slate-500"
                }
              >
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
                  background: isComplete
                    ? PROGRESS_COMPLETE_FILL
                    : SCORECARD_PROGRESS_FILL,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const SCORECARD_REPORT_GENERATING_MS = DURATION_MS;
