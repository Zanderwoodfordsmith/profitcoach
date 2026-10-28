"use client";

import { useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";

import {
  COACH_LEVERS,
  TODAY,
  WITH_SCRIPTS,
  formatCount,
  formatRate,
  funnelOf,
  messagesPerClient,
  type CoachLeverDef,
  type CoachLeverKey,
  type CoachLevers as Levers,
} from "@/lib/coachLevers";
import { NumberField } from "@/components/profitLevers/ProfitLevers";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";

import "@/components/profitLevers/profitLevers.css";

const SMALL = "text-sm leading-[1.5]";
const NAVY = "text-[#0c5290]";
/** The funnel on the right counts what this many messages turn into. */
const MESSAGES = 1000;

function moved(a: number, b: number): boolean {
  return Math.abs(a - b) > 1e-9;
}

/**
 * Profit levers for a coach: four rates from message to client. The left
 * column takes the coach's numbers (today's working numbers to start) and a
 * dot to drag on each; the right shows what 1,000 messages turn into. Nothing
 * is saved.
 */
export function CoachLevers() {
  const [now, setNow] = useState<Levers>(TODAY);
  const [ours, setOurs] = useState<Levers>(TODAY);

  const setNowLever = (key: CoachLeverKey, value: number) => {
    setOurs((o) => (moved(o[key], now[key]) ? o : { ...o, [key]: value }));
    setNow((n) => ({ ...n, [key]: value }));
  };
  const setOursLever = (key: CoachLeverKey, value: number) => setOurs((o) => ({ ...o, [key]: value }));

  const before = messagesPerClient(now);
  const after = messagesPerClient(ours);
  const changed = COACH_LEVERS.some(({ key }) => moved(now[key], ours[key]));
  const times = before && after ? before / after : null;

  return (
    <div className="mx-auto w-full max-w-[76rem] space-y-6 pb-16 pt-2">
      <section className={cardClass("plain", "px-6 py-5 md:px-8 md:py-6")}>
        <p className={`${SMALL} text-slate-500`}>Messages for one client</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <div>
            <p className="text-display font-semibold leading-tight text-slate-900">
              {changed ? (
                <span className={NAVY}>{after ? formatCount(after) : "No clients"}</span>
              ) : before ? (
                formatCount(before)
              ) : (
                "No clients"
              )}
              {(changed ? after : before) ? " messages" : null}
            </p>
            <p className={`mt-1 text-slate-600 ${SMALL}`}>
              {changed && before ? (
                <>
                  Was {formatCount(before)}
                  {times && times > 1 ? (
                    <>
                      , so <span className={`font-semibold ${NAVY}`}>{formatCount(times)}x</span> the clients from the same messages
                    </>
                  ) : null}
                  .{" "}
                </>
              ) : null}
              It&apos;s what&apos;s possible on paper, not a forecast.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill onClick={() => setOurs(WITH_SCRIPTS)}>With the new scripts</Pill>
            {changed ? (
              <Pill onClick={() => setOurs(now)} quiet>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Back to now
              </Pill>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section className={cardClass("plain", "min-w-0")} aria-label="Your numbers">
          <div className={`grid grid-cols-[minmax(0,1fr)_7.5rem] items-end gap-x-4 border-b border-slate-100 px-6 pb-2 pt-4 text-slate-500 md:grid-cols-[minmax(0,1.1fr)_7.5rem_minmax(0,1fr)_5.5rem] ${SMALL}`}>
            <span>Your numbers</span>
            <span>Now</span>
            <span className="hidden md:block">Drag to try</span>
            <span className="hidden text-right md:block">Could be</span>
          </div>
          <ul>
            {COACH_LEVERS.map((lever) => (
              <LeverRow
                key={lever.key}
                lever={lever}
                now={now[lever.key]}
                ours={ours[lever.key]}
                onNow={(v) => setNowLever(lever.key, v)}
                onOurs={(v) => setOursLever(lever.key, v)}
              />
            ))}
          </ul>
        </section>

        <Funnel now={now} ours={ours} />
      </div>
    </div>
  );
}

function Pill({ children, onClick, quiet }: { children: ReactNode; onClick: () => void; quiet?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={buttonClass(quiet ? "second" : "main")}>
      {children}
    </button>
  );
}

/** Rates are typed as percents (50 for 50%). */
function LeverRow({
  lever,
  now,
  ours,
  onNow,
  onOurs,
}: {
  lever: CoachLeverDef;
  now: number;
  ours: number;
  onNow: (value: number) => void;
  onOurs: (value: number) => void;
}) {
  const isMoved = moved(now, ours);
  const along = (at: number) => Math.min(Math.max(at / lever.max, 0), 1);
  const across = (share: number) => `calc(8px + (100% - 16px) * ${share.toFixed(4)})`;
  const from = along(now);
  const to = along(ours);
  const ratio = now > 0 ? ours / now : null;

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-x-4 gap-y-2 border-b border-slate-100 px-6 py-3.5 last:border-b-0 md:grid-cols-[minmax(0,1.1fr)_7.5rem_minmax(0,1fr)_5.5rem]">
      <div className="min-w-0">
        <label htmlFor={`cl-${lever.key}`} className="block font-medium text-slate-900">
          {lever.label}
        </label>
        <p className={`text-slate-500 ${SMALL}`}>{lever.ask}</p>
      </div>
      <NumberField id={`cl-${lever.key}`} value={now * 100} suffix="%" max={100} onChange={(v) => onNow(v / 100)} />
      <span className="pl-bar col-span-2 md:col-span-1">
        {isMoved ? (
          <>
            <span
              className="pl-bar__gap"
              style={{ left: across(Math.min(from, to)), width: `calc((100% - 16px) * ${Math.abs(to - from).toFixed(4)})` }}
              aria-hidden="true"
            />
            <span className="pl-bar__from" style={{ left: across(from) }} aria-hidden="true" />
          </>
        ) : null}
        <input
          type="range"
          className={isMoved ? "is-moved" : undefined}
          min={0}
          max={lever.max}
          step={lever.step}
          value={Math.min(ours, lever.max)}
          onChange={(event) => onOurs(Number(event.target.value))}
          aria-label={`${lever.label}: try another value`}
          aria-valuetext={formatRate(ours)}
        />
      </span>
      <p className={`col-span-2 text-right tabular-nums md:col-span-1 ${SMALL}`}>
        <span className={isMoved ? `font-semibold ${NAVY}` : "text-slate-500"}>{formatRate(ours)}</span>
        {isMoved && ratio ? <span className="block text-xs text-slate-500">{formatCount(ratio)}x</span> : null}
      </p>
    </li>
  );
}

/** What 1,000 messages turn into, step by step, now and could be. */
function Funnel({ now, ours }: { now: Levers; ours: Levers }) {
  const was = funnelOf(now, MESSAGES);
  const is = funnelOf(ours, MESSAGES);
  const steps: { label: string; was: number; is: number }[] = [
    { label: "Messages", was: was.messages, is: is.messages },
    { label: "Interested", was: was.interested, is: is.interested },
    { label: "Book a call", was: was.calls, is: is.calls },
    { label: "Good fit", was: was.fits, is: is.fits },
    { label: "Clients", was: was.clients, is: is.clients },
  ];

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-[#f6f9fc] px-4 py-5 md:px-6" aria-label="What 1,000 messages become">
      <p className={`mb-4 text-slate-500 ${SMALL}`}>What {formatCount(MESSAGES)} messages become</p>
      <ol className="flex flex-col items-center gap-2">
        {steps.map((step, i) => {
          const isMoved = moved(step.was, step.is);
          const last = i === steps.length - 1;
          return (
            <li key={step.label} className="flex w-full flex-col items-center gap-2">
              {i > 0 ? <span className="h-3 w-px bg-slate-300" aria-hidden /> : null}
              <div
                className={`flex w-full max-w-[20rem] items-baseline justify-between gap-3 rounded-xl border px-4 py-2.5 ${
                  last ? "border-[#0c5290] bg-[#0c5290] text-white" : `bg-white ${isMoved ? "border-sky-200" : "border-slate-200"}`
                }`}
              >
                <span className={`${SMALL} ${last ? "text-white/80" : "text-slate-500"}`}>{step.label}</span>
                <span className="tabular-nums">
                  {isMoved ? <span className={`mr-2 text-xs ${last ? "text-white/70" : "text-slate-500"}`}>was {formatCount(step.was)}</span> : null}
                  <span className={`text-read font-semibold ${last ? "text-white" : isMoved ? NAVY : "text-slate-900"}`}>{formatCount(step.is)}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
