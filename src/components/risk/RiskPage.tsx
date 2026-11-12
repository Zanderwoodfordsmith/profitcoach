"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, MoveRight } from "lucide-react";

import { figtree } from "@/fonts";

import data from "./riskData.json";
import "./risk.css";

type Risk = (typeof data.risks)[number];
type Thinker = (typeof data.thinkers)[number];
type Method = (typeof data.methods)[number];
type Basis = "stated" | "close" | "ours";

const RISK_ORDER = data.risks.map((r) => r.id);
const BASIS_WEIGHT: Record<Basis, number> = { stated: 3, close: 2, ours: 1 };
const BASIS_TEXT: Record<Basis, string> = {
  stated: "They call it a risk or a named danger.",
  close: "Their idea, in their own words. Our match is close.",
  ours: "Our reading. They do not link it to this.",
};

const CLASS_TEXT: Record<string, string> = {
  preventable: "You can prevent it",
  strategic: "You chose it",
  external: "It comes from outside",
};

/** Our own pairing of risks with methods and with the arguments that touch them. */
const RISK_METHODS: Record<string, string[]> = {
  OWNER: ["M12", "M22"],
  BLIND: ["M5", "M8", "M9", "M17"],
  SHOCK: ["M11", "M21", "M20"],
  BASKETS: ["M2", "M3", "M18"],
  CANTLOSE: ["M12", "M14"],
  CASH: ["M2", "M18", "M4"],
  PROFIT: ["M18", "M2"],
  OUTGROWN: ["M14", "M1"],
  TEAM: ["M9", "M5"],
  WORLD: ["M16", "M3", "M4"],
  RULES: ["M15", "M21", "M13"],
  EXIT: ["M19", "M11", "M20"],
};
const RISK_CLASHES: Record<string, number[]> = {
  OWNER: [3, 8],
  BLIND: [9, 11, 13],
  BASKETS: [1, 2, 7],
  CASH: [5, 6, 10],
  OUTGROWN: [4, 14],
  WORLD: [7, 12],
};

const LEVEL_TEXT: Record<string, string> = {
  Overwhelm: "Not knowing what to do next. Too many fires.",
  Overworked: "Exhausted from micromanaging, as the team isn't yet trained or systemised.",
  Organised: "Processes and training are in place, so things can run without you for a short time.",
  Overseer: "You manage overall performance and work on the business.",
  Owner: "Leadership runs the operation. You steer.",
};

const byRisk = new Map(data.risks.map((r) => [r.id, r]));
const byMethod = new Map(data.methods.map((m) => [m.id, m]));
const byThinker = new Map(data.thinkers.map((t) => [t.id, t]));
const linksFor = (thinker: string, risk: string) => data.links.filter((l) => l.thinker === thinker && l.risk === risk);
const strongest = (ls: { basis: string }[]): Basis | null => {
  let best: Basis | null = null;
  for (const l of ls) {
    const b = l.basis as Basis;
    if (!best || BASIS_WEIGHT[b] > BASIS_WEIGHT[best]) best = b;
  }
  return best;
};
const peopleOn = (risk: string) => new Set(data.links.filter((l) => l.risk === risk).map((l) => l.thinker)).size;
const mapped = data.thinkers.filter((t) => data.links.some((l) => l.thinker === t.id));

/** Renders **bold** and [text](url) from the data. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((p, i) => {
        const bold = p.match(/^\*\*(.+)\*\*$/);
        if (bold) return <strong key={i}>{bold[1]}</strong>;
        const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          return (
            <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">
              {link[1]}
            </a>
          );
        }
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

function Heading({ light, strong, id }: { light: string; strong: string; id?: string }) {
  return (
    <h2 className="rk-h2" id={id}>
      <span>{light}</span> <strong>{strong}</strong>
    </h2>
  );
}

function Mark({ basis }: { basis: Basis }) {
  return <span className={`rk-mark rk-mark-${basis}`} aria-hidden />;
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/** A row that slides sideways, with arrows and a progress line under it. */
function Rail({ children, label, tone }: { children: ReactNode; label: string; tone?: "dark" }) {
  const track = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setSeen(el.scrollWidth > 0 ? (el.clientWidth + el.scrollLeft) / el.scrollWidth : 1);
      setAtStart(el.scrollLeft < 4);
      setAtEnd(el.scrollLeft > max - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [children]);

  const move = (dir: 1 | -1) => {
    const el = track.current;
    const card = el?.firstElementChild;
    if (!el || !card) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * (card.getBoundingClientRect().width + 20) * 2, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className={`rk-rail ${tone === "dark" ? "rk-rail-dark" : ""}`}>
      <div className="rk-rail-track" ref={track}>
        {children}
      </div>
      <div className="rk-wrap rk-rail-controls">
        <span className="rk-rail-progress" aria-hidden>
          <span style={{ transform: `scaleX(${Math.min(1, seen)})` }} />
        </span>
        <span className="rk-rail-buttons">
          <button type="button" onClick={() => move(-1)} disabled={atStart} aria-label={`Previous ${label}`}>
            <ChevronLeft aria-hidden />
          </button>
          <button type="button" onClick={() => move(1)} disabled={atEnd} aria-label={`Next ${label}`}>
            <ChevronRight aria-hidden />
          </button>
        </span>
      </div>
    </div>
  );
}

function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { key: T; name: string }[]; label: string }) {
  return (
    <div className="rk-tabs" role="group" aria-label={label}>
      {items.map((t) => (
        <button key={t.key} type="button" aria-pressed={value === t.key} onClick={() => onChange(t.key)}>
          {t.name}
        </button>
      ))}
    </div>
  );
}

/* ---------- Hero ---------- */

function HeroMap() {
  // Every dot is a real link from the map below: one row per risk, one column per thinker.
  return (
    <div className="rk-heromap" aria-hidden>
      {data.risks.map((r, y) => (
        <div className="rk-heromap-row" key={r.id}>
          <span className="rk-heromap-label">{r.short}</span>
          <span className="rk-heromap-dots" style={{ gridTemplateColumns: `repeat(${mapped.length}, 1fr)` }}>
            {mapped.map((t, x) => {
              const b = strongest(linksFor(t.id, r.id));
              return <i key={t.id} className={b ? `is-${b}` : ""} style={b ? { animationDelay: `${(x + y * 2) * 14}ms` } : undefined} />;
            })}
          </span>
        </div>
      ))}
    </div>
  );
}

function Hero() {
  const stats = [
    { n: data.risks.length, t: "risks an owner can measure" },
    { n: data.thinkers.length, t: "thinkers and sources" },
    { n: data.links.length, t: "links, each with its source" },
    { n: data.clashes.length, t: "places they disagree" },
  ];
  return (
    <header className="rk-hero">
      <div className="rk-wrap">
        <p className="rk-eyebrow rk-eyebrow-light">The Risk Playbook</p>
        <h1 className="rk-h1">
          <span>What could sink the business?</span> <strong>Everyone has an answer. Here they are, side by side.</strong>
        </h1>
        <p className="rk-lead">
          Business thinkers warn about risk in their own words: traps, ceilings, crises, dangers. We lined them up against twelve shared risks, so you can see where they agree, where they fight and what they all miss. Then pick a
          way of managing it that suits the owner in front of you.
        </p>
        <div className="rk-hero-actions">
          <button type="button" className="rk-btn rk-btn-white" onClick={() => scrollToId("picker")}>
            Find A Method <MoveRight aria-hidden />
          </button>
          <button type="button" className="rk-link-light" onClick={() => scrollToId("map")}>
            See The Map <MoveRight aria-hidden />
          </button>
        </div>
        <HeroMap />
        <dl className="rk-stats">
          {stats.map((s) => (
            <div key={s.t}>
              <dt>{s.n}</dt>
              <dd>{s.t}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}

/* ---------- The twelve risks ---------- */

function RiskCard({ risk, active, onPick }: { risk: Risk; active: boolean; onPick: () => void }) {
  const ls = data.links.filter((l) => l.risk === risk.id);
  const order: Basis[] = ["stated", "close", "ours"];
  const sorted = [...ls].sort((a, b) => order.indexOf(a.basis as Basis) - order.indexOf(b.basis as Basis));
  return (
    <button type="button" className={`rk-riskcard rk-class-${risk.classKey}`} aria-pressed={active} onClick={onPick}>
      <span className="rk-riskcard-tag">{CLASS_TEXT[risk.classKey]}</span>
      <span className="rk-riskcard-q">{risk.question}</span>
      <span className="rk-riskcard-copy">
        <span className="rk-riskcard-title">{risk.name}</span>
        <span className="rk-riskcard-meaning">{risk.meaning}</span>
        <span className="rk-riskcard-dots" aria-label={`${peopleOn(risk.id)} thinkers speak to this`}>
          {sorted.map((l, i) => (
            <Mark key={i} basis={l.basis as Basis} />
          ))}
        </span>
      </span>
    </button>
  );
}

function RiskDetail({ risk, onMethod, onClash, onPerson }: { risk: Risk; onMethod: (id: string) => void; onClash: (n: number) => void; onPerson: (id: string) => void }) {
  const ls = data.links.filter((l) => l.risk === risk.id);
  const grouped: Basis[] = ["stated", "close", "ours"];
  const clashes = (RISK_CLASHES[risk.id] ?? []).map((n) => data.clashes.find((c) => c.n === n)!);
  return (
    <div className="rk-riskpanel" aria-live="polite">
      <div className="rk-riskpanel-main">
        <p className="rk-label">Ask the owner</p>
        <p className="rk-riskpanel-q">{risk.question}</p>
        <p className="rk-label">How to measure it</p>
        <p className="rk-prose">
          <Rich text={risk.measure} />
        </p>
        <div className="rk-factline">
          <div>
            <span>Closest BOSS area</span>
            {risk.boss}
          </div>
          <div>
            <span>What kind of risk</span>
            {risk.classLabel}
          </div>
        </div>
        <p className="rk-label">Methods to try</p>
        <div className="rk-chips">
          {RISK_METHODS[risk.id].map((id) => (
            <button key={id} type="button" className="rk-chip" onClick={() => onMethod(id)}>
              {byMethod.get(id)?.short}
            </button>
          ))}
        </div>
        {clashes.length > 0 && (
          <>
            <p className="rk-label">Where they disagree</p>
            <div className="rk-chips">
              {clashes.map((c) => (
                <button key={c.n} type="button" className="rk-chip" onClick={() => onClash(c.n)}>
                  {c.title}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="rk-riskpanel-who">
        <p className="rk-label">Who says what, in their own words</p>
        {ls.length < 4 && <p className="rk-note-inline">Few popular authors touch this. Their silence does not make it safe.</p>}
        <ul className="rk-saylist">
          {grouped.flatMap((b) =>
            ls
              .filter((l) => l.basis === b)
              .map((l, i) => {
                const t = byThinker.get(l.thinker);
                return (
                  <li key={`${b}${i}`}>
                    <Mark basis={b} />
                    <button type="button" onClick={() => onPerson(l.thinker)}>
                      {l.who || shortName(t?.name ?? "")}
                    </button>
                    <span>
                      <Rich text={l.word} />
                    </span>
                  </li>
                );
              }),
          )}
        </ul>
      </div>
    </div>
  );
}

function shortName(n: string) {
  return n.replace(/ \(.*\)$/, "");
}

function Risks({ risk, setRisk, onMethod, onClash, onPerson }: { risk: string; setRisk: (r: string) => void; onMethod: (id: string) => void; onClash: (n: number) => void; onPerson: (id: string) => void }) {
  const current = byRisk.get(risk)!;
  return (
    <section className="rk-section rk-white" id="risks">
      <div className="rk-wrap rk-head">
        <p className="rk-eyebrow">The Twelve Risks</p>
        <Heading light="Twelve ways a business gets hurt." strong="Pick one to open it." />
        <p className="rk-sub">
          Each dot on a card is a link to a thinker. The names and groups are ours. <Legend />
        </p>
      </div>
      <Rail label="risks">
        {data.risks.map((r) => (
          <RiskCard key={r.id} risk={r} active={r.id === risk} onPick={() => setRisk(r.id)} />
        ))}
      </Rail>
      <div className="rk-wrap" id="risk-detail">
        <h3 className="rk-riskpanel-title">{current.name}</h3>
        <RiskDetail risk={current} onMethod={onMethod} onClash={onClash} onPerson={onPerson} />
      </div>
    </section>
  );
}

function Legend() {
  return (
    <span className="rk-legend">
      <span>
        <Mark basis="stated" /> They call it a risk
      </span>
      <span>
        <Mark basis="close" /> Their idea, close match
      </span>
      <span>
        <Mark basis="ours" /> Our reading
      </span>
    </span>
  );
}

/* ---------- The map ---------- */

type Pointer = { thinker: string; risk: string };

function TheMap({ risk, setRisk, onPerson }: { risk: string; setRisk: (r: string) => void; onPerson: (id: string) => void }) {
  const [family, setFamily] = useState("all");
  const [point, setPoint] = useState<Pointer>({ thinker: "alex-hormozi", risk: "BASKETS" });
  const rowsShown = mapped.filter((t) => family === "all" || t.family === family);
  const pointed = linksFor(point.thinker, point.risk);
  const t = byThinker.get(point.thinker);
  const r = byRisk.get(point.risk);
  const crowd = (id: string) => peopleOn(id);
  const max = Math.max(...RISK_ORDER.map(crowd));

  return (
    <section className="rk-section rk-soft" id="map">
      <div className="rk-wrap rk-head">
        <p className="rk-eyebrow">The Map</p>
        <Heading light="Everyone on one page." strong="Their words, our links." />
        <p className="rk-sub">
          The idea comes from Ken Wilber&apos;s Integral Theory, which lines up different researchers against shared <a href="https://atpweb.org/jtparchive/trps-31-99-01-001.pdf" target="_blank" rel="noopener noreferrer">lines of development</a>. A firm can be strong on one
          line and weak on another, and each thinker is right about something and partial. Wilber calls his own charts <a href="https://www.paulhelfrich.com/library/Helfrich_P_AQAL_Overview.pdf" target="_blank" rel="noopener noreferrer">a ballpark</a>. Treat this one the same way. Tap any mark.
        </p>
        <Legend />
      </div>
      <div className="rk-wrap">
        <Tabs value={family} onChange={setFamily} label="Filter the map" items={[{ key: "all", name: "Everyone" }, ...data.families.map((f) => ({ key: f.key, name: f.name }))]} />
        <div className="rk-mapwrap">
        <div className="rk-readout" aria-live="polite">
          {pointed.length > 0 ? (
            <>
              <p className="rk-readout-who">
                <button type="button" onClick={() => onPerson(point.thinker)}>
                  {shortName(t?.name ?? "")}
                </button>{" "}
                on <button type="button" onClick={() => setRisk(point.risk)}>{r?.name}</button>
              </p>
              {pointed.map((l, i) => (
                <p className="rk-readout-word" key={i}>
                  <Mark basis={l.basis as Basis} /> {l.who && `${l.who}: `}
                  <Rich text={l.word} /> <em>{BASIS_TEXT[l.basis as Basis]}</em>
                </p>
              ))}
            </>
          ) : (
            <p className="rk-readout-who">
              We did not find {shortName(t?.name ?? "")} on {r?.name?.toLowerCase()}. That does not mean they deny it.
            </p>
          )}
        </div>
        <div className="rk-mapscroll" tabIndex={0} role="region" aria-label="Map of thinkers against risks">
          <table className="rk-map">
            <thead>
              <tr>
                <th className="rk-map-corner" scope="col">
                  Thinker
                </th>
                {data.risks.map((x) => (
                  <th key={x.id} scope="col" className={x.id === risk ? "is-on" : ""}>
                    <button type="button" onClick={() => setRisk(x.id)} title={x.name}>
                      <span>{x.short}</span>
                      <i style={{ height: `${Math.max(3, (crowd(x.id) / max) * 28)}px` }} />
                      <b>{crowd(x.id)}</b>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowsShown.map((row) => (
                <tr key={row.id} className={row.id === point.thinker ? "is-row" : ""}>
                  <th scope="row">
                    <button type="button" onClick={() => onPerson(row.id)}>
                      {shortName(row.name)}
                    </button>
                  </th>
                  {data.risks.map((x) => {
                    const b = strongest(linksFor(row.id, x.id));
                    const on = point.thinker === row.id && point.risk === x.id;
                    return (
                      <td key={x.id} className={x.id === risk ? "is-on" : ""}>
                        <button
                          type="button"
                          className={on ? "is-point" : ""}
                          onMouseEnter={() => setPoint({ thinker: row.id, risk: x.id })}
                          onFocus={() => setPoint({ thinker: row.id, risk: x.id })}
                          onClick={() => setPoint({ thinker: row.id, risk: x.id })}
                          aria-label={`${shortName(row.name)} on ${x.name}${b ? `: ${BASIS_TEXT[b]}` : ": not found"}`}
                        >
                          {b && <Mark basis={b} />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
        <div className="rk-trio">
          <div>
            <h3>The owner is the crowded square</h3>
            <p>
              Owner dependence and blind spots draw the most voices. Owner dependence also has the best research behind it: firms took <a href="https://wrap.warwick.ac.uk/147132/" target="_blank" rel="noopener noreferrer">large, lasting falls</a> when an entrepreneur died, and a CEO&apos;s{" "}
              <a href="https://econpapers.repec.org/RePEc:bla:jfinan:v:75:y:2020:i:4:p:1877-1911" target="_blank" rel="noopener noreferrer">hospital stay</a> cut profit and investment in Denmark. Neither study is UK.
            </p>
          </div>
          <div>
            <h3>Rules is nearly empty</h3>
            <p>Popular authors say little about tax, safety, data and personal liability. A plan built only from their books would leave an owner exposed here, so use the UK facts further down and bring in advisers.</p>
          </div>
          <div>
            <h3>Overlap is not proof</h3>
            <p>
              Some of these share roots. Churchill &amp; Lewis&apos;s respondents had all <a href="https://www.growthforce.com/hubfs/The_Five_Stages_of_Small_Business_Growth.pdf" target="_blank" rel="noopener noreferrer">read Greiner</a>, and the two Hormozis share a company. Few thinkers here call their ideas risk at all. That is why each mark keeps its own word.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Stages ---------- */

function Stages({ setRisk }: { setRisk: (r: string) => void }) {
  const [levelName, setLevel] = useState("Overworked");
  const level = data.levels.find((l) => l.name === levelName)!;
  return (
    <section className="rk-section rk-white" id="stages">
      <div className="rk-wrap rk-head">
        <p className="rk-eyebrow">Lines And Levels</p>
        <Heading light="Different risks get loud" strong="at different levels." />
        <p className="rk-sub">Each row lines up nine thinkers&apos; stages against the BOSS 5 Levels. The matches are ours. No author makes them.</p>
      </div>
      <div className="rk-wrap">
        <div className="rk-warning">
          <strong>A rough map, and no ladder.</strong> A review of all 104 stage models published from 1962 to 2006 found <a href="https://effectuation.org/hubfs/Journal%20Articles/2017/06/Levie_et_al-2010-Entrepreneurship_Theory_and_Practice-3.pdf?hsLang=en" target="_blank" rel="noopener noreferrer">&quot;no empirical confirmation of stages theory&quot;</a>. Firms can skip and slide back. So rate each area of the business and never the whole firm, and say &quot;finance is at Organised&quot; in place of &quot;you are an Overwhelm owner&quot;. Same height does not mean same idea.
        </div>
        <Tabs value={levelName} onChange={setLevel} label="Pick a level" items={data.levels.map((l) => ({ key: l.name, name: l.name }))} />
        <div className="rk-levelpanel" aria-live="polite">
          <div>
            <p className="rk-label">{level.name}</p>
            <p className="rk-levelpanel-desc">{LEVEL_TEXT[level.name]}</p>
          </div>
          <div>
            <p className="rk-label">Loudest here</p>
            <div className="rk-chips">
              {level.loud.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="rk-chip"
                  onClick={() => {
                    setRisk(id);
                    scrollToId("risk-detail");
                  }}
                >
                  {byRisk.get(id)?.short}
                </button>
              ))}
            </div>
            <p className="rk-prose rk-small">
              <Rich text={level.why} />
            </p>
          </div>
          <div>
            <p className="rk-label">Quiet, but rising</p>
            <p className="rk-prose rk-small">
              <Rich text={level.quiet} />
            </p>
          </div>
        </div>
        <div className="rk-stagescroll" tabIndex={0} role="region" aria-label="Stages lined up against the 5 Levels">
          <table className="rk-stage">
            <thead>
              <tr>
                <th scope="col">BOSS level</th>
                {data.stageCols.map((c, i) => (
                  <th scope="col" key={c}>
                    {c}
                    <small>{data.stageRuler[i]}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.levels.map((l) => (
                <tr key={l.name} className={l.name === levelName ? "is-on" : ""} onClick={() => setLevel(l.name)}>
                  <th scope="row">{l.name}</th>
                  {l.cols.map((c, i) => (
                    <td key={i}>
                      <Rich text={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="rk-foot">The small line under each name is what that thinker measures by. Those rulers differ, which is one reason the rows can only ever be rough.</p>
      </div>
    </section>
  );
}

/* ---------- Disagreements ---------- */

function Clashes({ flash }: { flash: number | null }) {
  return (
    <section className="rk-section rk-band" id="disagreements">
      <div className="rk-wrap rk-head">
        <p className="rk-eyebrow rk-eyebrow-light">Where They Disagree</p>
        <Heading light="They don't all agree." strong="That is the useful part." />
        <p className="rk-sub rk-sub-light">When two smart people differ, the choice is the owner&apos;s to make. Our view on each is ours, and open to argument.</p>
      </div>
      <Rail label="disagreements" tone="dark">
        {data.clashes.map((c) => (
          <article key={c.n} id={`clash-${c.n}`} className={`rk-clash ${flash === c.n ? "is-flash" : ""}`}>
            <h3>{c.title}</h3>
            <p className="rk-clash-sides">
              <Rich text={c.sides} />
            </p>
            <div className="rk-clash-view">
              <span>Our view</span>
              <p>
                <Rich text={c.view} />
              </p>
            </div>
          </article>
        ))}
      </Rail>
    </section>
  );
}

/* ---------- Picker + methods ---------- */

function MethodRow({ method, open, onToggle }: { method: Method; open: boolean; onToggle: () => void }) {
  return (
    <li id={`method-${method.id}`} className={`rk-method ${open ? "is-open" : ""}`}>
      <button type="button" className="rk-method-head" aria-expanded={open} onClick={onToggle}>
        <span className="rk-method-name">{method.name}</span>
        <span className="rk-method-time">
          <Rich text={method.time.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")} />
        </span>
        <span className={`rk-grade rk-grade-${method.level}`}>{GRADE[method.level]}</span>
        <ChevronDown aria-hidden className="rk-method-chev" />
      </button>
      {open && (
        <div className="rk-method-body">
          <div>
            <p className="rk-label">What it is</p>
            <p>
              <Rich text={method.what} />
            </p>
            <p className="rk-label">How to run it</p>
            <p>
              <Rich text={method.how} />
            </p>
            {method.id === "M9" && (
              <p className="rk-note-inline">
                A sorting tool some sources credit to Peter Senge. We have not traced it to a page in his books. We found it on <a href="https://tahltan.org/wp-content/uploads/2021/05/TCG_SpringNewsletter2021.pdf" target="_blank" rel="noopener noreferrer">two</a> <a href="https://www.billsynnotandassociates.com.au/kb/509-technique-1-28-discussability-of-issues.html" target="_blank" rel="noopener noreferrer">web pages</a>, and neither frames it as a risk tool.
              </p>
            )}
          </div>
          <div>
            <p className="rk-label">Suits</p>
            <p>
              <Rich text={method.suits} />
            </p>
            <p className="rk-label">Weak spots</p>
            <p>
              <Rich text={method.weak} />
            </p>
            <p className="rk-label">Evidence that it helps</p>
            <p>
              <Rich text={method.evidence} />
            </p>
          </div>
        </div>
      )}
    </li>
  );
}

const GRADE: Record<string, string> = { strong: "Strong", partial: "Partial", weak: "Weak", opinion: "Opinion" };

function Picker({ openMethod, setOpenMethod, onMethod }: { openMethod: string | null; setOpenMethod: (id: string | null) => void; onMethod: (id: string) => void }) {
  const [order, setOrder] = useState(11);
  const [mod, setMod] = useState<string | null>(null);
  const pick = data.picker.find((p) => p.order === order)!;
  const startM = pick.start.map((id) => byMethod.get(id)!);
  const thenM = pick.then.map((id) => byMethod.get(id)!);
  const modifier = data.modifiers.find((m) => m.label === mod);
  const prompts = useMemo(() => [...data.picker].sort((a, b) => (a.stop ? 1 : b.stop ? -1 : a.order - b.order)), []);
  return (
    <section className="rk-section rk-soft" id="picker">
      <div className="rk-wrap rk-head">
        <p className="rk-eyebrow">Find A Method</p>
        <Heading light="What is the owner saying?" strong="Start there." />
        <p className="rk-sub">There is no single right method. Pick by what the owner says, then let them choose. This logic is our judgement and has not been tested. We found no study showing any method here reduces failure in firms of £1M to £20M, so offer them as useful prompts.</p>
      </div>
      <div className="rk-wrap rk-picker">
        <div className="rk-prompts" role="group" aria-label="What the owner says">
          {prompts.map((p) => (
            <button key={p.order} type="button" aria-pressed={p.order === order} className={p.stop ? "is-stop" : ""} onClick={() => setOrder(p.order)}>
              {p.stop ? p.said : <>&ldquo;{p.said}&rdquo;</>}
            </button>
          ))}
        </div>
        <div className={`rk-result ${pick.stop ? "is-stop" : ""}`} aria-live="polite">
          <p className="rk-label rk-label-light">{pick.stop ? "Stop here first" : "Start with"}</p>
          {startM.map((m) => (
            <button key={m.id} type="button" className="rk-result-main" onClick={() => onMethod(m.id)}>
              {m.short} <MoveRight aria-hidden />
            </button>
          ))}
          {pick.note && (
            <p className="rk-result-note">
              <Rich text={pick.note} />
            </p>
          )}
          {thenM.length > 0 && (
            <>
              <p className="rk-label rk-label-light">Then add</p>
              <div className="rk-chips">
                {thenM.map((m) => (
                  <button key={m.id} type="button" className="rk-chip rk-chip-light" onClick={() => onMethod(m.id)}>
                    {m.short}
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="rk-label rk-label-light">Rough time</p>
          <p className="rk-result-time">{pick.time}</p>
          <p className="rk-label rk-label-light">Anything else true?</p>
          <div className="rk-chips">
            {data.modifiers.map((m) => (
              <button key={m.label} type="button" className="rk-chip rk-chip-light" aria-pressed={mod === m.label} onClick={() => setMod(mod === m.label ? null : m.label)}>
                {m.label}
              </button>
            ))}
          </div>
          {modifier && (
            <p className="rk-result-note">
              <Rich text={modifier.change} />
            </p>
          )}
        </div>
      </div>
      <div className="rk-wrap rk-methods">
        <div className="rk-methods-head">
          <h3>All {data.methods.length} methods</h3>
          <p>The grade rates evidence that the method helps. It says nothing on how good the idea sounds.</p>
        </div>
        <ul className="rk-methodlist">
          {data.methods.map((m) => (
            <MethodRow key={m.id} method={m} open={openMethod === m.id} onToggle={() => setOpenMethod(openMethod === m.id ? null : m.id)} />
          ))}
        </ul>
        <div className="rk-warning rk-warning-soft">
          <strong>A word on red, amber and green risk grids.</strong> A grid is fine for a conversation and weak for ranking or spending. Cox shows typical grids can compare <a href="https://econpapers.repec.org/RePEc:wly:riskan:v:28:y:2008:i:2:p:497-512" target="_blank" rel="noopener noreferrer">fewer than 10% of random pairs of hazards correctly</a>, though that is the maths and no field trial shows firms that dropped them did better. Ask this instead: what would it cost in pounds, and how many months of cash would it take? The BOSS Grid is a different thing. It rates how mature an area is, not how likely a risk is.
        </div>
      </div>
    </section>
  );
}

/* ---------- People ---------- */

function frameWord(f: string) {
  const w = f.split(/[ ,.]/)[0];
  if (w === "Yes") return "yes";
  if (w === "No" || w === "Not") return "no";
  return "partly";
}
const FRAME_TEXT: Record<string, string> = { yes: "Calls it risk", partly: "Partly calls it risk", no: "Uses other words" };

function People({ flash }: { flash: string | null }) {
  const [family, setFamily] = useState("all");
  const shown = data.thinkers.filter((t) => family === "all" || t.family === family || t.id === flash);
  return (
    <section className="rk-section rk-white" id="people">
      <div className="rk-wrap rk-head">
        <p className="rk-eyebrow">The People</p>
        <Heading light="Who said what," strong="and how sure we are." />
        <p className="rk-sub">Strong means we read the original. Medium means their own site, talk or article. Weak means summaries or reader notes. We read almost none of the books themselves, so check a quote before you use it.</p>
        <Tabs value={family} onChange={setFamily} label="Filter people" items={[{ key: "all", name: "Everyone" }, ...data.families.map((f) => ({ key: f.key, name: f.name }))]} />
      </div>
      <Rail label="people">
        {shown.map((t: Thinker) => {
          const frame = frameWord(t.frames);
          return (
            <article key={t.id} id={`person-${t.id}`} className={`rk-person ${flash === t.id ? "is-flash" : ""}`}>
              <div className="rk-person-top">
                <span className={`rk-frame rk-frame-${frame}`}>{FRAME_TEXT[frame]}</span>
                <span className={`rk-strength rk-strength-${t.strengthLevel}`}>{t.strengthLevel}</span>
              </div>
              <h3>{t.name}</h3>
              <p className="rk-person-work">{t.work.replace(/\*/g, "")}</p>
              <p className="rk-person-idea">
                <Rich text={t.idea} />
              </p>
              <div className="rk-person-ask">
                <span>Try this</span>
                <p>
                  <Rich text={t.tool} />
                </p>
              </div>
              <p className="rk-person-source">
                <Rich text={t.strength.replace(/^(Strong|Medium|Weak)( to medium)?[,.:]?\s*/i, "")} />
              </p>
            </article>
          );
        })}
      </Rail>
    </section>
  );
}

/* ---------- Rhythm ---------- */

function Rhythm() {
  const [who, setWho] = useState<"coach" | "owner">("coach");
  return (
    <section className="rk-section rk-band" id="rhythm">
      <div className="rk-wrap rk-head">
        <p className="rk-eyebrow rk-eyebrow-light">The Risk Rhythm</p>
        <Heading light="One short habit" strong="that fits a coaching year." />
        <p className="rk-sub rk-sub-light">
          <strong>This is our own suggestion and it has not been tested.</strong> Worries become numbers, numbers become three choices, and choices get checked. The owner keeps the decisions. The coach keeps the rhythm. It needs about half a day to start.
        </p>
        <Tabs
          value={who}
          onChange={setWho}
          label="Show the job of"
          items={[
            { key: "coach", name: "I'm the coach" },
            { key: "owner", name: "I'm the owner" },
          ]}
        />
      </div>
      <div className="rk-wrap">
        <ol className="rk-steps">
          {data.steps.map((s) => (
            <li key={s.step}>
              <h3>{s.step}</h3>
              <p>
                <Rich text={who === "coach" ? s.coach : s.owner} />
              </p>
              <span>You end with</span>
              <p className="rk-steps-out">
                <Rich text={s.output} />
              </p>
            </li>
          ))}
        </ol>
        <h3 className="rk-after">After that</h3>
        <ul className="rk-cadence">
          {data.cadence.map((c) => (
            <li key={c.when}>
              <strong>{c.when}</strong>
              <span>
                <Rich text={who === "coach" ? c.coach : c.owner} />
              </span>
              <em>{c.time}</em>
            </li>
          ))}
        </ul>
        <p className="rk-foot rk-foot-light">
          Short of time? At Overwhelm or Overworked, run the four steps on cash and owner dependence alone. The aim is an owner who can run this without a coach by year two. We would track months of cash, top customer share and weeks the owner can be away, which shows movement but cannot show the process caused it.
        </p>
      </div>
    </section>
  );
}

/* ---------- Evidence ---------- */

function Evidence() {
  const [tab, setTab] = useState<"safe" | "avoid" | "who">("safe");
  return (
    <section className="rk-section rk-soft" id="evidence">
      <div className="rk-wrap rk-head">
        <p className="rk-eyebrow">The Evidence</p>
        <Heading light="What you can say to an owner," strong="and what to stop saying." />
        <p className="rk-sub">
          <strong>The honest line on coaching:</strong> there is good evidence outside help can improve how a business runs. Evidence that it stops firms failing is thin. Figures checked on 6 November 2026. Insolvency figures change every month, so check the latest before you quote one.
        </p>
        <Tabs
          value={tab}
          onChange={setTab}
          label="Evidence"
          items={[
            { key: "safe", name: "Safe to quote" },
            { key: "avoid", name: "Stop quoting these" },
            { key: "who", name: "Who really said it" },
          ]}
        />
      </div>
      <div className="rk-wrap">
        {tab === "safe" && (
          <>
            <ul className="rk-evlist">
              {data.figures.map((f) => (
                <li key={f.topic + f.say}>
                  <span className="rk-evlist-topic">{f.topic}</span>
                  <p>
                    <Rich text={f.say} />
                    <small>
                      <Rich text={f.source} /> ({f.date}). <Rich text={f.caveat} />
                    </small>
                  </p>
                </li>
              ))}
            </ul>
            <h3 className="rk-evhead">From the research, mostly outside the UK</h3>
            <ul className="rk-evlist">
              {data.research.map((f) => (
                <li key={f.topic}>
                  <span className="rk-evlist-topic">{f.topic}</span>
                  <p>
                    <Rich text={f.say.replace(/"/g, "")} />
                    <small>
                      <Rich text={f.source} />. <Rich text={f.limit} />
                    </small>
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
        {tab === "avoid" && (
          <ul className="rk-evlist">
            {data.donts.map((d) => (
              <li key={d.claim}>
                <span className="rk-evlist-topic rk-evlist-claim">{d.claim.replace(/"/g, "")}</span>
                <p>
                  <Rich text={d.why} />
                </p>
              </li>
            ))}
          </ul>
        )}
        {tab === "who" && (
          <ul className="rk-evlist">
            {data.fixes.map((d) => (
              <li key={d.claim}>
                <span className="rk-evlist-topic rk-evlist-claim">{d.claim.replace(/"/g, "")}</span>
                <p>
                  <Rich text={d.fix} />
                  <small>
                    <Rich text={d.source} />
                  </small>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ---------- Page ---------- */

const NAV = [
  ["risks", "Risks"],
  ["map", "Map"],
  ["stages", "Levels"],
  ["disagreements", "Disagreements"],
  ["picker", "Methods"],
  ["people", "People"],
  ["rhythm", "Rhythm"],
  ["evidence", "Evidence"],
];

export function RiskPage() {
  const [risk, setRisk] = useState("OWNER");
  const [openMethod, setOpenMethod] = useState<string | null>(null);
  const [flashClash, setFlashClash] = useState<number | null>(null);
  const [flashPerson, setFlashPerson] = useState<string | null>(null);

  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const toMethod = (id: string) => {
    setOpenMethod(id);
    requestAnimationFrame(() => scrollToId(`method-${id}`));
  };
  const toClash = (n: number) => {
    setFlashClash(n);
    requestAnimationFrame(() => document.getElementById(`clash-${n}`)?.scrollIntoView({ behavior: reduce() ? "auto" : "smooth", block: "center", inline: "start" }));
  };
  const toPerson = (id: string) => {
    setFlashPerson(id);
    requestAnimationFrame(() => document.getElementById(`person-${id}`)?.scrollIntoView({ behavior: reduce() ? "auto" : "smooth", block: "center", inline: "start" }));
  };
  const pickRisk = (id: string) => setRisk(id);

  return (
    <div className={`rk ${figtree.variable}`}>
      <nav className="rk-nav" aria-label="Page">
        <div className="rk-wrap rk-nav-inner">
          <Link href="/" className="rk-logo" aria-label="The Profit Coach home">
            <Image src="/profit-coach-logo.svg" alt="The Profit Coach" width={148} height={36} priority />
          </Link>
          <div className="rk-nav-links">
            {NAV.map(([id, name]) => (
              <a key={id} href={`#${id}`}>
                {name}
              </a>
            ))}
          </div>
          <Link href="/score" className="rk-btn rk-btn-navy rk-nav-cta">
            Get Your BOSS Score
          </Link>
        </div>
      </nav>
      <Hero />
      <main>
        <Risks risk={risk} setRisk={pickRisk} onMethod={toMethod} onClash={toClash} onPerson={toPerson} />
        <TheMap risk={risk} setRisk={pickRisk} onPerson={toPerson} />
        <Stages setRisk={pickRisk} />
        <Clashes flash={flashClash} />
        <Picker openMethod={openMethod} setOpenMethod={setOpenMethod} onMethod={toMethod} />
        <People flash={flashPerson} />
        <Rhythm />
        <Evidence />
        <section className="rk-section rk-white" id="how">
          <div className="rk-wrap rk-how">
            <div>
              <p className="rk-eyebrow">How We Made This</p>
              <Heading light="A first draft," strong="and we say so." />
            </div>
            <div className="rk-prose">
              <p>
                One reader, working with AI, mapped these thinkers from their talks, articles, summaries and original papers where we could get them. Nobody has checked the mapping a second time, and we read almost none of the books. Every mark has a source, so you can check it yourself. Tell us where we got it wrong.
              </p>
              <p>Say this: we sorted what these thinkers teach against shared risk types, so you can see where they overlap, where they disagree and what is left out. Please avoid saying the great minds all agree, or that any method here prevents failure.</p>
              <p>This page is general information. It is not legal, tax, insurance or financial advice. For those, send the owner to an adviser.</p>
            </div>
          </div>
        </section>
        <section className="rk-close">
          <div className="rk-wrap">
            <Heading light="Risk is one lens." strong="See the whole business." />
            <p>The BOSS Score looks at 10 areas of the business, including the owner. It is free and takes a few minutes.</p>
            <Link href="/score" className="rk-btn rk-btn-white">
              Get Your BOSS Score <MoveRight aria-hidden />
            </Link>
          </div>
        </section>
      </main>
      <footer className="rk-footer">
        <div className="rk-wrap">
          <Image src="/brand/profit-coach-logo-white.svg" alt="The Profit Coach" width={130} height={32} />
          <p>Less chaos. More profit. Real freedom.</p>
        </div>
      </footer>
    </div>
  );
}
