"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";

import { figtree } from "@/fonts";
import { labelRows, lineFor, lineStatus, niceCeil } from "@/lib/profitTargets";
import {
  EXAMPLE,
  EXAMPLE_MARKETING,
  EXAMPLE_YEAR,
  DEFAULT_PROFIT_SHARE,
  GROWTH,
  LEVERS,
  PROFIT_TARGETS,
  costPerCustomer,
  costPerLead,
  count,
  defaultProfitTargets,
  defaultTarget,
  gainIfHit,
  improvedBy,
  isLower,
  leverOf,
  leverText,
  lifetimeGross,
  monthOf,
  needsFor,
  overheadsFrom,
  poundsShort,
  profitAYear,
  rangeFor,
  salesCheck,
  type LastYear,
  type LeverKey,
  type Month,
  type Numbers,
  type ProfitTargetKey,
} from "@/lib/profitPublic";

import { TargetPath, type Need } from "../targets/TargetPath";
import { TargetSlider } from "../targets/TargetSlider";
import { TargetStatus } from "../targets/TargetStatus";

import "../targets/targets.css";
import "./profitPublic.css";

const SAME = 1e-9;
const COLUMNS = 8;
const IMPROVE_STOPS = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3];

/** What each number makes in a month: the right-hand half of its row. */
const MONTH_OF: Partial<Record<LeverKey, { key: keyof Month; format: (value: number) => string }>> = {
  traffic: { key: "traffic", format: count },
  leadRate: { key: "leads", format: count },
  offerRate: { key: "offers", format: count },
  conversion: { key: "customers", format: count },
  timesBought: { key: "orders", format: count },
  averageSale: { key: "sales", format: poundsShort },
  margin: { key: "grossProfit", format: poundsShort },
  overheads: { key: "overheads", format: poundsShort },
};

/** Worked out from the rows above, like the Targets tab's cost rows: no box to type in, and the dot can't be dragged. */
type WorkedKey = "costPerLead" | "costPerCustomer" | "lifetimeGross";

const WORKED: Record<WorkedKey, { label: string; hint: string; lower: boolean; of: (n: Numbers) => number | null }> = {
  costPerLead: { label: "Cost per lead", hint: "Marketing ÷ leads", lower: true, of: costPerLead },
  costPerCustomer: { label: "Cost to win a customer", hint: "Marketing ÷ new customers", lower: true, of: costPerCustomer },
  lifetimeGross: { label: "Lifetime gross value", hint: "Gross profit from one customer while they stay", lower: false, of: lifetimeGross },
};

type RowKey = LeverKey | WorkedKey | "marketing";

const GROUPS: Array<{ label: string; keys: RowKey[] }> = [
  { label: "Getting customers", keys: ["marketing", "traffic", "leadRate", "costPerLead", "offerRate", "conversion", "costPerCustomer"] },
  { label: "What each customer is worth", keys: ["timesBought", "averageSale", "years", "lifetimeGross"] },
  { label: "Profit", keys: ["margin", "overheads"] },
];

/**
 * A number box for the owner's figures. Rates are typed as percents (1 for 1%). Shows the number with commas
 * while resting, and exactly what was typed while typing.
 */
function NumberBox({
  id,
  label,
  value,
  unit,
  onChange,
  quiet,
  size = "md",
}: {
  id?: string;
  label: string;
  value: number;
  unit: "count" | "percent" | "pounds" | "times" | "years";
  onChange: (value: number) => void;
  quiet?: boolean;
  size?: "md" | "lg";
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown =
    unit === "percent"
      ? String(Math.round(value * 10000) / 100)
      : unit === "times" || unit === "years"
        ? String(Math.round(value * 10) / 10)
        : Math.round(value).toLocaleString("en-GB");
  return (
    <span className={`pp-box${quiet ? " is-quiet" : ""}${size === "lg" ? " is-lg" : ""}`}>
      {unit === "pounds" ? <span className="pp-box__unit">£</span> : null}
      <input
        id={id}
        inputMode="decimal"
        aria-label={id ? undefined : label}
        value={draft ?? (value ? shown : "")}
        placeholder="0"
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          const text = event.target.value.replace(/[£,%×\s]/g, "");
          setDraft(text);
          const parsed = text === "" ? 0 : Number(text);
          if (!Number.isFinite(parsed) || parsed < 0) return;
          onChange(unit === "percent" ? Math.min(parsed, 100) / 100 : parsed);
        }}
        onBlur={() => setDraft(null)}
      />
      {unit === "percent" ? (
        <span className="pp-box__unit">%</span>
      ) : unit === "times" ? (
        <span className="pp-box__unit">×</span>
      ) : unit === "years" ? (
        <span className="pp-box__unit">yrs</span>
      ) : null}
    </span>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="pp-field">
      <label htmlFor={id} className="pp-field__label">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Profit levers for owners: last year's sales and profit, three profit targets of their own, then the BCA Targets
 * table a month at a time. Drag any dot to try a what-if, or move all seven growth numbers at once.
 */
export function ProfitPublicPage() {
  const [sales, setSales] = useState(EXAMPLE_YEAR.sales);
  // Null until they type it: 20% of sales stands in.
  const [profitTyped, setProfitTyped] = useState<number | null>(null);
  const year: LastYear = { sales, profit: profitTyped ?? sales * DEFAULT_PROFIT_SHARE };
  const [base, setBase] = useState(EXAMPLE);
  const [marketing, setMarketing] = useState(EXAMPLE_MARKETING);
  // The what-if: each growth number, and overheads as a share of where they are now.
  const [ours, setOurs] = useState(EXAMPLE);
  const [overheadShare, setOverheadShare] = useState(1);
  const [improve, setImprove] = useState(0);
  const [targetsSet, setTargetsSet] = useState<Partial<Record<LeverKey, number>>>({});
  const [profitSet, setProfitSet] = useState<Partial<Record<ProfitTargetKey, number>>>({});

  const overheads = overheadsFrom(year, base.margin, marketing);
  const now: Numbers = { ...base, overheads, marketing };
  const what: Numbers = { ...ours, overheads: overheads * overheadShare, marketing };
  const changed = LEVERS.some(({ key }) => Math.abs(now[key] - what[key]) > SAME * Math.max(1, now[key]));

  const targets = Object.fromEntries(LEVERS.map(({ key }) => [key, targetsSet[key] ?? defaultTarget(key, now[key])])) as Record<LeverKey, number>;
  const profitDefaults = defaultProfitTargets(year.profit);
  const profitTargets = PROFIT_TARGETS.map(({ key, label }) => ({ key, label, target: profitSet[key] ?? profitDefaults[key] }));
  const shownTargets = profitTargets.filter(({ target }) => target > 0).sort((a, b) => a.target - b.target);

  const profitNow = profitAYear(now);
  const profitWhat = profitAYear(what);
  const monthNow = monthOf(now);
  const monthWhat = monthOf(what);
  const check = salesCheck(now, year);
  const tooLittleKept = year.sales * base.margin < year.profit;
  const tooMuchMarketing = !tooLittleKept && (year.sales * base.margin - year.profit) / 12 < marketing;
  // The worked-out rows' targets: what they come to with every number at its target.
  const atTargets: Numbers = { ...now, ...targets };

  // Typing a number keeps any what-if in step with it, so +10% stays +10%.
  const setNow = (key: LeverKey, value: number) => {
    if (key === "overheads") return;
    setOurs((o) => ({ ...o, [key]: base[key] > 0 ? (o[key] * value) / base[key] : value }));
    setBase((b) => ({ ...b, [key]: value }));
  };
  const setWhat = (key: LeverKey, value: number) => {
    if (key === "overheads") setOverheadShare(overheads > 0 ? value / overheads : 1);
    else setOurs((o) => ({ ...o, [key]: value }));
  };
  const setAll = (share: number) => {
    setImprove(share);
    const next = improvedBy(now, share);
    setOurs((o) => ({ ...o, ...Object.fromEntries(GROWTH.map((key) => [key, next[key]])) }));
  };
  const reset = () => {
    setImprove(0);
    setOurs(base);
    setOverheadShare(1);
  };

  // The profit bar: £0 on the left, the biggest target or profit on the right.
  const top = Math.max(...shownTargets.map(({ target }) => target), profitNow, profitWhat, 1);
  const at = (value: number) => `${Math.min(Math.max(value / top, 0) * 100, 100)}%`;
  const tickRows = labelRows(shownTargets.map(({ target }) => target / top), 0.22);

  // The table's month bars: full at what the biggest target needs.
  const biggest = Math.max(...shownTargets.map(({ target }) => target), 1);
  const headRows = labelRows(shownTargets.map(({ target }) => target / biggest), 0.3);
  const needs = shownTargets.map(({ label, target }) => ({ label, target, need: needsFor(target, what) }));
  const needsNow = shownTargets.map(({ target }) => ({ target, need: needsFor(target, now) }));
  const needsOf = (key: keyof Month): Need[] => needs.map(({ label, target, need }) => ({ label, target, value: need[key] }));
  const monthCell = (key: keyof Month, format: (value: number) => string, label: string) =>
    shownTargets.length > 0 && key !== "overheads" ? (
      <TargetPath
        value={monthWhat[key]}
        actual={monthNow[key]}
        moved={changed}
        needs={needsOf(key)}
        topWas={needsNow.find(({ target }) => target === biggest)?.need[key]}
        format={format}
        label={label}
        per="a month"
        note="Each tick: what a profit target needs, a month."
      />
    ) : (
      <>
        <td className="tgt-num tgt-month">
          <span className={changed && Math.abs(monthWhat[key] - monthNow[key]) > SAME ? "tgt-value is-whatif" : "tgt-value"}>
            {changed && format(monthWhat[key]) !== format(monthNow[key]) ? (
              <>
                <span className="tgt-was">{format(monthNow[key])}</span>
                <span className="tgt-was__arrow" aria-hidden="true">
                  →
                </span>
              </>
            ) : null}
            {format(monthWhat[key])}
          </span>
        </td>
        <td />
      </>
    );

  const row = (key: LeverKey) => {
    const lever = leverOf(key);
    const lower = isLower(key);
    const line = lineFor(targets[key], lower);
    const gain = gainIfHit(now, key, targets[key]);
    const month = MONTH_OF[key];
    return (
      <tr key={key}>
        <th scope="row">
          <span className="pp-step">
            <span className="pp-step__name">{lever.label}</span>
            <span className="pp-step__hint">{lever.hint}</span>
          </span>
        </th>
        <td className="tgt-num tgt-tight">
          {key === "overheads" ? (
            <span className="pp-worked" title="Worked out from last year: sales × gross margin, less profit and marketing, a month.">
              {poundsShort(overheads)}
            </span>
          ) : (
            <NumberBox label={`${lever.label} now`} value={now[key]} unit={lever.unit} onChange={(value) => setNow(key, value)} />
          )}
        </td>
        <td className="tgt-num tgt-tight">
          <NumberBox
            label={`${lever.label} target`}
            value={targets[key]}
            unit={lever.unit}
            quiet
            onChange={(value) => setTargetsSet((t) => ({ ...t, [key]: value }))}
          />
        </td>
        <td className="tgt-num tgt-gain tgt-tight">{gain >= 1 ? `+${poundsShort(gain)}` : ""}</td>
        <td className="tgt-bar-col">
          <TargetSlider
            label={lever.label}
            value={what[key]}
            from={now[key]}
            line={line}
            range={rangeFor(key, now[key], targets[key])}
            lowerIsBetter={lower}
            onChange={(value) => setWhat(key, value)}
            format={(value) => leverText(key, value)}
            card={false}
          />
        </td>
        <td>
          <TargetStatus status={lineStatus(what[key], line, lower)} />
        </td>
        {month ? (
          monthCell(month.key, month.format, lever.label)
        ) : (
          <>
            <td className="tgt-month" />
            <td />
          </>
        )}
      </tr>
    );
  };

  const workedRow = (key: WorkedKey) => {
    const def = WORKED[key];
    const valueNow = def.of(now);
    const valueWhat = def.of(what);
    const target = def.of(atTargets);
    const moved = changed && valueNow !== null && valueWhat !== null && poundsShort(valueNow) !== poundsShort(valueWhat);
    const line = target !== null ? lineFor(target, def.lower) : null;
    const top = niceCeil(Math.max(valueNow ?? 0, (target ?? 0) * 1.5, valueWhat ?? 0, 10) * (def.lower ? 2 : 1.25));
    return (
      <tr key={key} className="pp-worked-row">
        <th scope="row">
          <span className="pp-step">
            <span className="pp-step__name">{def.label}</span>
            <span className="pp-step__hint">{def.hint}</span>
          </span>
        </th>
        <td className="tgt-num tgt-tight">
          <span className={moved ? "tgt-value is-whatif" : "tgt-value"} title={moved && valueNow !== null ? `Now ${poundsShort(valueNow)}` : undefined}>
            {valueWhat !== null ? poundsShort(valueWhat) : "—"}
          </span>
        </td>
        <td className="tgt-num tgt-tight pp-target-text">{target !== null ? poundsShort(target) : ""}</td>
        <td />
        <td className="tgt-bar-col">
          {line ? (
            <TargetSlider
              label={def.label}
              value={valueWhat}
              line={line}
              range={{ min: 0, max: top, step: 1 }}
              lowerIsBetter={def.lower}
              format={poundsShort}
              card={false}
            />
          ) : null}
        </td>
        <td>{line ? <TargetStatus status={lineStatus(valueWhat, line, def.lower)} /> : null}</td>
        <td className="tgt-month" />
        <td />
      </tr>
    );
  };

  /** Marketing a month: typed, and kept as it is through any what-if. */
  const marketingRow = (
    <tr key="marketing">
      <th scope="row">
        <span className="pp-step">
          <span className="pp-step__name">Marketing spend</span>
          <span className="pp-step__hint">Ads, agencies, events. £0 if it&rsquo;s all word of mouth</span>
        </span>
      </th>
      <td className="tgt-num tgt-tight">
        <NumberBox label="Marketing spend a month" value={marketing} unit="pounds" onChange={setMarketing} />
      </td>
      <td />
      <td />
      <td />
      <td />
      <td className="tgt-num tgt-month">
        <span className="tgt-value">{poundsShort(marketing)}</span>
      </td>
      <td />
    </tr>
  );
  const anyRow = (key: RowKey) => (key === "marketing" ? marketingRow : key in WORKED ? workedRow(key as WorkedKey) : row(key as LeverKey));

  // The two numbers that matter most: what a customer costs to win, and what they're worth.
  const cpaNow = costPerCustomer(now);
  const cpaWhat = costPerCustomer(what);
  const ltgvNow = lifetimeGross(now);
  const ltgvWhat = lifetimeGross(what);
  const back = cpaWhat && cpaWhat > 0 ? ltgvWhat / cpaWhat : null;
  const wasNow = (was: number | null, is: number | null) =>
    changed && was !== null && is !== null && poundsShort(was) !== poundsShort(is) ? <span className="pp-keys__was">{poundsShort(was)} →</span> : null;

  return (
    <div className={`pp dash tgt ${figtree.variable}`}>
      <header className="pp-top">
        <Link href="/" aria-label="The Profit Coach home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/profit-coach-logo.svg" alt="The Profit Coach" className="pp-top__logo" />
        </Link>
      </header>

      <main className="pp-main">
        <section className="pp-intro">
          <h1 className="pp-title">
            <span className="pp-title__light">Where your business is now,</span>
            <span className="pp-title__bold">and what it could make.</span>
          </h1>
          <p className="pp-lede">Put in last year&rsquo;s numbers. Then see what small gains on each one are worth.</p>
        </section>

        <section className="pp-card pp-start" aria-label="Last year and your targets">
          <div className="pp-start__group">
            <h2 className="pp-h2">Last year</h2>
            <div className="pp-fields">
              <Field id="pp-sales" label="Sales">
                <NumberBox id="pp-sales" label="Sales last year" value={year.sales} unit="pounds" size="lg" onChange={setSales} />
              </Field>
              <Field id="pp-profit" label="Profit before tax">
                <NumberBox id="pp-profit" label="Profit last year" value={year.profit} unit="pounds" size="lg" quiet={profitTyped === null} onChange={setProfitTyped} />
                {profitTyped === null ? <span className="pp-field__note">20% of sales until you put yours in</span> : null}
              </Field>
            </div>
          </div>
          <div className="pp-start__group">
            <h2 className="pp-h2">Profit you want a year</h2>
            <div className="pp-fields is-three">
              {profitTargets.map(({ key, label, target }) => (
                <Field key={key} id={`pp-${key}`} label={label}>
                  <NumberBox
                    id={`pp-${key}`}
                    label={`${label} profit a year`}
                    value={target}
                    unit="pounds"
                    size="lg"
                    onChange={(value) => setProfitSet((p) => ({ ...p, [key]: value }))}
                  />
                </Field>
              ))}
            </div>
          </div>
          <p className={`pp-check${tooLittleKept || tooMuchMarketing || !check.ok ? " is-off" : ""}`} role="status">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              {tooLittleKept || tooMuchMarketing || !check.ok ? (
                <path d="M8 4v5M8 11.6v.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              ) : (
                <path d="M3.5 8.3 6.5 11l6-6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
            {tooLittleKept
              ? "Profit is more than your gross margin keeps from sales. Check the gross margin below."
              : tooMuchMarketing
                ? "Marketing spend is more than all your costs from last year. Check marketing spend below."
              : check.ok
                ? `Your numbers below make ${poundsShort(check.modelled)} of sales a year, close to the ${poundsShort(year.sales)} you said.`
                : `Your numbers below make ${poundsShort(check.modelled)} of sales a year. You said ${poundsShort(year.sales)}. One of them is out: check traffic, the rates or the average sale.`}
          </p>
        </section>

        <section className="pp-card pp-result" aria-label="Profit a year, against your targets">
          <div className="tgt-hero pp-hero">
            <div className="tgt-hero__figure">
              <span className="tgt-hero__label">Profit a year</span>
              <span className="tgt-hero__value">
                {changed ? <span className="pp-hero-was">{poundsShort(profitNow)} →</span> : null}
                <span className={changed ? "pp-hero-what" : undefined}>{poundsShort(changed ? profitWhat : profitNow)}</span>
              </span>
              <span className="tgt-hero__sub">
                {poundsShort((changed ? profitWhat : profitNow) / 12)} a month · {poundsShort((changed ? monthWhat : monthNow).sales * 12)} sales a year
              </span>
            </div>
            <div className={tickRows.includes(1) ? "tgt-meter pl-two-rows" : "tgt-meter"}>
              <div className="tgt-meter__track">
                <span className="tgt-meter__stack" style={{ width: at(Math.max(profitNow, changed ? profitWhat : 0)) }}>
                  <span
                    className="tgt-meter__part is-new"
                    style={{ flexGrow: Math.max(Math.min(profitNow, changed ? profitWhat : profitNow), 0) }}
                    title={`Now: ${poundsShort(profitNow)}`}
                  />
                  {changed && profitWhat > profitNow ? (
                    <span className="tgt-meter__part is-plan" style={{ flexGrow: profitWhat - profitNow }} title={`What-if: ${poundsShort(profitWhat)}`} />
                  ) : null}
                </span>
                {shownTargets.map(({ label, target }, i) => (
                  <span
                    key={label}
                    className={`tgt-meter__tick${target / top > 0.9 ? " is-end" : ""}${tickRows[i] ? " is-up" : ""}`}
                    style={{ left: at(target) }}
                  >
                    <span className="tgt-meter__tick-label">
                      {label}
                      <span className="pl-tick-amount"> {poundsShort(target)}</span>
                    </span>
                  </span>
                ))}
              </div>
              <ul className="tgt-meter__readout">
                {shownTargets.map(({ label, target }) => (
                  <li key={label}>
                    <strong>{Math.round((Math.max(changed ? profitWhat : profitNow, 0) / target) * 100)}%</strong> of {label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pp-improve">
            <label htmlFor="pp-improve" className="pp-improve__label">
              Improve all seven growth numbers by
            </label>
            <div className="pp-improve__control">
              <input
                id="pp-improve"
                type="range"
                min={0}
                max={0.3}
                step={0.01}
                value={improve}
                onChange={(event) => setAll(Number(event.target.value))}
                aria-valuetext={`${Math.round(improve * 100)}%`}
                style={{ "--pp-fill": `${(improve / 0.3) * 100}%` } as CSSProperties}
              />
              <span className="pp-improve__stops" aria-hidden="true">
                {IMPROVE_STOPS.map((stop) => (
                  <button key={stop} type="button" tabIndex={-1} onClick={() => setAll(stop)} className={Math.abs(stop - improve) < 0.001 ? "is-on" : undefined}>
                    {Math.round(stop * 100)}%
                  </button>
                ))}
              </span>
            </div>
            <p className="pp-improve__value">
              <strong>+{Math.round(improve * 100)}%</strong>
              <span>each</span>
            </p>
          </div>

          <dl className="pp-keys">
            <div className="pp-keys__item">
              <dt>Cost to win a customer</dt>
              <dd>
                {wasNow(cpaNow, cpaWhat)}
                <span className={changed ? "pp-keys__what" : undefined}>{cpaWhat !== null ? poundsShort(cpaWhat) : "—"}</span>
              </dd>
              <p>Marketing spend ÷ new customers</p>
            </div>
            <div className="pp-keys__item">
              <dt>Lifetime gross value</dt>
              <dd>
                {wasNow(ltgvNow, ltgvWhat)}
                <span className={changed ? "pp-keys__what" : undefined}>{poundsShort(ltgvWhat)}</span>
              </dd>
              <p>Gross profit from one customer while they stay</p>
            </div>
            <div className="pp-keys__item is-ratio">
              <dt>Back for every £1 spent winning one</dt>
              <dd>{back !== null ? `£${back < 10 ? back.toFixed(1).replace(/\.0$/, "") : Math.round(back).toLocaleString("en-GB")}` : "—"}</dd>
              <p>{back !== null ? "Lifetime gross value ÷ cost to win a customer" : "No marketing spend to measure against"}</p>
            </div>
          </dl>
        </section>

        <section className="tgt-panel tgt-targets pp-table" aria-label="Your numbers, a month">
          <div className="tgt-panel__head tgt-targets__head">
            <h2 className="pp-h2">Your numbers, a month</h2>
            <div className="tgt-targets__actions">
              {changed ? (
                <>
                  <span className="tgt-whatif-note">What-if: the blue numbers are not real</span>
                  <button type="button" className="tgt-reset" onClick={reset}>
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M3.5 8a4.5 4.5 0 1 0 1.4-3.25M3.5 2.75v2.5H6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Back to now
                  </button>
                </>
              ) : (
                <span className="pp-hint">Drag any dot to try a what-if</span>
              )}
            </div>
          </div>
          <div className="tgt-scroll">
            <table className="tgt-grid-table tgt-one-table">
              <thead>
                <tr>
                  <th scope="col">Number</th>
                  <th scope="col" className="tgt-num tgt-tight">
                    Now
                  </th>
                  <th scope="col" className="tgt-num tgt-tight">
                    Target
                  </th>
                  <th scope="col" className="tgt-num tgt-tight" title="What hitting that one target adds to profit a year, with everything else as it is now.">
                    If hit, a year
                  </th>
                  <th scope="col" className="tgt-bar-col">
                    <span className="dash-sr">Now against target</span>
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col" className="tgt-num tgt-month">
                    A month
                  </th>
                  <th scope="col" className="tgt-bar-col">
                    <span className={headRows.includes(1) ? "tgt-vhead pl-two-rows" : "tgt-vhead"}>
                      {shownTargets.map(({ label, target }, i) => (
                        <span
                          key={label}
                          className={`tgt-vhead__label${target === biggest ? " is-end" : ""}${headRows[i] ? " is-up" : ""}`}
                          style={target === biggest ? undefined : { left: `calc((100% - 3.2em - 10px) * ${target / biggest})` }}
                        >
                          {label}
                        </span>
                      ))}
                    </span>
                  </th>
                </tr>
              </thead>
              {GROUPS.map((group) => (
                <tbody key={group.label}>
                  <tr className="tgt-group-row">
                    <th scope="rowgroup" colSpan={COLUMNS}>
                      {group.label}
                    </th>
                  </tr>
                  {group.keys.map(anyRow)}
                  {group.label === "Profit" ? (
                    <tr className="pp-total">
                      <th scope="row">
                        <span className="pp-step">
                          <span className="pp-step__name">Profit</span>
                          <span className="pp-step__hint">Gross profit less overheads and marketing</span>
                        </span>
                      </th>
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                      {monthCell("profit", poundsShort, "Profit")}
                    </tr>
                  ) : null}
                </tbody>
              ))}
            </table>
          </div>
        </section>

        <section className="pp-end">
          <p className="pp-note">This is what&rsquo;s possible on paper, not a forecast. Small gains on each number multiply.</p>
          <p className="pp-cta-line">Want to know which number to work on first?</p>
          <Link href="/score" className="pp-cta">
            Take the free BOSS Score
          </Link>
        </section>
      </main>
    </div>
  );
}
