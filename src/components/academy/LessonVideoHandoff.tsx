"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ListTodo } from "lucide-react";

/** Soft auto-advance only when the lesson has no recommended actions. */
export const LESSON_HANDOFF_AUTO_ADVANCE_SECONDS = 5;

type Props = {
  nextLessonTitle: string | null;
  nextLessonHref: string | null;
  actionCount: number;
  myActionsHref: string;
  onStay: () => void;
  onContinue: () => void;
};

/**
 * End-of-video handoff: acknowledge completion, surface actions, offer next lesson.
 * Auto-advances only when there are no recommended actions and a next lesson exists.
 */
export function LessonVideoHandoff({
  nextLessonTitle,
  nextLessonHref,
  actionCount,
  myActionsHref,
  onStay,
  onContinue,
}: Props) {
  const canAutoAdvance = actionCount === 0 && Boolean(nextLessonHref);
  const [secondsLeft, setSecondsLeft] = useState(LESSON_HANDOFF_AUTO_ADVANCE_SECONDS);
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;

  useEffect(() => {
    if (!canAutoAdvance) return;
    setSecondsLeft(LESSON_HANDOFF_AUTO_ADVANCE_SECONDS);
    const tick = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(tick);
          onContinueRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [canAutoAdvance]);

  const hasNext = Boolean(nextLessonHref && nextLessonTitle);

  return (
    <div
      className="absolute inset-0 z-[5] flex items-center justify-center bg-black/55 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-handoff-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[var(--brand-chathams)]/85 p-5 text-center shadow-xl sm:p-6">
        <p
          id="lesson-handoff-title"
          className="text-xl font-semibold tracking-tight text-white sm:text-2xl"
        >
          Lesson complete
        </p>

        {hasNext ? (
          <p className="mt-2 text-sm text-white/85 sm:text-base">
            Up next:{" "}
            <span className="font-medium text-white">{nextLessonTitle}</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-white/85 sm:text-base">
            You&apos;ve finished this course — nice work.
          </p>
        )}

        {actionCount > 0 ? (
          <p className="mt-3 text-sm text-white/80">
            {actionCount} action{actionCount === 1 ? "" : "s"} from this lesson
            {" · "}
            <Link
              href={myActionsHref}
              className="inline-flex items-center gap-1 font-medium text-white underline-offset-2 hover:underline"
            >
              <ListTodo className="h-3.5 w-3.5" aria-hidden />
              My Actions
            </Link>
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2.5">
          {hasNext ? (
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 bg-white px-5 py-2.5 text-sm font-medium text-[var(--brand-chathams)] transition hover:bg-white/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {actionCount > 0 ? "Continue anyway" : "Continue"}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          ) : null}

          <button
            type="button"
            onClick={onStay}
            className="inline-flex items-center justify-center rounded-full border border-white/35 px-5 py-2 text-sm font-medium text-white transition hover:border-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Stay on this lesson
          </button>
        </div>

        {canAutoAdvance ? (
          <p className="mt-3 text-xs text-white/65 tabular-nums">
            Continuing in {secondsLeft}s…
          </p>
        ) : null}
      </div>
    </div>
  );
}
