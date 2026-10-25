"use client";

import { useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";

import {
  EXAMPLE,
  LEVERS,
  change,
  eachBetterBy,
  formatChange,
  formatLever,
  formatMoney,
  rangeFor,
  resultsOf,
  shareForGoal,
  type LeverDef,
  type LeverKey,
  type Levers,
} from "@/lib/profitLevers";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";

import "./profitLevers.css";

const SMALL = "text-sm leading-[1.5]";
const NAVY = "text-[#0c5290]";

function moved(a: number, b: number): boolean {
  return Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a));
}

/**
 * Where the business is now, and what it could be. The left column takes the
 * owner's six numbers and has a dot to drag on each; the pyramid on the right
 * shows how they multiply into sales and gross profit. Nothing is saved.
 */
export function ProfitLevers({ business }: { business?: string | null }) {
  const [now, setNow] = useState<Levers>(EXAMPLE);
  const [ours, setOurs] = useState<Levers>(EXAMPLE);
  const [goal, setGoal] = useState<number | null>(null);

  // A new "now" carries the what-if with it, so +10% stays +10% when their real number goes in.
  const setNowLever = (key: LeverKey, value: number) => {
    setOurs((o) => ({ ...o, [key]: now[key] > 0 ? (o[key] * value) / now[key] : value }));
    setNow((n) => ({ ...n, [key]: value }));
  };
  const setOursLever = (key: LeverKey, value: number) => setOurs((o) => ({ ...o, [key]: value }));
  const reset = () => setOurs(now);

  const before = resultsOf(now);
  const after = resultsOf(ours);
  const changed = LEVERS.some(({ key }) => moved(now[key], ours[key]));
  const goalShare = goal ? shareForGoal(now, goal) : null;
  const extraProfit = after.grossProfit - before.grossProfit;

  return (
    <div className="mx-auto w-full max-w-[76rem] space-y-6 pb-16 pt-2">
      <section className={cardClass("plain", "px-6 py-5 md:px-8 md:py-6")}>
        <p className={`${SMALL} text-slate-500`}>{business ? `${business}, a year` : "A year"}</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <div>
            {changed ? (
              <p className="text-display font-semibold leading-tight text-slate-900">
                <span className={NAVY}>{extraProfit >= 0 ? "+" : "-"}{formatMoney(Math.abs(extraProfit))}</span> gross profit
              </p>
            ) : (
              <p className="text-display font-semibold leading-tight text-slate-900">
                {formatMoney(before.grossProfit)} gross profit
              </p>
            )}
            <p className={`mt-1 text-slate-600 ${SMALL}`}>
              Sales {formatMoney(before.sales)}
              {changed ? (
                <>
                  {" "}→ <span className={`font-semibold ${NAVY}`}>{formatMoney(after.sales)}</span> ({formatChange(change(before.sales, after.sales))})
                </>
              ) : null}
              . It&apos;s what&apos;s possible on paper, not a forecast.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill onClick={() => setOurs({ ...eachBetterBy(now, 0.1), margin: ours.margin })}>10% better on all five</Pill>
            {changed ? (
              <Pill onClick={reset} quiet>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Back to now
              </Pill>
            ) : null}
          </div>
        </div>
        <div className={`mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-100 pt-4 text-slate-600 ${SMALL}`}>
          <label htmlFor="pl-goal">Their goal for sales a year</label>
          <NumberField id="pl-goal" value={goal ?? 0} prefix="£" onChange={(v) => setGoal(v > 0 ? v : null)} width="w-32" />
          {goal && goalShare !== null ? (
            goalShare > 0 ? (
              <>
                <span>
                  needs about <span className="font-semibold text-slate-900">{formatChange(goalShare)}</span> on each of the five.
                </span>
                <Pill onClick={() => setOurs({ ...eachBetterBy(now, goalShare), margin: ours.margin })} quiet>
                  Show it
                </Pill>
              </>
            ) : (
              <span>They&apos;re there already.</span>
            )
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section className={cardClass("plain", "min-w-0")} aria-label="Their numbers">
          <div className={`grid grid-cols-[minmax(0,1fr)_7.5rem] items-end gap-x-4 border-b border-slate-100 px-6 pb-2 pt-4 text-slate-500 md:grid-cols-[minmax(0,1.1fr)_7.5rem_minmax(0,1fr)_5.5rem] ${SMALL}`}>
            <span>Their numbers</span>
            <span>Now</span>
            <span className="hidden md:block">Drag to try</span>
            <span className="hidden text-right md:block">Could be</span>
          </div>
          <ul>
            {LEVERS.map((lever) => (
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

        <Pyramid before={before} after={after} now={now} ours={ours} />
      </div>
    </div>
  );
}

function Pill({ children, onClick, quiet }: { children: ReactNode; onClick: () => void; quiet?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={buttonClass(quiet ? "second" : "main")}
    >
      {children}
    </button>
  );
}

/** Rates are typed as whole percents (50 for 50%); the rest as they are. */
function LeverRow({
  lever,
  now,
  ours,
  onNow,
  onOurs,
}: {
  lever: LeverDef;
  now: number;
  ours: number;
  onNow: (value: number) => void;
  onOurs: (value: number) => void;
}) {
  const percent = lever.unit === "percent";
  const range = rangeFor(lever.key, now);
  const isMoved = moved(now, ours);
  const along = (at: number) => Math.min(Math.max((at - range.min) / (range.max - range.min), 0), 1);
  const across = (share: number) => `calc(8px + (100% - 16px) * ${share.toFixed(4)})`;
  const from = along(now);
  const to = along(ours);

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-x-4 gap-y-2 border-b border-slate-100 px-6 py-3.5 last:border-b-0 md:grid-cols-[minmax(0,1.1fr)_7.5rem_minmax(0,1fr)_5.5rem]">
      <div className="min-w-0">
        <label htmlFor={`pl-${lever.key}`} className="block font-medium text-slate-900">
          {lever.label}
        </label>
        <p className={`text-slate-500 ${SMALL}`}>{lever.ask}</p>
      </div>
      <NumberField
        id={`pl-${lever.key}`}
        value={percent ? now * 100 : now}
        prefix={lever.unit === "pounds" ? "£" : undefined}
        suffix={percent ? "%" : lever.unit === "times" ? "×" : undefined}
        max={percent ? 100 : undefined}
        onChange={(v) => onNow(percent ? v / 100 : v)}
      />
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
          min={range.min}
          max={range.max}
          step={range.step}
          value={Math.min(ours, range.max)}
          onChange={(event) => onOurs(Number(event.target.value))}
          aria-label={`${lever.label}: try another value`}
          aria-valuetext={formatLever(lever.key, ours)}
        />
      </span>
      <p className={`col-span-2 text-right tabular-nums md:col-span-1 ${SMALL}`}>
        <span className={isMoved ? `font-semibold ${NAVY}` : "text-slate-500"}>{formatLever(lever.key, ours)}</span>
        {isMoved ? <span className="block text-xs text-slate-500">{formatChange(change(now, ours))}</span> : null}
      </p>
    </li>
  );
}

/** A number box that lets the owner's figure be typed freely, and only passes on numbers. */
function NumberField({
  id,
  value,
  onChange,
  prefix,
  suffix,
  max,
  width = "w-full",
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  max?: number;
  width?: string;
}) {
  const shown = value ? String(Math.round(value * 100) / 100) : "";
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <span className={`flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 focus-within:border-[#0c5290] focus-within:ring-2 focus-within:ring-sky-100 ${width}`}>
      {prefix ? <span className="text-slate-400">{prefix}</span> : null}
      <input
        id={id}
        inputMode="decimal"
        className="w-full min-w-0 bg-transparent tabular-nums text-slate-900 outline-none"
        value={draft ?? shown}
        onChange={(event) => {
          const text = event.target.value.replace(/[£,%×\s]/g, "");
          setDraft(text);
          const parsed = text === "" ? 0 : Number(text);
          if (Number.isFinite(parsed) && parsed >= 0) onChange(max !== undefined ? Math.min(parsed, max) : parsed);
        }}
        onBlur={() => setDraft(null)}
      />
      {suffix ? <span className="text-slate-400">{suffix}</span> : null}
    </span>
  );
}

/**
 * How the six numbers multiply, top to bottom: gross profit is sales × margin,
 * sales is customers × what each spends, and so on down to the levers.
 */
function Pyramid({
  before,
  after,
  now,
  ours,
}: {
  before: ReturnType<typeof resultsOf>;
  after: ReturnType<typeof resultsOf>;
  now: Levers;
  ours: Levers;
}) {
  const box = (label: string, was: number, is: number, format: (v: number) => string, sub?: string) => (
    <Box label={label} was={format(was)} is={format(is)} isMoved={moved(was, is)} delta={formatChange(change(was, is))} sub={sub} />
  );
  const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
  const count = (v: number) => `${Math.round(v * 10) / 10}`;

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-[#f6f9fc] px-4 py-5 md:px-6" aria-label="How it adds up">
      <p className={`mb-4 text-slate-500 ${SMALL}`}>How it adds up, a year</p>
      <div className="flex flex-col items-center gap-2">
        <Row>{box("Gross profit", before.grossProfit, after.grossProfit, formatMoney)}</Row>
        <Join />
        <Row>
          {box("Sales", before.sales, after.sales, formatMoney)}
          <X />
          {box("Gross margin", now.margin, ours.margin, pct)}
        </Row>
        <Join />
        <Row>
          {box("Customers", before.customers, after.customers, count)}
          <X />
          {box("Each spends", before.customerValue, after.customerValue, formatMoney)}
        </Row>
        <Join />
        <Row>
          {box("Leads", before.leadsAYear, after.leadsAYear, count)}
          <X />
          {box("Leads that buy", before.conversion, after.conversion, pct, `${pct(ours.meetingRate)} × ${pct(ours.winRate)}`)}
          <X />
          {box("Average sale", now.averageSale, ours.averageSale, formatMoney)}
          <X />
          {box("Times they buy", now.timesBought, ours.timesBought, (v) => `${Math.round(v * 10) / 10}×`)}
        </Row>
      </div>
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex w-full items-stretch justify-center gap-1.5">{children}</div>;
}

function X() {
  return <span className="self-center text-xs text-slate-400" aria-hidden>×</span>;
}

/** The thin line joining one row of the pyramid to the one above it. */
function Join() {
  return <span className="h-3 w-px bg-slate-300" aria-hidden />;
}

function Box({ label, was, is, isMoved, delta, sub }: { label: string; was: string; is: string; isMoved: boolean; delta: string; sub?: string }) {
  return (
    <div className={`min-w-0 flex-1 basis-0 rounded-xl border bg-white px-2 py-2.5 text-center ${isMoved ? "border-sky-200" : "border-slate-200"}`} style={{ maxWidth: "15rem" }}>
      <p className="text-xs leading-tight text-slate-500">{label}</p>
      <p className={`mt-0.5 text-read font-semibold tabular-nums ${isMoved ? NAVY : "text-slate-900"}`}>{is}</p>
      {isMoved ? (
        <p className="text-xs leading-snug tabular-nums text-slate-500">
          <span className={`font-medium ${delta.startsWith("-") ? "text-red-700" : "text-emerald-700"}`}>{delta}</span>
          <span className="block">was {was}</span>
        </p>
      ) : sub ? (
        <p className="text-xs leading-snug tabular-nums text-slate-500">{sub}</p>
      ) : null}
    </div>
  );
}
