import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Factory,
  Landmark,
  MoveRight,
  Plane,
  Shield,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { getCaseStudies, getPublishedPosts } from "@/lib/beyondlean/content";
import { BOOK_HREF, EXAMPLE_TOTAL, SCORE_HREF } from "./data";
import { CaseRow, SlideRow } from "./v5/CaseRow";
import { CircleButton, CloseCard, CtaCard, FaqSection, HOME, Heading, V5Shell } from "./v5/parts";
import { topicIcon } from "./v5/PostCard";
import { QuoteList } from "./v5/QuoteList";
import { shortText } from "./v5/shortText";

const SECTORS = [
  { icon: Factory, label: "Manufacturing" },
  { icon: Plane, label: "Aerospace" },
  { icon: UtensilsCrossed, label: "Food" },
  { icon: Landmark, label: "Banking" },
  { icon: Zap, label: "Energy" },
  { icon: Shield, label: "Defence" },
];

/** Glass tabs under the hero: each opens on hover to the page that proves it, in the same order as the menu. */
const TABS = [
  {
    figure: "25 years",
    label: "fixing how work gets done",
    links: [{ href: `${HOME}/about`, label: "About Paul" }],
  },
  {
    figure: "£1.4m",
    label: "a year found on snack packing lines",
    links: [
      { href: `${HOME}/case-studies/uk-snack-maker-packing-lines`, label: "Read this one" },
      { href: `${HOME}/case-studies`, label: "All case studies" },
    ],
  },
  {
    figure: "Lean Six Sigma",
    label: "Master Black Belt, the highest level",
    links: [
      { href: `${HOME}/how-it-works`, label: "How it works" },
      { href: `${HOME}/blog`, label: "Read the blog" },
    ],
  },
];

function HeroCopy() {
  return (
    <div className="v5-hero-copy">
      <p className="v5-badge is-outline">
        <Factory aria-hidden /> For Owner-Run Manufacturers
      </p>
      <h1 id="v5-hero-title">More profit. Less firefighting.</h1>
      <p className="v5-hero-lede is-short">
        Find what&apos;s eating your profit, fix it in 90 days, and stop being the one who holds it all together.
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
  );
}

/** Paul on a factory floor, full width, with a navy fade behind the words. */
function HeroPhoto() {
  return (
    <section className="v5-hero v5-hero-photo" aria-labelledby="v5-hero-title" data-motion-hero>
      <div className="v5-hero-bg" aria-hidden>
        <Image src="/beyondlean/paul-factory.jpg" alt="" fill sizes="100vw" priority />
      </div>
      <div className="v5-wrap v5-hero-grid">
        <HeroCopy />
      </div>
    </section>
  );
}

/** The sectors drifting slowly sideways; two copies make the loop seamless. */
function SectorMarquee() {
  const row = [...SECTORS, ...SECTORS];
  return (
    <div className="v5-marquee">
      {[0, 1].map((copy) => (
        <ul key={copy} aria-hidden={copy === 1 || undefined}>
          {row.map(({ icon: Icon, label }, i) => (
            <li key={`${label}-${i}`} aria-hidden={i >= SECTORS.length || undefined}>
              <Icon aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

/** Proof under the hero: three glass tabs sitting on its bottom edge, then the sectors drifting past. */
function Sectors() {
  return (
    <section className="v5-proof" aria-label="Paul's results">
      <div className="v5-proof-band">
        <div className="v5-wrap v5-wrap-wide">
          <ul className="v5-proof-glass">
            {TABS.map((t) => (
              <li key={t.figure} className="v5-tab-slot">
                <div className="v5-tab">
                  <p className="v5-tab-figure">{t.figure}</p>
                  <p className="v5-tab-label">{t.label}</p>
                  <div className="v5-tab-more">
                    <div>
                      {t.links.map((l, i) => (
                        <Link key={l.href} className={i === 0 ? "is-main" : undefined} href={l.href}>
                          {l.label} <ArrowRight aria-hidden />
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="v5-wrap v5-wrap-wide v5-proof-strip">
        <p>Results delivered in</p>
        <SectorMarquee />
      </div>
    </section>
  );
}

/** What owners actually say, in their own words. */
const QUOTES = [
  "If I stop, the whole business stops.",
  "We're busier than ever, but there's less in the bank.",
  "We lose money on jobs and I can't see where.",
  "If my best person walks out, we're stuck.",
  "I lie awake wondering how we'll pay the wages.",
  "I haven't had a proper week off in years.",
];

/** The real problem: a headline that takes the blame off the owner, their own words, and what it costs. */
function Pains() {
  return (
    <section className="v5-section v5-white v5-problem-section" aria-labelledby="v5-pains-title">
      <div className="v5-wrap">
        <div className="v5-problem">
          <div className="v5-problem-copy" data-reveal>
            <p className="v5-eyebrow">The Real Problem</p>
            <Heading id="v5-pains-title" light="You're not the problem." strong="Your operating system is." />
            <p className="v5-problem-text">
              Every business has an operating system: how work, decisions and money move through it. Yours
              hasn&apos;t kept up, so it all lands on you. The Business Operating System Score (BOSS) finds the one
              thing holding it back. <strong>Because it&apos;s time you were the boss again.</strong>
            </p>
            <div className="v5-problem-cta">
              <Link className="v5-orbit-btn" href={SCORE_HREF}>
                Get My BOSS Score <ArrowRight aria-hidden />
              </Link>
            </div>
          </div>
          <QuoteList quotes={QUOTES} />
        </div>
      </div>
    </section>
  );
}

/** Fine line drawings that sit on top of each result card. */
function ClockArt() {
  return (
    <svg viewBox="0 0 120 120" className="v5-art v5-art-clock" aria-hidden>
      {Array.from({ length: 60 }, (_, i) => {
        const a = (i / 60) * Math.PI * 2;
        const r1 = i % 5 === 0 ? 38 : 45;
        return (
          <line
            key={i}
            x1={60 + Math.sin(a) * r1}
            y1={60 - Math.cos(a) * r1}
            x2={60 + Math.sin(a) * 52}
            y2={60 - Math.cos(a) * 52}
            style={{ transitionDelay: `${900 + i * 14}ms` }}
          />
        );
      })}
      <line className="v5-art-hand" x1="60" y1="60" x2="60" y2="30" />
      <line className="v5-art-hand" x1="60" y1="60" x2="80" y2="68" />
      <circle className="v5-art-dot" cx="60" cy="60" r="2.5" />
    </svg>
  );
}

function RiseArt() {
  const n = 13;
  return (
    <svg viewBox="0 0 120 120" className="v5-art v5-art-rise" aria-hidden>
      <line className="v5-art-base" x1="14" y1="100" x2="106" y2="100" />
      {Array.from({ length: n }, (_, i) => {
        const x = 18 + i * 7;
        const h = 10 + Math.pow(i / (n - 1), 1.6) * 70;
        return <line key={i} x1={x} y1={100} x2={x} y2={100 - h} style={{ transitionDelay: `${1100 + i * 60}ms` }} />;
      })}
      <circle className="v5-art-dot" cx={18 + (n - 1) * 7} cy={20} r="3" />
    </svg>
  );
}

function RosetteArt() {
  return (
    <svg viewBox="0 0 120 120" className="v5-art v5-art-rosette" aria-hidden>
      <g>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <circle key={i} cx={60 + Math.sin(a) * 17} cy={60 - Math.cos(a) * 17} r="27" />;
        })}
      </g>
      <circle className="v5-art-dot" cx="60" cy="60" r="2.5" />
    </svg>
  );
}

const RESULTS = [
  {
    art: <ClockArt />,
    label: "Time",
    title: "Your weekends back.",
    text: "Your team handles the day-to-day, so it stops landing on you.",
  },
  {
    art: <RiseArt />,
    label: "Profit",
    title: "Keep what you earn.",
    text: "Fewer delays, redos and waits, so more of what you make stays in the business.",
  },
  {
    art: <RosetteArt />,
    label: "Value",
    title: "A business worth buying.",
    text: "It runs without you, so it's worth more, whether you keep it, hand it on or sell.",
  },
];

/** BOSS on its own line, wires down to three results. Only the light round BOSS moves; cards come alive on hover. */
function Changes() {
  return (
    <section className="v5-hub-section" aria-labelledby="v5-changes-title">
      <div className="v5-wrap">
        <div className="v5-head is-center v5-hub-head" data-reveal>
          <p className="v5-eyebrow">What Changes</p>
          <Heading id="v5-changes-title" light="A business that runs," strong="without running you." center />
        </div>

        <div className="v5-hub" data-reveal>
          <Link className="v5-hub-core" href={SCORE_HREF}>
            <strong>BOSS</strong>
            <span className="v5-hub-core-name">Business Operating System Score</span>
            <ArrowRight aria-hidden />
          </Link>
          <div className="v5-wire" aria-hidden>
            <span className="v5-wire-stem" />
            <span className="v5-wire-bar is-left" />
            <span className="v5-wire-bar is-right" />
            <span className="v5-wire-drop is-1" />
            <span className="v5-wire-drop is-2" />
            <span className="v5-wire-drop is-3" />
          </div>
          <ul className="v5-hub-cards">
            {RESULTS.map((r) => (
              <li key={r.label} className="v5-hub-card" data-reveal>
                <div className="v5-hub-art">{r.art}</div>
                <p className="v5-hub-label">{r.label}</p>
                <h3>{r.title}</h3>
                <p>{r.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section className="v5-section v5-soft" id="about" aria-labelledby="v5-about-title">
      <div className="v5-wrap v5-about">
        <figure className="v5-about-photo" data-reveal>
          <Image src="/beyondlean/paul.jpg" alt="Paul Swift" width={1050} height={1400} sizes="(max-width: 900px) 100vw, 480px" />
          <figcaption className="v5-photo-badge">
            <span className="v5-photo-badge-num">25</span>
            <span>years fixing how work gets done</span>
          </figcaption>
        </figure>
        <div className="v5-about-copy">
          <Heading id="v5-about-title" light="I've run a small business myself." strong="So I know where it hurts." />
          <p>
            I started as a fitter on the shop floor, then ran my own car sales and MOT business. As a Production Director
            I helped grow profit by 500%. Then came Airbus, an airline caterer, and 20 years running Beyondlean for
            banks, energy firms and government teams.
          </p>
          <ul className="v5-about-points">
            <li>
              <BadgeCheck aria-hidden /> I&apos;ve run my own small business, so I know the owner&apos;s chair
            </li>
            <li>
              <BadgeCheck aria-hidden /> Lean Six Sigma Master Black Belt, Certified Profit Coach
            </li>
            <li>
              <BadgeCheck aria-hidden /> I measure before and after, so you see what changed
            </li>
          </ul>
          <div className="v5-stat-cards">
            <div>
              <span className="v5-stat-num">+500%</span>
              <span>profit as Production Director of a car business</span>
            </div>
            <div>
              <span className="v5-stat-num">£3m+</span>
              <span>signed-off savings in an 800-person contact centre</span>
            </div>
          </div>
          <div className="v5-about-actions">
            <CircleButton href={BOOK_HREF}>Book a Constraint Call</CircleButton>
            <Link className="v5-text-link" href={`${HOME}/about`}>
              More about Paul <ArrowRight aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** New step cards: a photo each, and on hover a blue panel rises with more detail. */
const STEPS = [
  {
    step: "Step 1",
    title: "Score your business",
    text: "A free BOSS Score shows where your business is losing time and money.",
    points: [
      "13 quick questions",
      "Takes a few minutes, and it's free",
      "A score out of 100 across the 10 areas of your business",
    ],
    photo: "/beyondlean/owner-laptop.jpg",
    href: SCORE_HREF,
    cta: "Get your score",
  },
  {
    step: "Step 2",
    title: "Find the constraint",
    text: "On a Constraint Call we find the one thing holding your business back.",
    points: [
      "We go through your score and your numbers together",
      "You leave with the one to three things to do next",
      "If I can't help, I'll tell you",
    ],
    photo: "/beyondlean/paul-score.jpg",
    href: BOOK_HREF,
    cta: "Book a Constraint Call",
  },
  {
    step: "Step 3",
    title: "Fix it for good",
    text: "We fix it together over 90 days, and it stays fixed.",
    points: [
      "Side by side, in person or on Zoom",
      "Measured before and after, so you see what changed",
      "Your team learns the new way of working, so it lasts without me",
    ],
    photo: "/beyondlean/paul-fix.jpg",
    href: `${HOME}/how-it-works`,
    cta: "See how it works",
  },
];

function ScoreChip() {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="v5-step-chip" aria-hidden>
      <svg viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} className="v5-step-chip-track" />
        <circle
          cx="28"
          cy="28"
          r={r}
          className="v5-step-chip-fill"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - EXAMPLE_TOTAL / 100)}
        />
        <text x="28" y="33" textAnchor="middle">
          {EXAMPLE_TOTAL}
        </text>
      </svg>
      <span>
        <strong>Your BOSS Score</strong>
        out of 100
      </span>
    </div>
  );
}

function Phases() {
  return (
    <section className="v5-phases" aria-labelledby="v5-phases-title">
      <svg className="v5-phases-arcs" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <circle cx="300" cy="980" r="640" />
        <circle cx="1240" cy="-120" r="560" />
      </svg>
      <div className="v5-wrap">
        <div className="v5-head is-center" data-reveal>
          <p className="v5-eyebrow">How It Works</p>
          <Heading id="v5-phases-title" light="Three steps to" strong="more profit and less firefighting." center />
        </div>
        <ol className="v5-phase-cards">
          {STEPS.map((p, i) => (
            <li key={p.title} className="v5-phase is-reveal" data-reveal>
              <Image src={p.photo} alt="" fill sizes="(max-width: 900px) 100vw, 400px" />
              {i === 0 && <ScoreChip />}
              <span className="v5-phase-wash" aria-hidden />
              <div className="v5-phase-body">
                <span className="v5-phase-step">{p.step}</span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
                <div className="v5-phase-more">
                  <div>
                    <ul>
                      {p.points.map((pt) => (
                        <li key={pt}>
                          <Check aria-hidden />
                          {pt}
                        </li>
                      ))}
                    </ul>
                    <a className="v5-outline-btn" href={p.href}>
                      {p.cta} <ArrowRight aria-hidden />
                    </a>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Results() {
  const items = getCaseStudies().map(({ slug, title, sector, summary, photo }) => ({ slug, title, sector, summary, photo }));
  return (
    <section className="v5-section v5-white v5-results-row" id="results" aria-labelledby="v5-results-title">
      <div className="v5-wrap">
        <div className="v5-head v5-head-split" data-reveal>
          <div>
            <p className="v5-eyebrow">Case Studies</p>
            <Heading id="v5-results-title" light="Real work." strong="Real numbers." />
          </div>
          <Link className="v5-pill-btn" href={`${HOME}/case-studies`}>
            All Case Studies <MoveRight aria-hidden />
          </Link>
        </div>
      </div>
      <CaseRow items={items} base={`${HOME}/case-studies`} />
    </section>
  );
}

function Score() {
  return (
    <section className="v5-section v5-soft" aria-labelledby="v5-score-title">
      <div className="v5-wrap">
        <CtaCard
          id="v5-score-title"
          eyebrow="Free BOSS Score"
          light="Where is your business"
          strong="losing money?"
          text="13 quick questions give you a score out of 100 across the 10 areas of your business, and show you what to fix first. It takes a few minutes and it's free."
          href={SCORE_HREF}
          label="Get Your Free BOSS Score"
          photo="/beyondlean/owner-laptop.jpg"
        />
      </div>
    </section>
  );
}

/** Paul's articles as a sideways row of text cards, the featured ones first, ending on a card to see them all. */
function Library() {
  const all = getPublishedPosts();
  if (all.length === 0) return null;
  return (
    <section className="v5-section v5-soft v5-results-row" id="library" aria-labelledby="v5-library-title">
      <div className="v5-wrap">
        <div className="v5-head v5-head-split" data-reveal>
          <div>
            <p className="v5-eyebrow">From Paul&apos;s Blog</p>
            <Heading id="v5-library-title" light="Quick reads," strong="25 years of lessons." />
          </div>
          <Link className="v5-pill-btn" href={`${HOME}/blog`}>
            All {all.length} Articles <MoveRight aria-hidden />
          </Link>
        </div>
      </div>
      <SlideRow label="articles">
        {all.slice(0, 11).map((p) => {
          const Icon = topicIcon(p.category);
          return (
            <Link key={p.slug} className="v5-guide" href={`${HOME}/blog/${p.slug}`}>
              <span className="v5-guide-topic">
                <Icon aria-hidden strokeWidth={1.75} />
                {p.category}
              </span>
              <span className="v5-guide-title">{p.title}</span>
              <span className="v5-guide-text">{shortText(p.excerpt, 120)}</span>
              <span className="v5-guide-foot">
                {p.readMinutes ? `${p.readMinutes} min read` : "Read"}
                <ArrowRight aria-hidden />
              </span>
            </Link>
          );
        })}
        <Link className="v5-guide is-all" href={`${HOME}/blog`}>
          <span className="v5-guide-title">
            {all.length} short articles on teams, operations, tools and growth.
          </span>
          <span className="v5-guide-foot">
            See them all
            <ArrowRight aria-hidden />
          </span>
        </Link>
      </SlideRow>
    </section>
  );
}



export function BeyondleanV5() {
  return (
    <V5Shell active="home">
      <HeroPhoto />
      <Sectors />
      <Pains />
      <Changes />
      <About />
      <Phases />
      <Results />
      <Score />
      <FaqSection side />
      <Library />
      <CloseCard />
    </V5Shell>
  );
}
