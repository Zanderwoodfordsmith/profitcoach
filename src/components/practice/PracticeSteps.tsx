"use client";

import Link from "next/link";
import { Check } from "lucide-react";

import {
  PAM_DECISION_CALL_PATH,
  PRACTICE_STEPS,
  practiceStepStates,
  type PracticeStepId,
  type PracticeStepState,
} from "@/lib/practiceKnowledge/intakeCall";

import { useSectionComments } from "./comments/SectionCommentsContext";
import { usePractice } from "./PracticeProvider";

/**
 * The three stages, under the cover: talk to Ava, the Blueprint Call, then
 * BCA builds the practice. A tick means that stage is finished.
 */
export function PracticeSteps({ vertical = false }: { vertical?: boolean }) {
  const { knowledge, payload, decision, href, openAvaCall, coachJoinedAt } = usePractice();
  const comments = useSectionComments();
  if (!knowledge) return null;

  const states = practiceStepStates({
    interviewCompletedAt: knowledge.interview_completed_at,
    decisionLockedAt: decision?.locked_at,
    callAt: payload?.review.decision_call_booked_at?.value,
    joinedAt: coachJoinedAt,
    builtSections: knowledge.built_sections,
  });
  const pamBooked = Boolean(payload?.review.decision_call_booked_at?.value);

  function onAva() {
    comments?.close();
    openAvaCall();
  }

  return (
    <nav aria-label="Where you are" className={vertical ? "bp-no-print" : "bp-no-print px-2"}>
      <ol className={vertical ? "flex flex-col gap-3" : "grid grid-cols-3"}>
        {PRACTICE_STEPS.map((step, index) => {
          const state = states[step.id];
          const note = stepNote(step.id, state, pamBooked);
          return (
            <li key={step.id} className={vertical ? "relative flex" : "relative flex flex-col items-center"}>
              {index < PRACTICE_STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className={`absolute ${
                    vertical ? "top-8 left-4 h-[calc(100%-1.25rem)] w-0.5 -translate-x-1/2" : "top-4 left-1/2 h-0.5 w-full -translate-y-1/2"
                  } ${state === "done" ? "bg-[#1ec4b6]" : "bg-[var(--bp-rule)]"}`}
                />
              ) : null}
              <StepControl id={step.id} state={state} label={step.label} note={note} href={href} onAva={onAva} vertical={vertical} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function stepNote(id: PracticeStepId, state: PracticeStepState, pamBooked: boolean): string | null {
  if (state === "done") return null;
  if (id === "pam" && pamBooked) return "Booked";
  // Not "Upcoming": nothing is booked yet, so the step says nothing.
  if (state === "waiting") return null;
  return "Now";
}

function StepControl({
  id,
  state,
  label,
  note,
  href,
  onAva,
  vertical,
}: {
  vertical: boolean;
  id: PracticeStepId;
  state: PracticeStepState;
  label: string;
  note: string | null;
  href: (path: string) => string;
  onAva: () => void;
}) {
  const name = [label, note?.toLowerCase()].filter(Boolean).join(", ");
  const text = (
    <>
      <span
        className={`${vertical ? "" : "mt-2.5 "}block text-ui leading-snug ${
          state === "waiting" ? "font-medium text-[var(--bp-faint)]" : "font-semibold text-[var(--bp-ink)]"
        }`}
      >
        {label}
      </span>
      {note ? (
        <span className={`mt-0.5 block text-caption font-medium ${state === "waiting" ? "text-[var(--bp-faint)]" : "text-[#1a8fd4]"}`}>
          {note}
        </span>
      ) : (
        <span className="mt-0.5 block text-caption font-medium text-[#1ec4b6]">Done</span>
      )}
    </>
  );
  const mark = <StepMark state={state} index={PRACTICE_STEPS.findIndex((step) => step.id === id)} />;
  // Side by side in the vertical list (the Overview's side card), stacked under the mark in the row.
  const body = vertical ? (
    <>
      <span className="shrink-0">{mark}</span>
      <span className="min-w-0">{text}</span>
    </>
  ) : (
    <>
      {mark}
      {text}
    </>
  );
  const className = vertical
    ? "relative z-10 flex w-full items-center gap-3 text-left"
    : "relative z-10 flex w-full flex-col items-center px-1 text-center";

  if (state === "waiting") {
    return (
      <span className={className} aria-label={name}>
        {body}
      </span>
    );
  }

  if (id === "ava") {
    return (
      <button type="button" onClick={onAva} aria-current={state === "current" ? "step" : undefined} aria-label={name} className={className}>
        {body}
      </button>
    );
  }

  const to =
    id === "pam"
      ? state === "done"
        ? href("/coach/blueprint/market#s-market-options")
        : PAM_DECISION_CALL_PATH
      : href("/coach/blueprint/campaigns");

  return (
    <Link href={to} aria-current={state === "current" ? "step" : undefined} aria-label={name} className={className}>
      {body}
    </Link>
  );
}

function StepMark({ state, index }: { state: PracticeStepState; index: number }) {
  const shared = "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold";
  if (state === "done") {
    return (
      <span className={`${shared} bg-[#1ec4b6] text-white`}>
        <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </span>
    );
  }
  if (state === "current") {
    return <span className={`${shared} bg-[#1a8fd4] text-white`}>{index + 1}</span>;
  }
  return <span className={`${shared} bg-white text-[var(--bp-faint)] ring-1 ring-[var(--bp-rule)]`}>{index + 1}</span>;
}
