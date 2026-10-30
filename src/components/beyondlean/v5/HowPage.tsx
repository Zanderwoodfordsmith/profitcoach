import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, DoorOpen, Factory, FileText, Handshake, Route, TrendingDown, UserRound, UserX, X, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BossWheel } from "@/components/BossCharts/BossWheel";
import { BOOK_HREF, CALL_AGENDA, EXAMPLE_AREA_SCORES, EXAMPLE_TOTAL, SCORE_HREF } from "../data";
import { AREAS, PLAYBOOKS } from "@/lib/bossData";
import { getAllPlaybookSummaries } from "@/lib/playbookContent";
import { AREA_TRANSFORMATIONS } from "@/lib/profitSystemCopy";
import { getCaseStudies } from "@/lib/beyondlean/content";
import { CaseRow } from "./CaseRow";
import { CloseCard, FaqSection, Heading, HOME, V5Shell } from "./parts";
import "./how.css";
import "./how2.css";

/**
 * How it works, rebuilt (30 Oct) in the home page's language: the home page's three step cards, opened up into
 * three chapters with the same photos, the same hero, the same glass and the same navy. One idea per section.
 */

/** BCA's three pillars, as named in the app; Owner Performance is the foundation under them. */
const PILLAR_NAMES: Record<string, string> = {
  foundation: "Foundation",
  vision: "Clarify Vision",
  velocity: "Control Velocity",
  value: "Create Value",
};

/** Area names on two lines: break after "&", otherwise at the first space. */
function twoLines(name: string): [string, string] {
  const amp = name.indexOf(" & ");
  if (amp > 0) return [name.slice(0, amp + 2), name.slice(amp + 3)];
  const sp = name.indexOf(" ");
  return sp > 0 ? [name.slice(0, sp), name.slice(sp + 1)] : [name, ""];
}

function AreaName({ name, className }: { name: string; className: string }) {
  const [a, b] = twoLines(name);
  return (
    <span className={className}>
      <span>{a}</span>
      <span>{b}</span>
    </span>
  );
}

/** The five levels, with the BCA site's colours, icons and words (public/site-v4/index.html). */
const OWNER_LEVELS = [
  {
    id: 1,
    name: "Overwhelm",
    line: "Fires every day. It's hard to think past this week.",
    more: "You don't know what to do next, and there are too many fires to run even the day-to-day.",
    color: "#DC2626",
    icon: "overwhelm",
  },
  {
    id: 2,
    name: "Overworked",
    line: "It works because you work. The team waits on you.",
    more: "You're worn out from checking everything, because the team isn't trained or set up to run it yet.",
    color: "#F97316",
    icon: "overworked",
  },
  {
    id: 3,
    name: "Organised",
    line: "Processes are in place. It runs without you, for a while.",
    more: "Processes and training are in place, so things can run without you, at least for a while.",
    color: "#EAB308",
    icon: "organised",
  },
  {
    id: 4,
    name: "Overseer",
    line: "Leaders own their areas. You steer the business.",
    more: "You manage how the business performs and work on it, not just in it.",
    color: "#22C55E",
    icon: "overseer",
  },
  {
    id: 5,
    name: "Owner",
    line: "The business runs, grows and pays you. You choose your role.",
    more: "Your leaders run the operation. You steer, with very little of the day-to-day.",
    color: "#238BF7",
    icon: "owner",
  },
];

/** "Focus, Purpose, Ideal Customer and 7 more": the playbooks that live at one level. */
function levelBooks(level: number) {
  const names = PLAYBOOKS.filter((p) => p.level === level).map((p) => p.name);
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
}

type FitItem = { title: string; text: string; icon: LucideIcon };

const FIT_YES: FitItem[] = [
  { title: "An owner-run business", text: "You own a UK business with a team, usually 10 to 50 people.", icon: Factory },
  { title: "It all lands on you", text: "Every decision and problem still comes back to you.", icon: UserRound },
  { title: "Busy, but the profit doesn't show", text: "The work is there. What's left at the end isn't.", icon: TrendingDown },
  { title: "Ready to do your part", text: "You'll make the changes and want results you can measure.", icon: Handshake },
];

const FIT_NO: FitItem[] = [
  { title: "Not ready to change", text: "You aren't willing to change how you work yourself.", icon: UserX },
  { title: "Looking to hand it over", text: "You want someone to take the business off your hands.", icon: DoorOpen },
  { title: "After a quick fix", text: "You want results with no work from you or the team.", icon: Zap },
  { title: "After a report", text: "You want a report on your desk, not someone working beside you.", icon: FileText },
];

/** Owner Performance has no line in the shared copy; the other nine come from AREA_TRANSFORMATIONS. */
const OWNER_SHIFT = { from: "Stretched thin", to: "Clear head, more time" };

/** Paul's Standard Business Roadmap (content/beyondlean/blog/standard-business-roadmap.md). */
const ROADMAP = [
  { title: "Diagnostic", text: "Where you are now", note: "Steps 1 and 2", tone: "done" },
  { title: "Stability", text: "Control of the basics", note: "Your 90 days start here", tone: "start" },
  { title: "Strategy", text: "Where you're going" },
  { title: "Action", text: "The changes, with your team" },
  { title: "Evaluation", text: "What changed, measured" },
];

const PROMISES = [
  { title: "Measured before and after", text: "We set the numbers at the start, so you see exactly what changed." },
  { title: "Side by side", text: "I work with you and your team, in person or on Zoom. Not a report left on your desk." },
  { title: "Built to last", text: "Your team learns the new way of working, so it keeps going without me." },
];

const LEAVE_WITH = ["The one thing holding the business back", "One to three things to do next", "Your notes, yours to keep"];

function Hero() {
  return (
    <section className="v5-hero v5-hero-photo h7-hero" aria-labelledby="h7-title" data-motion-hero>
        <div className="v5-hero-bg" aria-hidden>
          <Image src="/beyondlean/paul-whiteboard.jpg" alt="" fill sizes="100vw" priority />
        </div>
        <div className="v5-wrap v5-hero-grid">
          <div className="v5-hero-copy">
            <p className="v5-badge is-outline">
              <Route aria-hidden /> How It Works
            </p>
            <h1 id="h7-title">
              <span>Find the one thing.</span> <span>Fix it for good.</span>
            </h1>
            <p className="v5-hero-lede is-short">
              Three steps, from a free score to a business that runs without you chasing it.
            </p>
            <div className="v5-hero-actions">
              <a className="v5-cbtn v5-cbtn-blue" href={BOOK_HREF}>
                Book a Call
              </a>
              <a className="v5-link-light" href={SCORE_HREF}>
                Score Your Business <ArrowRight aria-hidden />
              </a>
            </div>
          </div>
        </div>
    </section>
  );
}

/** Step 1: the owner at his desk with the wheel laid over the corner, then the ten areas as big letters. */
function ScoreStep() {
  // + | ADD | PRO FIT: the foundation and the three pillars, PRO and FIT kept close so PROFIT reads as one word
  const groups = [
    { pillar: "foundation", gap: "", areas: AREAS.slice(0, 1) },
    { pillar: "vision", gap: "is-gap-lg", areas: AREAS.slice(1, 4) },
    { pillar: "velocity", gap: "is-gap-lg", areas: AREAS.slice(4, 7) },
    { pillar: "value", gap: "is-gap-sm", areas: AREAS.slice(7) },
  ];
  return (
    <section id="score" className="v5-section v5-white h7-score" aria-labelledby="h7-score-title">
      <div className="v5-wrap h7-split">
        <figure className="h7-media" data-reveal>
          <div className="h7-photo is-wide">
            <Image src="/beyondlean/owner-laptop.jpg" alt="An owner taking his BOSS Score at his desk" fill sizes="(max-width: 900px) 100vw, 680px" />
          </div>
          <div className="h7-wheel-card">
            <BossWheel
              areaScores={EXAMPLE_AREA_SCORES}
              totalScore={EXAMPLE_TOTAL}
              showLegend={false}
              size="compact"
              aria-label="Example BOSS wheel across ten business areas"
            />
          </div>
        </figure>
        <div className="h7-copy" data-reveal>
          <p className="v5-eyebrow">Step 1</p>
          <Heading id="h7-score-title" light="Score it." strong="See where the business leaks." />
          <p className="h7-text">
            Thirteen quick questions give you a score out of 100 across the ten areas every business runs on, from cash
            and sales to your team and you. It&apos;s free and takes a few minutes.
          </p>
          <Link className="v5-orbit-btn" href={SCORE_HREF}>
            Get My BOSS Score <ArrowRight aria-hidden />
          </Link>
        </div>
      </div>

      <div className="v5-wrap h7-letters-wrap">
        <p className="h7-letters-intro">Ten areas in three pillars, built on one foundation: you. Read the letters.</p>
        <ul className="h7-letters">
          {groups.map((g) => (
            <li key={g.pillar} className={`h7-letter-group is-${g.pillar} ${g.gap}`}>
              <p className="h7-pillar">{PILLAR_NAMES[g.pillar]}</p>
              <ul>
                {g.areas.map((a) => {
                  const shift = a.id === 0 ? OWNER_SHIFT : AREA_TRANSFORMATIONS[a.id];
                  return (
                    <li key={a.id} className={`h7-letter is-${a.pillar}`} tabIndex={0}>
                      <span className="h7-letter-mark" aria-hidden>
                        {a.code}
                      </span>
                      <AreaName name={a.name} className="h7-letter-name" />
                      {shift && (
                        <span className="h7-letter-shift">
                          {shift.from} <ArrowRight aria-hidden /> <strong>{shift.to}</strong>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Step 2: the navy band. Paul with an owner, the 30 minutes laid over the photo's corner. */
function CallStep() {
  return (
    <section id="talk" className="v5-phases h7-call" aria-labelledby="h7-call-title">
      <svg className="v5-phases-arcs" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <circle cx="1240" cy="980" r="640" />
        <circle cx="160" cy="-160" r="520" />
      </svg>
      <div className="v5-wrap h7-split is-flip">
        <div className="h7-copy" data-reveal>
          <p className="v5-eyebrow">Step 2</p>
          <Heading id="h7-call-title" light="Find it." strong="The one thing holding you back." />
          <p className="h7-text">
            Every business has one thing that sets the pace for everything else, like the slowest machine on a line. On
            a free 30-minute call, we find yours using your score and your numbers.
          </p>
          <ul className="h7-leave">
            {LEAVE_WITH.map((l) => (
              <li key={l}>
                <Check aria-hidden /> {l}
              </li>
            ))}
          </ul>
          <p className="h7-note">If I can&apos;t help, I&apos;ll tell you.</p>
          <a className="v5-orbit-btn is-on-dark" href={BOOK_HREF}>
            Book a Call <ArrowRight aria-hidden />
          </a>
        </div>
        <figure className="h7-media" data-reveal>
          <div className="h7-photo is-tall">
            <Image src="/beyondlean/paul-score.jpg" alt="Paul going through a score with an owner" fill sizes="(max-width: 900px) 100vw, 520px" />
          </div>
          <div className="h7-agenda">
            <p>In the 30 minutes</p>
            <ol>
              {CALL_AGENDA.map((a, i) => (
                <li key={a.title}>
                  <span aria-hidden>{i + 1}</span>
                  {a.title}
                </li>
              ))}
            </ol>
          </div>
        </figure>
      </div>
    </section>
  );
}

/** Step 3: one wide photo with the five-stop roadmap on a panel across its foot, then three plain promises. */
function FixStep() {
  return (
    <section id="fix" className="v5-section v5-white h7-fix" aria-labelledby="h7-fix-title">
      <div className="v5-wrap">
        <div className="v5-head is-center" data-reveal>
          <p className="v5-eyebrow">Step 3</p>
          <Heading id="h7-fix-title" light="Fix it." strong="And make it stick." center />
          <p>
            We build a 90-day plan around that one thing, then work through it side by side. The same five steps I&apos;ve
            used for 25 years.
          </p>
        </div>
        <div className="h7-wide" data-reveal>
          <div className="h7-photo is-band">
            <Image src="/beyondlean/paul-fix.jpg" alt="Paul on the warehouse floor with an operations manager" fill sizes="(max-width: 900px) 100vw, 1240px" />
          </div>
          <ol className="h7-road">
            {ROADMAP.map((r, i) => (
              <li key={r.title} className={r.tone ? `is-${r.tone}` : undefined}>
                <span className="h7-road-dot" aria-hidden>
                  {r.tone === "done" ? <Check /> : i + 1}
                </span>
                <strong>{r.title}</strong>
                <span>{r.text}</span>
                {r.note && <em>{r.note}</em>}
              </li>
            ))}
          </ol>
        </div>
        <ul className="h7-promises">
          {PROMISES.map((p) => (
            <li key={p.title} data-reveal>
              <strong>{p.title}</strong>
              {p.text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Where are you today? The BCA staircase of five owner levels (hover one and it widens to say more), then the 50
 * playbooks: one for each step up in each area. Each playbook shows its one-line description on hover (from the real playbook content).
 */
function LevelsAndPlaybooks({ about }: { about: Map<string, string> }) {
  const levels = [...OWNER_LEVELS].reverse();
  return (
    <section className="v5-section v5-soft h7-levels" aria-labelledby="h7-levels-title">
      <div className="v5-wrap">
        <div className="v5-head" data-reveal>
          <Heading id="h7-levels-title" light="Where are you today?" strong="Five levels of business owner." />
          <p>Every owner sits on one of five levels. Your BOSS Score shows which, and what it takes to reach the next.</p>
        </div>
        <ol className="h7-stairs">
          {OWNER_LEVELS.map((lv) => (
            <li
              key={lv.id}
              className={`h7-stair${lv.id === 5 ? " is-top" : ""}`}
              style={{ "--lvl": lv.id, "--c": lv.color } as React.CSSProperties}
              tabIndex={0}
              data-reveal
            >
              <span className="h7-stair-icon" aria-hidden>
                <Image src={`/levels/${lv.icon}.png`} alt="" width={54} height={54} />
              </span>
              <p className="h7-stair-tag">Level {lv.id}</p>
              <h3>{lv.name}</h3>
              <p className="h7-stair-line">{lv.line}</p>
              <div className="h7-stair-extra">
                <div>
                  <p>{lv.more}</p>
                  <p className="h7-stair-books">
                    <span>Playbooks here</span>
                    {levelBooks(lv.id)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="v5-head is-center h7-books-head" data-reveal>
          <p className="v5-eyebrow">Behind Every Fix</p>
          <Heading id="h7-books-title" light="50 playbooks." strong="One for every step up." center />
          <p>Each area of your business sits at its own level. There&apos;s a playbook for every step up, so we fix the next thing, not everything at once.</p>
        </div>
        <div className="h7-grid-scroll" data-reveal>
          <table className="h7-grid">
            <thead>
              <tr>
                <th scope="col">
                  <span className="h7-sr">Level</span>
                </th>
                {AREAS.map((a) => (
                  <th key={a.id} scope="col">
                    <span className={`h7-grid-code is-${a.pillar}`}>{a.code}</span>
                    <AreaName name={a.name} className="h7-grid-area" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {levels.map((lv) => (
                <tr key={lv.id} style={{ "--lv": lv.color } as React.CSSProperties}>
                  <th scope="row">
                    <span className="h7-level-icon" aria-hidden>
                      <Image src={`/levels/${lv.icon}.png`} alt="" width={36} height={36} />
                    </span>
                    {lv.name}
                  </th>
                  {AREAS.map((a) => {
                    const p = PLAYBOOKS.find((b) => b.level === lv.id && b.area === a.id);
                    const text = p ? about.get(p.ref) : undefined;
                    return (
                      <td key={a.id}>
                        {p?.name}
                        {p && text && (
                          <span className="h7-tip" role="tooltip">
                            <strong>{p.name}</strong>
                            {text}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function FitColumn({ yes, items }: { yes: boolean; items: FitItem[] }) {
  const Mark = yes ? Check : X;
  return (
    <div className={`h7-fit-card${yes ? "" : " is-no"}`} data-reveal>
      <div className="h7-fit-head">
        <span className="h7-fit-mark" aria-hidden>
          <Mark strokeWidth={2.25} />
        </span>
        <h3>
          This is <em>{yes ? "for" : "not"}</em> {yes ? "you if" : "for you if"}
        </h3>
      </div>
      <ul>
        {items.map((item) => (
          <li key={item.title}>
            <span className="h7-fit-icon" aria-hidden>
              <item.icon strokeWidth={1.75} />
            </span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Who it's for and who it isn't, in the BCA website's design (bca-website components/home/FitColumns.tsx). */
function Fit() {
  return (
    <section className="v5-section v5-white" aria-labelledby="h7-fit-title">
      <div className="v5-wrap">
        <div className="v5-head is-center" data-reveal>
          <Heading id="h7-fit-title" light="Is this for you?" strong="Who I work with, and who I don't." center />
        </div>
        <div className="h7-fit">
          <FitColumn yes items={FIT_YES} />
          <FitColumn yes={false} items={FIT_NO} />
        </div>
      </div>
    </section>
  );
}

/** The home page's own case study row, so the two pages share one look. */
function Proof() {
  const items = getCaseStudies().map(({ slug, title, sector, summary, photo }) => ({ slug, title, sector, summary, photo }));
  if (items.length === 0) return null;
  return (
    <section className="v5-section v5-soft v5-results-row" aria-labelledby="h7-proof-title">
      <div className="v5-wrap">
        <div className="v5-head v5-head-split" data-reveal>
          <div>
            <p className="v5-eyebrow">Case Studies</p>
            <Heading id="h7-proof-title" light="What fixing it" strong="looked like elsewhere." />
          </div>
          <Link className="v5-pill-btn" href={`${HOME}/case-studies`}>
            All Case Studies <ArrowRight aria-hidden />
          </Link>
        </div>
      </div>
      <CaseRow items={items} base={`${HOME}/case-studies`} />
    </section>
  );
}

/** The playbook blurbs come cut at 120 characters; show the first whole sentence instead of a cut one. */
function firstSentence(text: string) {
  const clean = text.replace(/(\.\.\.|…)$/, "").trim();
  const first = clean.split(/(?<=[.!?])\s/)[0];
  return /[.!?]$/.test(first) ? first : "";
}

export async function HowPage({ switcher }: { switcher: React.ReactNode }) {
  let about = new Map<string, string>();
  try {
    about = new Map((await getAllPlaybookSummaries()).map((p) => [p.ref, firstSentence(p.description)]));
  } catch {
    // Descriptions are a hover extra; the grid still shows every playbook without them.
  }
  return (
    <V5Shell active="how" switcher={switcher}>
      <Hero />
      <ScoreStep />
      <CallStep />
      <FixStep />
      <LevelsAndPlaybooks about={about} />
      <Fit />
      <Proof />
      <FaqSection side />
      <CloseCard />
    </V5Shell>
  );
}
