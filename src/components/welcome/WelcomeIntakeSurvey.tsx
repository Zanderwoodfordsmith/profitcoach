"use client";

import { useState, type ReactNode } from "react";

import {
  PROGRAMME_INTAKE_GOALS,
  PROGRAMME_INTAKE_SITUATIONS,
  PROGRAMME_INTAKE_TIME_COMMITMENTS,
  type ProgrammeIntakeGoal,
  type ProgrammeIntakeSituation,
  type ProgrammeIntakeTimeCommitment,
} from "@/config/programmeIntake";
import type { RoleIcon } from "@/lib/booking/bookCallQualify";

type StepId = "situation" | "goal" | "time" | "linkedin";

const STEPS: { id: StepId; title: string; subtitle: string }[] = [
  {
    id: "situation",
    title: "Which best describes you?",
    subtitle: "Pick the closest fit.",
  },
  {
    id: "goal",
    title: "What matters most to you?",
    subtitle: "Select as many as you like.",
  },
  {
    id: "time",
    title: "How much time can you realistically commit per week?",
    subtitle: "Be honest — this helps us set expectations.",
  },
  {
    id: "linkedin",
    title: "What’s your LinkedIn URL?",
    subtitle: "Optional — helps us prepare for your call.",
  },
];

function RoleGlyph({ name }: { name: RoleIcon }) {
  const c = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    width: 22,
    height: 22,
  };

  const paths: Record<RoleIcon, ReactNode> = {
    consultant: (
      <>
        <rect x="6" y="7" width="12" height="14" rx="1.5" />
        <path d="M9 7V5.5A3 3 0 0 1 15 5.5V7" />
        <path d="M6 12h12" />
      </>
    ),
    owner: (
      <>
        <path d="M3 21h18" />
        <path d="M5 21V10l7-5 7 5v11" />
        <path d="M10 21v-5h4v5" />
      </>
    ),
    coach: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      </>
    ),
    director: (
      <>
        <path d="M12 3 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-3Z" />
        <path d="M9 12h6" />
        <path d="M12 9v6" />
      </>
    ),
    other: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5c.6-1.2 2.2-1.8 3.5-1.2 1 .5 1.5 1.6 1.2 2.6-.3.9-1.2 1.4-1.7 2-.4.5-.5 1-.5 1.6" />
        <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
      </>
    ),
  };

  return <svg {...c}>{paths[name]}</svg>;
}

function GoalGlyph({
  name,
}: {
  name: (typeof PROGRAMME_INTAKE_GOALS)[number]["icon"];
}) {
  const c = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    width: 22,
    height: 22,
  };

  switch (name) {
    case "income":
      return (
        <svg {...c}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10" />
          <path d="M9.5 9.5c.6-1 1.6-1.5 2.5-1.5 1.4 0 2.5.9 2.5 2s-1.1 2-2.5 2h-1c-1.4 0-2.5.9-2.5 2s1.1 2 2.5 2c.9 0 1.9-.5 2.5-1.5" />
        </svg>
      );
    case "flexibility":
      return (
        <svg {...c}>
          <path d="M4 12c2-4 4-6 8-6s6 2 8 6c-2 4-4 6-8 6s-6-2-8-6Z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case "autonomy":
      return (
        <svg {...c}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M6 19c1.2-3.2 3.5-5 6-5s4.8 1.8 6 5" />
          <path d="M16.5 5.5 19 3M19 3v3.2M19 3h-3.2" />
        </svg>
      );
    case "balance":
      return (
        <svg {...c}>
          <path d="M12 4v16" />
          <path d="M5 10h14" />
          <path d="M5 10 8.5 16H5.5" />
          <path d="M19 10 15.5 16h3" />
        </svg>
      );
    case "impact":
      return (
        <svg {...c}>
          <path d="M12 3v6" />
          <path d="M12 15v6" />
          <path d="M3 12h6" />
          <path d="M15 12h6" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "pleasure":
      return (
        <svg {...c}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 14.5c1.2 1.4 2.7 2 3.5 2s2.3-.6 3.5-2" />
          <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return null;
  }
}

function TimeGlyph() {
  const c = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    width: 22,
    height: 22,
  };

  return (
    <svg {...c}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 1.8" />
    </svg>
  );
}

const pictureBtn =
  "flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-3 text-slate-800 transition hover:border-[#42a1ee]/50 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#42a1ee]/30";
const pictureBtnOn =
  "border-[#42a1ee] bg-[#e8f4fc] text-[#0c5290] shadow-[0_0_0_3px_rgba(66,161,238,0.28)]";
const pictureIcon =
  "inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-white text-[#0c5290] shadow-sm ring-1 ring-slate-200/80";
const pictureIconOn = "bg-[#42a1ee] text-white ring-[#42a1ee]";

function SelectedCheck() {
  return (
    <span
      className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#42a1ee] text-white shadow-sm"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none">
        <path
          d="M6 12.5 10 16.5 18 8"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

type Props = {
  situation: ProgrammeIntakeSituation | "";
  goals: ProgrammeIntakeGoal[];
  timeCommitment: ProgrammeIntakeTimeCommitment | "";
  linkedinUrl: string;
  busy: boolean;
  onSituation: (value: ProgrammeIntakeSituation) => void;
  onToggleGoal: (value: ProgrammeIntakeGoal) => void;
  onTimeCommitment: (value: ProgrammeIntakeTimeCommitment) => void;
  onLinkedinUrl: (value: string) => void;
  onComplete: () => void;
  onSkip: () => void;
};

export function WelcomeIntakeSurvey({
  situation,
  goals,
  timeCommitment,
  linkedinUrl,
  busy,
  onSituation,
  onToggleGoal,
  onTimeCommitment,
  onLinkedinUrl,
  onComplete,
  onSkip,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex]!;
  const isLast = stepIndex === STEPS.length - 1;

  function goNext() {
    if (step.id === "goal" && goals.length === 0) return;
    if (isLast) {
      onComplete();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function selectAndAdvance(action: () => void) {
    action();
    window.setTimeout(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, 180);
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s.id}
              className={`h-1.5 w-7 rounded-full ${
                i <= stepIndex ? "bg-[#0c5290]" : "bg-slate-200"
              }`}
            />
          ))}
        </div>
        <p className="text-xs font-medium text-slate-500">
          Question {stepIndex + 1} of {STEPS.length}
        </p>
      </div>

      <div className="text-center">
        <h3 className="text-base font-semibold text-slate-900 sm:text-lg">
          {step.title}
        </h3>
        <p className="mt-1 text-sm text-slate-600">{step.subtitle}</p>
      </div>

      {step.id === "situation" ? (
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-5"
          role="radiogroup"
          aria-label={step.title}
        >
          {PROGRAMME_INTAKE_SITUATIONS.map((option) => {
            const selected = situation === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={busy}
                onClick={() =>
                  selectAndAdvance(() => onSituation(option.value))
                }
                className={`relative ${pictureBtn} ${selected ? pictureBtnOn : ""}`}
              >
                {selected ? <SelectedCheck /> : null}
                <span
                  className={`${pictureIcon} ${selected ? pictureIconOn : ""}`}
                >
                  <RoleGlyph name={option.icon} />
                </span>
                <span className="text-center text-[12.5px] font-semibold leading-tight tracking-[-0.01em]">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {step.id === "goal" ? (
        <div className="space-y-4">
          <div
            className="grid grid-cols-3 gap-2 sm:grid-cols-6"
            role="group"
            aria-label={step.title}
          >
            {PROGRAMME_INTAKE_GOALS.map((option) => {
              const selected = goals.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  disabled={busy}
                  onClick={() => onToggleGoal(option.value)}
                  className={`relative ${pictureBtn} ${selected ? pictureBtnOn : ""}`}
                >
                  {selected ? <SelectedCheck /> : null}
                  <span
                    className={`${pictureIcon} ${selected ? pictureIconOn : ""}`}
                  >
                    <GoalGlyph name={option.icon} />
                  </span>
                  <span className="text-center text-[12.5px] font-semibold leading-tight tracking-[-0.01em]">
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={busy || goals.length === 0}
            onClick={goNext}
            className="inline-flex w-full items-center justify-center rounded-full bg-[#0c5290] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0a4274] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      ) : null}

      {step.id === "time" ? (
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-5"
          role="radiogroup"
          aria-label={step.title}
        >
          {PROGRAMME_INTAKE_TIME_COMMITMENTS.map((option) => {
            const selected = timeCommitment === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={busy}
                onClick={() =>
                  selectAndAdvance(() => onTimeCommitment(option.value))
                }
                className={`relative ${pictureBtn} ${selected ? pictureBtnOn : ""}`}
              >
                {selected ? <SelectedCheck /> : null}
                <span
                  className={`${pictureIcon} ${selected ? pictureIconOn : ""}`}
                >
                  <TimeGlyph />
                </span>
                <span className="text-center text-[12.5px] font-semibold leading-tight tracking-[-0.01em]">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {step.id === "linkedin" ? (
        <div className="mx-auto w-full max-w-md space-y-3">
          <input
            type="url"
            value={linkedinUrl}
            onChange={(e) => onLinkedinUrl(e.target.value)}
            className="block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0c5290] focus:ring-2 focus:ring-[#42a1ee]/25"
            placeholder="https://www.linkedin.com/in/…"
            disabled={busy}
          />
          <button
            type="button"
            disabled={busy}
            onClick={goNext}
            className="inline-flex w-full items-center justify-center rounded-full bg-[#0c5290] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0a4274] disabled:opacity-50"
          >
            {busy ? "Saving…" : "Finish intake"}
          </button>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={goBack}
          disabled={busy || stepIndex === 0}
          className="text-sm font-medium text-slate-500 transition hover:text-slate-700 disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
