"use client";

import { Fragment, useState } from "react";

import { SectionInfoTip } from "@/components/settings/IntegrationsSettingsTab";
import {
  BUILD_STATUS_LABEL,
  JOURNEY_LANES,
  JOURNEY_MOMENTS,
  JOURNEY_PHASES,
  type BuildStatus,
  type JourneyMoment,
} from "@/lib/activation/coachJourney";

export const STATUS_DOT: Record<BuildStatus, string> = {
  live: "bg-emerald-500",
  partly: "bg-amber-400",
  build: "bg-slate-300 ring-1 ring-inset ring-slate-400",
};

function StatusDot({ status }: { status: BuildStatus }) {
  return (
    <span className={`mt-[6px] h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status]}`} title={BUILD_STATUS_LABEL[status]}>
      <span className="sr-only">{BUILD_STATUS_LABEL[status]}</span>
    </span>
  );
}

const KIND_NOTE: Record<JourneyMoment["kind"], string | null> = {
  event: null,
  check: "if it hasn't happened",
  rhythm: "repeats",
};

/**
 * The journey table (28 Nov, Zander: "flip this vertically", "less columns"): one row per moment,
 * one column per lane. Phases fold. The header row sticks under the page
 * header on wide screens; a row opens in place to show the message wording,
 * channels and why.
 */
export function JourneyTable({ closed, onTogglePhase }: { closed: Set<string>; onTogglePhase: (id: string) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const cols = "grid-cols-[minmax(220px,1.1fr)_minmax(160px,0.75fr)_repeat(4,minmax(190px,1fr))]";
  return (
    <div className="rounded-lg border border-slate-200 bg-white max-lg:overflow-x-auto">
      <div className="min-w-[1200px]">
        <div
          className={`grid ${cols} z-20 border-b border-slate-200 bg-white text-sm font-semibold text-slate-900 lg:sticky lg:top-[var(--journey-top,0px)] lg:rounded-t-lg`}
        >
          <div className="px-3 py-2.5">Moment</div>
          <div className="flex items-center gap-1 px-3 py-2.5">
            Feeling
            <SectionInfoTip label="Feeling" text="How we want the coach to feel at this moment, in their words." />
          </div>
          {JOURNEY_LANES.map((lane) => (
            <div key={lane.id} className="flex items-center gap-1 px-3 py-2.5">
              {lane.label}
              <SectionInfoTip label={lane.label} text={lane.hint} />
            </div>
          ))}
        </div>

        {JOURNEY_PHASES.map((phase) => {
          const moments = JOURNEY_MOMENTS.filter((m) => m.phase === phase.id);
          if (!moments.length) return null;
          const isClosed = closed.has(phase.id);
          return (
            <section key={phase.id} id={`journey-phase-${phase.id}`} className="scroll-mt-[calc(var(--journey-top,0px)+3.5rem)]">
              <button
                type="button"
                onClick={() => onTogglePhase(phase.id)}
                aria-expanded={!isClosed}
                className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100"
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  {phase.name}
                  <Chevron open={!isClosed} />
                </span>
                <span className="text-xs font-medium text-slate-600">{phase.when}</span>
                <span className="text-xs text-slate-500">{phase.goal}</span>
                {isClosed ? (
                  <span className="ml-auto text-xs text-slate-500">
                    {moments.length} {moments.length === 1 ? "moment" : "moments"}
                  </span>
                ) : null}
              </button>
              {isClosed
                ? null
                : moments.map((m) => {
                    const open = openId === m.id;
                    const note = KIND_NOTE[m.kind];
                    const details = JOURNEY_LANES.filter((lane) => m.lanes[lane.id]?.message);
                    return (
                      <Fragment key={m.id}>
                        <button
                          type="button"
                          onClick={() => setOpenId(open ? null : m.id)}
                          aria-expanded={open}
                          className={`grid w-full ${cols} border-b border-slate-100 text-left hover:bg-sky-50/60 ${
                            open ? "bg-sky-50/60" : m.kind === "check" ? "bg-amber-50/50" : ""
                          }`}
                        >
                          <div className="flex flex-col gap-0.5 px-3 py-3">
                            <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                              {m.title}
                              <Chevron open={open} />
                            </span>
                            <span className="text-sm text-slate-600">{m.trigger}</span>
                            <span className="text-sm">
                              <span className="font-medium text-sky-700">{m.target}</span>
                              {note ? (
                                <span className={m.kind === "check" ? "text-amber-800" : "text-slate-500"}> · {note}</span>
                              ) : null}
                            </span>
                          </div>
                          <div className="px-3 py-3 text-sm italic leading-snug text-slate-600">&ldquo;{m.feel}&rdquo;</div>
                          {JOURNEY_LANES.map((lane) => {
                            const step = m.lanes[lane.id];
                            return (
                              <div key={lane.id} className="px-3 py-3">
                                {step ? (
                                  <span className="flex items-start gap-2">
                                    <StatusDot status={step.status} />
                                    <span className="text-sm leading-snug text-slate-700">
                                      {step.text}
                                      {lane.id === "ava" && step.channel ? (
                                        <span className="mt-1 block text-xs text-slate-500">{step.channel}</span>
                                      ) : null}
                                    </span>
                                  </span>
                                ) : null}
                              </div>
                            );
                          })}
                        </button>
                        {open ? (
                          <div
                            className={`grid gap-5 border-b border-slate-200 bg-slate-50/70 px-4 py-4 ${
                              details.length && m.why ? "md:grid-cols-2" : ""
                            }`}
                          >
                            {details.length ? (
                              <div className="flex flex-col gap-3">
                                {details.map((lane) => {
                                  const step = m.lanes[lane.id]!;
                                  return (
                                    <div key={lane.id}>
                                      <p className="text-xs font-semibold text-slate-900">
                                        {lane.label}
                                        {step.channel ? <span className="font-normal text-slate-500"> · {step.channel}</span> : null}
                                      </p>
                                      <blockquote className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-800">
                                        {step.message}
                                      </blockquote>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                            {m.why ? (
                              <div>
                                <p className="text-xs font-semibold text-slate-900">Why</p>
                                <p className="mt-1 max-w-prose text-sm leading-relaxed text-slate-700">{m.why}</p>
                              </div>
                            ) : null}
                            {!details.length && !m.why ? (
                              <p className="text-sm text-slate-500">No message wording or notes for this moment yet.</p>
                            ) : null}
                          </div>
                        ) : null}
                      </Fragment>
                    );
                  })}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>
      <path d="M7 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

