"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { BookOpen, X } from "lucide-react";
import { ASSESSMENT_QUESTIONS } from "@/lib/assessmentQuestions";
import { getPlaybookMeta } from "@/lib/bossData";
import type { AnswersMap } from "@/lib/bossScores";
import { WorkshopScoreSheet } from "./WorkshopScoreSheet";

export { playbookActionNotesKey } from "@/lib/playbookSessionNotes";

export const BOSS_QUESTION_TOOLTIP_DELAY_MS = 800;

export type BossQuestionTooltipAnchor = {
  ref: string;
  rect: { left: number; top: number; bottom: number; width: number };
};

type AnchorViewRect = { left: number; top: number; bottom: number; width: number };

/** Keep popover on-screen; anchor top edge just under the cell (small gap), only shrink maxHeight — never slide the panel to the top of the viewport. */
function computePopoverPosition(
  rect: AnchorViewRect,
  vw: number,
  vh: number,
  panelW: number
): { left: number; top: number; maxHeight: number } {
  const margin = 12;
  const gap = 6;
  const capH = Math.min(vh * 0.85, 720);
  const left = Math.max(
    margin,
    Math.min(rect.left + rect.width / 2 - panelW / 2, vw - panelW - margin)
  );

  const topBelow = rect.bottom + gap;
  const maxHBelow = vh - margin - topBelow;
  const minComfort = 160;

  if (maxHBelow >= minComfort) {
    return {
      left,
      top: topBelow,
      maxHeight: Math.min(capH, maxHBelow),
    };
  }

  const maxHAbove = Math.min(capH, Math.max(minComfort, rect.top - margin - gap));
  let top = rect.top - gap - maxHAbove;
  if (top < margin) {
    const clipped = margin - top;
    top = margin;
    return {
      left,
      top,
      maxHeight: Math.max(120, maxHAbove - clipped),
    };
  }
  return { left, top, maxHeight: maxHAbove };
}

type UseBossQuestionTooltipOptions = {
  /** When true, hover does not open the small preview popover (workshop uses click-to-open sheet). */
  workshopSheetMode?: boolean;
};

export function useBossQuestionTooltip(
  delayMs: number = BOSS_QUESTION_TOOLTIP_DELAY_MS,
  options: UseBossQuestionTooltipOptions = {}
) {
  const { workshopSheetMode = false } = options;
  const [tooltip, setTooltip] = useState<BossQuestionTooltipAnchor | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipPinnedRef = useRef(false);
  const tooltipAnchorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      hideTimeoutRef.current = null;
      tooltipPinnedRef.current = false;
      tooltipAnchorRef.current = null;
      setTooltip(null);
      setTooltipVisible(false);
    }, 480);
  }, []);

  const dismissTooltip = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    tooltipPinnedRef.current = false;
    tooltipAnchorRef.current = null;
    cancelHide();
    setTooltip(null);
    setTooltipVisible(false);
  }, [cancelHide]);

  const openWorkshopSheet = useCallback(
    (ref: string) => {
      cancelHide();
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
        tooltipTimeoutRef.current = null;
      }
      tooltipPinnedRef.current = true;
      tooltipAnchorRef.current = null;
      setTooltip({
        ref,
        rect: { left: 0, top: 0, bottom: 0, width: 0 },
      });
      setTooltipVisible(true);
    },
    [cancelHide]
  );

  /** Opens the question panel immediately (legacy popover anchor). */
  const openTooltipPinned = useCallback(
    (ref: string, element: HTMLElement) => {
      if (workshopSheetMode) {
        openWorkshopSheet(ref);
        return;
      }
      cancelHide();
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
        tooltipTimeoutRef.current = null;
      }
      tooltipPinnedRef.current = true;
      tooltipAnchorRef.current = element;
      const rect = element.getBoundingClientRect();
      setTooltip({
        ref,
        rect: {
          left: rect.left,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
        },
      });
      setTooltipVisible(true);
      requestAnimationFrame(() => {
        element.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
    },
    [cancelHide, openWorkshopSheet, workshopSheetMode]
  );

  const handleCellHover = useCallback(
    (ref: string | null, element: HTMLElement | null) => {
      if (workshopSheetMode) {
        return;
      }
      cancelHide();
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
        tooltipTimeoutRef.current = null;
      }
      if (!ref || !element) {
        if (tooltipPinnedRef.current) {
          return;
        }
        scheduleHide();
        return;
      }
      tooltipPinnedRef.current = false;
      tooltipAnchorRef.current = element;
      const rect = element.getBoundingClientRect();
      setTooltip({
        ref,
        rect: {
          left: rect.left,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
        },
      });
      setTooltipVisible(false);
      tooltipTimeoutRef.current = setTimeout(() => {
        tooltipTimeoutRef.current = null;
        setTooltipVisible(true);
      }, delayMs);
    },
    [cancelHide, delayMs, scheduleHide, workshopSheetMode]
  );

  return {
    tooltip,
    tooltipVisible,
    handleCellHover,
    openTooltipPinned,
    openWorkshopSheet,
    dismissTooltip,
    cancelHide,
    scheduleHide,
    tooltipAnchorRef,
  };
}

const SCORE_OPTIONS: {
  value: 0 | 1 | 2;
  title: string;
  ring: string;
  dot: string;
}[] = [
  {
    value: 0,
    title: "Not in place",
    ring: "border-red-300 focus-within:ring-red-400/40",
    dot: "bg-red-500",
  },
  {
    value: 1,
    title: "Partially",
    ring: "border-amber-300 focus-within:ring-amber-400/40",
    dot: "bg-amber-500",
  },
  {
    value: 2,
    title: "Fully in place",
    ring: "border-emerald-300 focus-within:ring-emerald-400/40",
    dot: "bg-emerald-500",
  },
];

const HOLLOW_PLAYBOOK_LINK_CLASS =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border-2 border-slate-300 bg-transparent px-5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40";

type TooltipPanelProps = {
  tooltip: BossQuestionTooltipAnchor;
  question: (typeof ASSESSMENT_QUESTIONS)[number];
  onPickScore?: (ref: string, score: 0 | 1 | 2 | null) => void;
  onPortalMouseEnter?: () => void;
  onPortalMouseLeave?: () => void;
  answerScores?: AnswersMap;
  getPlaybookUrl?: (ref: string) => string | null;
  playbookNotes?: Record<string, string>;
  onPlaybookNotesChange?: (ref: string, notes: string) => void;
  onDismiss?: () => void;
  anchorRef?: RefObject<HTMLElement | null>;
};

function BossQuestionTooltipPanel({
  tooltip,
  question,
  onPickScore,
  onPortalMouseEnter,
  onPortalMouseLeave,
  answerScores,
  getPlaybookUrl,
  playbookNotes,
  onPlaybookNotesChange,
  onDismiss,
  anchorRef,
}: TooltipPanelProps) {
  const groupId = useId();
  const current = answerScores?.[tooltip.ref] as 0 | 1 | 2 | undefined;
  const [local, setLocal] = useState<0 | 1 | 2 | undefined>(current);
  const savedNotes = playbookNotes?.[tooltip.ref] ?? "";
  const [localNotes, setLocalNotes] = useState(savedNotes);

  useEffect(() => {
    setLocal(current);
  }, [current, tooltip.ref]);

  useEffect(() => {
    setLocalNotes(savedNotes);
  }, [savedNotes, tooltip.ref]);

  const playbookUrl = getPlaybookUrl?.(tooltip.ref) ?? null;
  const playbookMeta = getPlaybookMeta(tooltip.ref);
  const playbookTitle = playbookMeta?.name ?? tooltip.ref;
  const showScoreRadios = Boolean(onPickScore);
  const showNotes = Boolean(onPlaybookNotesChange);
  const showPlaybook = Boolean(playbookUrl);

  const [box, setBox] = useState<{
    left: number;
    top: number;
    maxHeight: number;
    width: number;
  }>(() => {
    if (typeof window === "undefined") {
      return { left: 16, top: 16, maxHeight: 560, width: 400 };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pw = Math.min(520, vw - 32);
    const p = computePopoverPosition(tooltip.rect, vw, vh, pw);
    return { ...p, width: pw };
  });

  useLayoutEffect(() => {
    function tick() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pw = Math.min(520, vw - 32);
      const el = anchorRef?.current;
      const r = el?.getBoundingClientRect();
      const rect: AnchorViewRect = r
        ? { left: r.left, top: r.top, bottom: r.bottom, width: r.width }
        : {
            left: tooltip.rect.left,
            top: tooltip.rect.top,
            bottom: tooltip.rect.bottom,
            width: tooltip.rect.width,
          };
      const p = computePopoverPosition(rect, vw, vh, pw);
      setBox({ ...p, width: pw });
    }
    tick();
    const scrollOpts = { capture: true } as const;
    window.addEventListener("scroll", tick, scrollOpts);
    window.addEventListener("resize", tick);
    return () => {
      window.removeEventListener("scroll", tick, scrollOpts);
      window.removeEventListener("resize", tick);
    };
  }, [tooltip.ref, anchorRef]);

  const pickScore = (score: 0 | 1 | 2) => {
    setLocal(score);
    onPickScore?.(tooltip.ref, score);
  };

  return (
    <div
      className="fixed z-[500] origin-top rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl ring-1 ring-slate-900/5 transition-transform duration-200 ease-out hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.18)]"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        maxHeight: box.maxHeight,
        overflowY: "auto",
        overscrollBehavior: "contain",
      }}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${groupId}-playbook`}
      aria-describedby={`${groupId}-question`}
      onMouseEnter={onPortalMouseEnter}
      onMouseLeave={onPortalMouseLeave}
    >
      <p
        id={`${groupId}-playbook`}
        className="mb-2 text-base font-bold tracking-tight text-slate-900"
      >
        {playbookTitle}
      </p>
      {showPlaybook ? (
        /^https?:\/\//i.test(playbookUrl!) ? (
          <a
            href={playbookUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className={`${HOLLOW_PLAYBOOK_LINK_CLASS} mb-4 w-full sm:w-auto`}
            onClick={() => onDismiss?.()}
          >
            <BookOpen className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Open playbook
          </a>
        ) : (
          <Link
            href={playbookUrl!}
            className={`${HOLLOW_PLAYBOOK_LINK_CLASS} mb-4 w-full sm:w-auto`}
            onClick={() => onDismiss?.()}
          >
            <BookOpen className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Open playbook
          </Link>
        )
      ) : null}
      <p
        id={`${groupId}-question`}
        className="mb-4 text-lg font-semibold leading-snug tracking-tight text-slate-900"
      >
        {question.question}
      </p>

      {showScoreRadios ? (
        <fieldset className="mb-5 border-0 p-0">
          <legend className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
            Your score
          </legend>
          <div className="flex flex-col gap-3">
            {SCORE_OPTIONS.map((opt) => {
              const checked = local === opt.value;
              const guide =
                opt.value === 0
                  ? question.scoringGuide.red
                  : opt.value === 1
                    ? question.scoringGuide.amber
                    : question.scoringGuide.green;
              return (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-4 rounded-xl border-2 bg-white p-4 transition hover:bg-slate-50/80 ${opt.ring} ${
                    checked ? "border-sky-500 ring-2 ring-sky-400/30" : "border-slate-200"
                  }`}
                >
                  <input
                    type="radio"
                    className="mt-1 h-5 w-5 shrink-0 border-slate-300 text-sky-600 focus:ring-sky-500"
                    name={`boss-score-${groupId}`}
                    checked={checked}
                    onChange={() => pickScore(opt.value)}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-center gap-2 text-base font-semibold text-slate-900">
                      <span
                        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${opt.dot}`}
                        aria-hidden
                      />
                      {opt.title}
                    </span>
                    <span className="text-sm leading-snug text-slate-600">{guide}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {showNotes ? (
        <div className={showScoreRadios ? "mt-4 border-t border-slate-200 pt-4" : ""}>
          <label className="flex flex-col gap-1.5" htmlFor={`${groupId}-notes`}>
            <span className="text-sm font-semibold text-slate-700">Session notes</span>
            <span className="text-xs text-slate-500">Saved automatically for this client.</span>
            <textarea
              id={`${groupId}-notes`}
              className="min-h-[88px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-snug text-slate-900 outline-none ring-sky-500 focus:border-sky-300 focus:ring-2"
              value={localNotes}
              onChange={(e) => {
                const next = e.target.value;
                setLocalNotes(next);
                onPlaybookNotesChange?.(tooltip.ref, next);
              }}
              placeholder="What did you discuss for this playbook?"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

export function BossQuestionTooltipPortal({
  tooltip,
  tooltipVisible,
  onPickScore,
  onPortalMouseEnter,
  onPortalMouseLeave,
  answerScores,
  getPlaybookUrl,
  playbookNotes,
  onPlaybookNotesChange,
  onDismiss,
  anchorRef,
  coachName,
  clientName,
  allowClientComments,
}: {
  tooltip: BossQuestionTooltipAnchor | null;
  tooltipVisible: boolean;
  onPickScore?: (ref: string, score: 0 | 1 | 2 | null) => void;
  onPortalMouseEnter?: () => void;
  onPortalMouseLeave?: () => void;
  answerScores?: AnswersMap;
  getPlaybookUrl?: (ref: string) => string | null;
  playbookNotes?: Record<string, string>;
  onPlaybookNotesChange?: (ref: string, notes: string) => void;
  onDismiss?: () => void;
  anchorRef?: RefObject<HTMLElement | null>;
  coachName?: string;
  clientName?: string;
  allowClientComments?: boolean;
}) {
  const question =
    tooltip && tooltipVisible
      ? ASSESSMENT_QUESTIONS.find((q) => q.ref === tooltip.ref)
      : null;

  if (
    typeof document === "undefined" ||
    !question ||
    !tooltip ||
    !tooltipVisible
  ) {
    return null;
  }

  if (onPickScore) {
    return createPortal(
      <WorkshopScoreSheet
        tooltip={tooltip}
        question={question}
        onPickScore={onPickScore}
        answerScores={answerScores}
        getPlaybookUrl={getPlaybookUrl}
        playbookNotes={playbookNotes}
        onPlaybookNotesChange={onPlaybookNotesChange}
        onDismiss={onDismiss}
        coachName={coachName}
        clientName={clientName}
        allowClientComments={allowClientComments}
      />,
      document.body
    );
  }

  return createPortal(
    <BossQuestionTooltipPanel
      tooltip={tooltip}
      question={question}
      onPickScore={onPickScore}
      onPortalMouseEnter={onPortalMouseEnter}
      onPortalMouseLeave={onPortalMouseLeave}
      answerScores={answerScores}
      getPlaybookUrl={getPlaybookUrl}
      playbookNotes={playbookNotes}
      onPlaybookNotesChange={onPlaybookNotesChange}
      onDismiss={onDismiss}
      anchorRef={anchorRef}
    />,
    document.body
  );
}
