"use client";

import { useState } from "react";

import {
  EXAMPLE,
  RATES,
  TARGET_NAMES,
  defaultProfitTargets,
  defaultTarget,
  labelRows,
  pounds,
  profitOf,
  volumesOf,
  amount,
  type Numbers,
  type RateKey,
  type TargetName,
} from "@/lib/profitTargets";

import { ProfitSteps, type ProfitTarget } from "./ProfitSteps";
import { TargetTip } from "./TargetTip";

import "./targets.css";

type Mode = "set" | "whatif";

const SAME = 1e-9;

function same(a: Numbers, b: Numbers): boolean {
  return (Object.keys(a) as Array<keyof Numbers>).every((key) => Math.abs(a[key] - b[key]) < SAME);
}

/**
 * Profit levers v2: the BCA dashboard's Targets tab for an owner's business. Their numbers go in first (typed, or
 * dragged); then a what-if leaves a faint dot where they are. Three £ profit targets of their own set every tick.
 */
export function ProfitTargetsBoard({ business }: { business?: string | null }) {
  const [now, setNow] = useState<Numbers>(EXAMPLE);
  const [ours, setOurs] = useState<Numbers>(EXAMPLE);
  const [anchor, setAnchor] = useState<Numbers>(EXAMPLE);
  const [mode, setMode] = useState<Mode>("set");
  const [costs, setCosts] = useState(false);
  const [order, setOrder] = useState<"funnel" | "gap">("funnel");
  const [stepTargets, setStepTargets] = useState<Partial<Record<RateKey, number>>>({});
  const [profitSet, setProfitSet] = useState<Partial<Record<TargetName, number>>>({});
  const [off, setOff] = useState<Partial<Record<TargetName, boolean>>>({});

  const defaults = Object.fromEntries(RATES.map(({ key }) => [key, defaultTarget(key, now[key])])) as Record<RateKey, number>;
  const targets = { ...defaults, ...stepTargets } as Record<RateKey, number>;
  const profitNow = profitOf(now, costs);
  const profitOurs = profitOf(ours, costs);
  const profitDefaults = defaultProfitTargets(profitNow);
  const named = TARGET_NAMES.map(({ key, label }) => ({ key, label, target: profitSet[key] ?? profitDefaults[key] }));
  const picked: ProfitTarget[] = named
    .filter(({ key, target }) => !off[key] && target > 0)
    .map(({ label, target }) => ({ label, target }))
    .sort((a, b) => a.target - b.target);

  const allAtTarget = { ...now, ...targets };
  const whatIf = mode === "whatif" && !same(now, ours);
  const atTarget = mode === "whatif" && same(ours, allAtTarget);

  // Their numbers: typing or dragging moves the dots with them, and the bars rescale to the typed number.
  const setNowField = (key: keyof Numbers, value: number, typed = true) => {
    setNow((n) => ({ ...n, [key]: value }));
    setOurs((o) => ({ ...o, [key]: value }));
    if (typed) setAnchor((a) => ({ ...a, [key]: value }));
  };
  const setOursField = (key: keyof Numbers, value: number) => setOurs((o) => ({ ...o, [key]: value }));
  const reset = () => setOurs(now);
  const showMode = (next: Mode) => {
    setMode(next);
    setOurs(now);
  };

  const yearNow = volumesOf(now);
  const top = Math.max(...picked.map(({ target }) => target), profitNow, profitOurs, 1);
  const at = (value: number) => `${Math.min(Math.max(value / top, 0) * 100, 100)}%`;
  const profitName = costs ? "Net profit" : "Gross profit";
  const tickRows = labelRows(picked.map(({ target }) => target / top), 0.22);

  return (
    <div className="dash tgt pl-board">
      <div className="tgt-controls">
        <div className="tgt-controls__group" role="group" aria-label="Their profit targets a year">
          <span className="tgt-controls__label">{profitName} targets a year</span>
          <div className="tgt-chips">
            {named.map(({ key, label, target }) => {
              const on = !off[key];
              return (
                <span key={key} className={on ? "tgt-chip pl-chip is-on" : "tgt-chip pl-chip"}>
                  <button
                    type="button"
                    className="pl-chip__toggle"
                    aria-pressed={on}
                    aria-label={`${label}: compare against it`}
                    onClick={() => setOff((o) => ({ ...o, [key]: on }))}
                  >
                    <span className="tgt-chip__check" aria-hidden="true" />
                    {label}
                  </button>
                  <span className="pl-chip__amount">
                    £
                    <input
                      inputMode="numeric"
                      aria-label={`${label} target, £ a year`}
                      value={target ? Math.round(target).toLocaleString("en-GB") : ""}
                      onChange={(event) => {
                        const value = Number(event.target.value.replace(/[£,\s]/g, ""));
                        if (Number.isFinite(value) && value >= 0) setProfitSet((p) => ({ ...p, [key]: value }));
                      }}
                    />
                  </span>
                </span>
              );
            })}
          </div>
        </div>
        <div className="tgt-controls__group">
          <TargetTip tip="Off: targets are gross profit. On: adds cost per lead and overheads, and targets are net profit." end>
            <span className="tgt-controls__label">Costs</span>
          </TargetTip>
          <div className="dash-views" role="group" aria-label="Costs">
            {(
              [
                [false, "Off"],
                [true, "On"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={label}
                type="button"
                className={costs === value ? "dash-views__link is-on" : "dash-views__link"}
                aria-pressed={costs === value}
                onClick={() => {
                  setCosts(value);
                  setProfitSet({});
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="tgt-hero" aria-label={`${profitName} a year, against their targets`}>
        <div className="tgt-hero__figure">
          <span className="tgt-hero__label">
            {business ? `${business}: ` : ""}
            {profitName.toLowerCase()} a year
          </span>
          <span className="tgt-hero__value">
            {whatIf ? <span className="pl-hero-was">{pounds(profitNow)} →</span> : null}
            <span className={whatIf ? "pl-hero-whatif" : undefined}>{pounds(whatIf ? profitOurs : profitNow)}</span>
          </span>
          <span className="tgt-hero__sub">
            ({pounds(yearNow.sales)} sales · {amount(yearNow.customers)} new customers)
          </span>
        </div>
        <div className={tickRows.includes(1) ? "tgt-meter pl-two-rows" : "tgt-meter"}>
          <div className="tgt-meter__track">
            <span className="tgt-meter__stack" style={{ width: at(Math.max(profitNow, whatIf ? profitOurs : 0)) }}>
              <span className="tgt-meter__part is-new" style={{ flexGrow: Math.max(Math.min(profitNow, whatIf ? profitOurs : profitNow), 0) }} title={`Now: ${pounds(profitNow)}`} />
              {whatIf && profitOurs > profitNow ? (
                <span className="tgt-meter__part is-plan" style={{ flexGrow: profitOurs - profitNow }} title={`What-if: ${pounds(profitOurs)}`} />
              ) : null}
            </span>
            {picked.map(({ label, target }, i) => (
              <span
                key={label}
                className={`tgt-meter__tick${target / top > 0.9 ? " is-end" : ""}${tickRows[i] ? " is-up" : ""}`}
                style={{ left: at(target) }}
              >
                <span className="tgt-meter__tick-label">
                  {label}
                  <span className="pl-tick-amount"> {pounds(target)}</span>
                </span>
              </span>
            ))}
          </div>
          <ul className="tgt-meter__readout">
            {picked.map(({ label, target }) => (
              <li key={label}>
                <strong>{Math.round((Math.max(whatIf ? profitOurs : profitNow, 0) / target) * 100)}%</strong> of {label}
              </li>
            ))}
          </ul>
          <ul className="tgt-meter__legend">
            <li>
              <span className="tgt-meter__swatch is-new" aria-hidden="true" />
              Now <strong>{pounds(profitNow)}</strong>
            </li>
            {whatIf ? (
              <li>
                <span className="tgt-meter__swatch is-plan" aria-hidden="true" />
                What-if <strong>{pounds(profitOurs)}</strong>
              </li>
            ) : null}
          </ul>
        </div>
      </section>

      <section className="tgt-panel tgt-targets" aria-label="Their numbers">
        <div className="tgt-panel__head tgt-targets__head">
          <div className="pl-head-start">
            <h2 className="tgt-panel__title tgt-targets__title">
              {mode === "set" ? "Their numbers" : "What if"}
              <TargetTip
                tip={
                  mode === "set"
                    ? "Type their numbers, or drag a dot to where they are. Rest on a bar to move its target (10% better until you move it)."
                    : "Drag a dot to try a what-if: a faint dot stays where they are. The year bars follow. Ticks: what each £ target needs."
                }
              >
                <svg className="tgt-step-name__icon" viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M8 7.2v3.8M8 4.9v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </TargetTip>
            </h2>
            <div className="dash-views" role="group" aria-label="What the dots show">
              <button type="button" className={mode === "set" ? "dash-views__link is-on" : "dash-views__link"} aria-pressed={mode === "set"} onClick={() => showMode("set")}>
                Their numbers
              </button>
              <button
                type="button"
                className={mode === "whatif" && !atTarget ? "dash-views__link is-on" : "dash-views__link"}
                aria-pressed={mode === "whatif" && !atTarget}
                onClick={() => showMode("whatif")}
              >
                What if
              </button>
              <button
                type="button"
                className={atTarget ? "dash-views__link is-on" : "dash-views__link"}
                aria-pressed={atTarget}
                onClick={() => {
                  setMode("whatif");
                  setOurs(allAtTarget);
                }}
              >
                All at target
              </button>
            </div>
          </div>
          <div className="tgt-targets__actions">
            {whatIf ? (
              <>
                <span className="tgt-whatif-note">What-if: the blue numbers are not real</span>
                <button type="button" className="tgt-reset" onClick={reset}>
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M3.5 8a4.5 4.5 0 1 0 1.4-3.25M3.5 2.75v2.5H6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Reset
                </button>
              </>
            ) : null}
            <div className="dash-views" role="group" aria-label="Order">
              {(
                [
                  ["funnel", "Funnel order"],
                  ["gap", "Biggest gap"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={order === value ? "dash-views__link is-on" : "dash-views__link"}
                  aria-pressed={order === value}
                  onClick={() => setOrder(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <ProfitSteps
          now={now}
          ours={ours}
          mode={mode}
          onNow={(key, value, typed) => setNowField(key, value, typed ?? false)}
          onOurs={setOursField}
          targets={targets}
          defaults={defaults}
          onTarget={(key, value) =>
            setStepTargets((t) => {
              const next = { ...t };
              if (value === null) delete next[key];
              else next[key] = value;
              return next;
            })
          }
          profitTargets={picked}
          costs={costs}
          order={order}
          anchor={anchor}
        />
      </section>
    </div>
  );
}
