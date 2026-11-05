"use client";

import { useEffect, useState } from "react";

import { TargetTip } from "@/components/profitLevers/targets/TargetTip";
import { supabaseClient } from "@/lib/supabaseClient";
import { labelRows } from "@/lib/profitTargets";
import {
  DEFAULT_PICKED,
  DEFAULT_TARGETS,
  GREAT,
  STARTING,
  TARGET_OPTIONS,
  amount,
  incomeText,
  percent,
  rateText,
  readSaved,
  signEveryWeeks,
  storageKey,
  targetLabel,
  volumesOf,
  weeksText,
  type Numbers,
  type RateKey,
  type Saved,
} from "@/lib/scoreboard";

import { ScoreboardSteps } from "./ScoreboardSteps";

import "@/components/profitLevers/targets/targets.css";

const SAME = 1e-9;

function same(a: Numbers, b: Numbers): boolean {
  return (Object.keys(a) as Array<keyof Numbers>).every((key) => Math.abs(a[key] - b[key]) < SAME);
}

/**
 * The coach Scoreboard: the BCA dashboard's Targets tab for a coach's own practice. One view (Zander, 2 Nov 2026):
 * it starts at good numbers (the targets), Great jumps to what the new scripts aim for, and any drag is a what-if
 * against good, in blue. Typing their own numbers comes later, with real data. Income targets a month set every
 * tick; those and any moved targets are kept on this device.
 */
export function ScoreboardBoard() {
  const now = STARTING;
  const [ours, setOurs] = useState<Numbers>(STARTING);
  const [order, setOrder] = useState<"funnel" | "gap">("funnel");
  const [picked, setPicked] = useState<number[]>(DEFAULT_PICKED);
  const [key, setKey] = useState<string | null>(null);
  // Saved only once the coach changes something, so starting numbers never get stuck on a device.
  const [edited, setEdited] = useState(false);

  // Load what this coach saved on this device, once we know who they are.
  useEffect(() => {
    let live = true;
    supabaseClient.auth.getSession().then(({ data }) => {
      if (!live) return;
      const storage = storageKey(data.session?.user.id ?? null);
      const saved = readSaved(window.localStorage.getItem(storage));
      if (saved) {
        setOurs(saved.now);
        setPicked(saved.picked);
      }
      setKey(storage);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!key || !edited) return;
    const saved: Saved = { now: ours, targets: {}, picked };
    window.localStorage.setItem(key, JSON.stringify(saved));
  }, [key, edited, ours, picked]);

  const targets = DEFAULT_TARGETS;
  const whatIf = !same(now, ours);
  // Good and Great set the rates; amounts typed or dragged stay as they are.
  const rates = Object.keys(DEFAULT_TARGETS) as RateKey[];
  const ratesAt = (set: Record<RateKey, number>) => rates.every((rate) => Math.abs(ours[rate] - set[rate]) < SAME);
  const atGood = ratesAt(DEFAULT_TARGETS);
  const atGreat = ratesAt(GREAT);
  const applyRates = (set: Record<RateKey, number>) => {
    setEdited(true);
    setOurs((o) => ({ ...o, ...set }));
  };
  const shownPicked = [...picked].sort((a, b) => a - b);

  const setOursField = (field: keyof Numbers, value: number) => {
    setEdited(true);
    setOurs((o) => ({ ...o, [field]: value }));
  };

  const monthNow = volumesOf(now);
  const monthOurs = volumesOf(ours);
  const incomeNow = monthNow.income;
  const incomeOurs = monthOurs.income;
  const shownIncome = whatIf ? incomeOurs : incomeNow;
  const shownMonth = whatIf ? monthOurs : monthNow;
  const top = Math.max(...shownPicked, incomeNow, incomeOurs, 1);
  const at = (value: number) => `${Math.min(Math.max(value / top, 0) * 100, 100)}%`;
  const tickRows = labelRows(shownPicked.map((target) => target / top), 0.22);

  return (
    <div className="dash tgt pl-board">
      <div className="tgt-controls">
        <div className="tgt-controls__group" role="group" aria-label="Income targets a month to compare">
          <span className="tgt-controls__label">Income targets a month</span>
          <div className="tgt-chips">
            {TARGET_OPTIONS.map((target) => {
              const on = picked.includes(target);
              return (
                <button
                  key={target}
                  type="button"
                  aria-pressed={on}
                  className={on ? "tgt-chip is-on" : "tgt-chip"}
                  onClick={() => {
                    setEdited(true);
                    setPicked((list) => (on ? (list.length > 1 ? list.filter((value) => value !== target) : list) : [...list, target]));
                  }}
                >
                  <span className="tgt-chip__check" aria-hidden="true" />
                  {targetLabel(target)}
                </button>
              );
            })}
          </div>
        </div>
        <div className="tgt-controls__group">
          <span className="tgt-controls__range">Saved on this device</span>
        </div>
      </div>

      <section className="tgt-hero" aria-label="Income a month, against your targets">
        <div className="tgt-hero__figure">
          <span className="tgt-hero__label">Income a month at these numbers</span>
          <span className="tgt-hero__value">
            {whatIf ? <span className="pl-hero-was">{incomeText(incomeNow)} →</span> : null}
            <span className={whatIf ? "pl-hero-whatif" : undefined}>{incomeText(shownIncome)}</span>
          </span>
          <span className="tgt-hero__sub">
            ({amount(shownMonth.clients)} clients at {rateText("fee", whatIf ? ours.fee : now.fee)} · a new client every{" "}
            {weeksText(signEveryWeeks(shownMonth.newClients))})
          </span>
        </div>
        <div className={tickRows.includes(1) ? "tgt-meter pl-two-rows" : "tgt-meter"}>
          <div className="tgt-meter__track">
            <span className="tgt-meter__stack" style={{ width: at(Math.max(incomeNow, whatIf ? incomeOurs : 0)) }}>
              <span
                className="tgt-meter__part is-new"
                style={{ flexGrow: Math.max(Math.min(incomeNow, whatIf ? incomeOurs : incomeNow), 0) }}
                title={`Now: ${incomeText(incomeNow)}`}
              />
              {whatIf && incomeOurs > incomeNow ? (
                <span className="tgt-meter__part is-plan" style={{ flexGrow: incomeOurs - incomeNow }} title={`What-if: ${incomeText(incomeOurs)}`} />
              ) : null}
            </span>
            {shownPicked.map((target, i) => (
              <span
                key={target}
                className={`tgt-meter__tick${target / top > 0.9 ? " is-end" : ""}${tickRows[i] ? " is-up" : ""}`}
                style={{ left: at(target) }}
              >
                <span className="tgt-meter__tick-label">
                  {targetLabel(target)} <span className="sb-tick-share">{percent(Math.max(shownIncome, 0) / target)}</span>
                </span>
              </span>
            ))}
          </div>
          <ul className="tgt-meter__legend">
            <li>
              <span className="tgt-meter__swatch is-new" aria-hidden="true" />
              Now <strong>{incomeText(incomeNow)}</strong>
            </li>
            {whatIf ? (
              <li>
                <span className="tgt-meter__swatch is-plan" aria-hidden="true" />
                What-if <strong>{incomeText(incomeOurs)}</strong>
              </li>
            ) : null}
          </ul>
        </div>
      </section>

      <section className="tgt-panel tgt-targets" aria-label="What if">
        <div className="tgt-panel__head tgt-targets__head">
          <div className="pl-head-start">
            <h2 className="tgt-panel__title tgt-targets__title">
              What if
              <TargetTip tip="It starts at Good: your targets. Great is what the new scripts aim for. Type a number or drag any dot or month bar to see what changes. Red is below Good, yellow is Good, green is Great.">
                <svg className="tgt-step-name__icon" viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M8 7.2v3.8M8 4.9v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </TargetTip>
            </h2>
            <div className="dash-views" role="group" aria-label="Starting numbers">
              <button
                type="button"
                className={atGood ? "dash-views__link is-on" : "dash-views__link"}
                aria-pressed={atGood}
                title="Your targets: 1% outbound, and 10 interested become 1 client."
                onClick={() => applyRates(DEFAULT_TARGETS)}
              >
                Good
              </button>
              <button
                type="button"
                className={atGreat ? "dash-views__link is-on" : "dash-views__link"}
                aria-pressed={atGreat}
                title="What the new scripts aim for: 2% outbound, 80% book, 100% fit and 50% close, so 10 interested become 4 clients."
                onClick={() => applyRates(GREAT)}
              >
                Great
              </button>
            </div>
          </div>
          <div className="tgt-targets__actions">
            {whatIf ? <span className="tgt-whatif-note">What-if: the blue numbers are not real</span> : null}
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

        <ScoreboardSteps
          now={now}
          ours={ours}
          onOurs={setOursField}
          targets={targets}
          picked={shownPicked}
          order={order}
        />
      </section>
    </div>
  );
}
