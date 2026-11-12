"use client";

import { Fragment, useState } from "react";

import { figtree } from "@/fonts";

import "./riskModel.css";

/** Working draft of the risk model: ten risks, seen three ways. Nothing else from /risk is here on purpose. */

type AreaKey = "you" | "people" | "system" | "world";
type View = "danger" | "areas";

const AREAS: { key: AreaKey; name: string }[] = [
  { key: "you", name: "You" },
  { key: "system", name: "Your Systems" },
  { key: "people", name: "Your People" },
  { key: "world", name: "Your World" },
];

const RISKS = {
  keyPerson: { name: "Too reliant on you", area: "you", boss: "Owner Performance", q: "If I stopped for three months, what would stop with me?" },
  decisions: { name: "Bad decisions", area: "you", boss: "Owner Performance", q: "What do people here know that I don't want to hear?" },
  customers: { name: "Too few customers", area: "people", boss: "Revenue & Marketing", q: "If my top customer left, what would it cost?" },
  team: { name: "Weak team", area: "people", boss: "Team & Leadership", q: "Who could quit next week and leave us stuck?" },
  cash: { name: "Running out of cash", area: "system", boss: "Profit & Cash Flow", q: "How many weeks of cash do we have?" },
  profit: { name: "Sales but no profit", area: "system", boss: "Profit & Cash Flow", q: "After paying myself a fair wage, what do we really make?" },
  operations: { name: "Things keep breaking", area: "system", boss: "Infrastructure & Systems", q: "What keeps breaking, and who fixes it?" },
  legal: { name: "Legal and tax trouble", area: "world", boss: null, q: "Which letter or phone call would hurt most?" },
  market: { name: "The market moves on", area: "world", boss: "Defined Strategy", q: "What change out there would break this plan?" },
  exit: { name: "Can't sell or hand on", area: "world", boss: "Defined Strategy", q: "What would a buyer pay for this today?" },
} as const;

type RiskKey = keyof typeof RISKS;

const LEVELS = ["Overwhelm", "Overworked", "Organised", "Overseer", "Owner"];

// Bottom row first. Rows fill 4, 3, 2, 1.
const TIERS: { name: string; line: string; cells: RiskKey[] }[] = [
  { name: "Survive", line: "Stay in business", cells: ["keyPerson", "customers", "cash", "legal"] },
  { name: "Stabilise", line: "Make it hold up", cells: ["team", "operations", "profit"] },
  { name: "Steer", line: "See what's coming", cells: ["decisions", "market"] },
  { name: "Succeed", line: "Finish well", cells: ["exit"] },
];

// Laid out as a quadrant: people on the left, hard facts on the right.
const QUADRANT: { area: AreaKey; title: string; cells: RiskKey[] }[] = [
  { area: "you", title: "You", cells: ["keyPerson", "decisions"] },
  { area: "system", title: "Your Systems", cells: ["cash", "profit", "operations"] },
  { area: "people", title: "Your People", cells: ["customers", "team"] },
  { area: "world", title: "Your World", cells: ["legal", "market", "exit"] },
];

const VIEWS: { key: View; name: string }[] = [
  { key: "danger", name: "Pyramid" },
  { key: "areas", name: "Four areas" },
];

export function RiskModel() {
  const [view, setView] = useState<View>("danger");
  const [picked, setPicked] = useState<RiskKey>("cash");
  const [only, setOnly] = useState<AreaKey | null>(null);
  const risk = RISKS[picked];
  const area = AREAS.find((a) => a.key === risk.area)!;

  function cell(id: RiskKey) {
    const r = RISKS[id];
    const faded = only !== null && only !== r.area;
    return (
      <button
        key={id}
        type="button"
        className={`rm-cell rm-${r.area}${picked === id ? " is-on" : ""}${faded ? " is-faded" : ""}`}
        aria-pressed={picked === id}
        onClick={() => setPicked(id)}
        onMouseEnter={() => setPicked(id)}
        onFocus={() => setPicked(id)}
      >
        <span className="rm-cell-name">{r.name}</span>
      </button>
    );
  }

  return (
    <div className={`rm ${figtree.variable}`}>
      <div className="rm-wrap">
        <header className="rm-head">
          <p className="rm-eyebrow">Risk model, working draft</p>
          <h1>
            <span>Ten risks,</span> <strong>one picture.</strong>
          </h1>
        </header>

        <div className="rm-tabs">
          {VIEWS.map((v) => (
            <button key={v.key} type="button" className={view === v.key ? "is-on" : ""} aria-pressed={view === v.key} onClick={() => setView(v.key)}>
              {v.name}
            </button>
          ))}
        </div>
        {view === "danger" ? <p className="rm-viewline">Fix from the bottom up.</p> : null}

        <div className="rm-legend">
          {AREAS.map((a) => (
            <button
              key={a.key}
              type="button"
              className={only === a.key ? "is-on" : ""}
              aria-pressed={only === a.key}
              onClick={() => setOnly(only === a.key ? null : a.key)}
            >
              <i className={`rm-dot rm-${a.key}`} aria-hidden="true" />
              {a.name}
            </button>
          ))}
        </div>

        {view === "areas" ? (
          <div className="rm-quad">
            {QUADRANT.map((q) => (
              <section key={q.area} className="rm-quad-box">
                <h2>{q.title}</h2>
                <div className="rm-quad-cells">
                  {q.cells.map(cell)}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="rm-pyramid">
            {[3, 2, 1, 0].map((i) => {
              const tier = TIERS[i];
              return (
                <Fragment key={tier.name}>
                  <div className="rm-line">
                    <span>
                      <b>{i + 2}</b> {LEVELS[i + 1]}
                    </span>
                  </div>
                  <div className="rm-tier">
                    <div className="rm-tier-label">
                      <strong>{tier.name}</strong>
                      <span>{tier.line}</span>
                    </div>
                    <div className="rm-cells">
                      {tier.cells.map(cell)}
                    </div>
                  </div>
                </Fragment>
              );
            })}
            <div className="rm-line">
              <span>
                <b>1</b> {LEVELS[0]}
              </span>
            </div>
          </div>
        )}

        <div className="rm-readout" aria-live="polite">
          <p className="rm-readout-q">{risk.q}</p>
          <p className="rm-readout-meta">
            {risk.name}, {area.name}, {risk.boss ? `BOSS: ${risk.boss}` : "not in BOSS yet"}
          </p>
        </div>
      </div>
    </div>
  );
}
