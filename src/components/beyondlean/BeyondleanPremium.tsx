import Image from "next/image";
import { ArrowRight, ArrowUpRight, Mail, Phone } from "lucide-react";
import { BossWheel } from "@/components/BossCharts/BossWheel";
import { figtree, instrumentSerif } from "@/fonts";
import {
  BOOK_HREF,
  CAREER,
  CASES,
  EMAIL,
  EXAMPLE_AREA_SCORES,
  EXAMPLE_TOTAL,
  PHONE,
  PROBLEMS,
  RECORD,
  SCORE_HREF,
} from "./BeyondleanSite";
import { PremiumMotion } from "./PremiumMotion";
import { Untangle } from "./Untangle";
import "./beyondleanPremium.css";
import "./beyondleanBca.css";

const SECTORS = [
  "Aerospace",
  "Airline catering",
  "Banking",
  "Energy",
  "Defence",
  "Food manufacturing",
  "Contact centres",
  "Insurance",
];

function Wordmark() {
  return (
    <>
      <span className="bp-wm-a">Beyond</span>
      <span className="bp-wm-b">lean</span>
    </>
  );
}

function Nav() {
  return (
    <header className="bp-nav" data-motion-nav>
      <div className="bp-wrap bp-nav-inner">
        <a
          className="bp-wordmark"
          href="#top"
          aria-label="Beyondlean, back to top"
        >
          <Wordmark />
        </a>
        <nav aria-label="Main">
          <ul className="bp-nav-links">
            <li>
              <a href="#method">How I work</a>
            </li>
            <li>
              <a href="#results">Results</a>
            </li>
            <li>
              <a href="#about">About Paul</a>
            </li>
          </ul>
        </nav>
        <a className="bp-btn bp-btn-light bp-btn-small" href={BOOK_HREF}>
          Book a call
        </a>
      </div>
    </header>
  );
}

function Rings() {
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  return (
    <svg className="bp-rings" viewBox="-300 -300 600 600" aria-hidden>
      <circle r="290" />
      <circle r="220" />
      <circle r="150" className="bp-ring-strong" />
      {ticks.map((deg) => (
        <line
          key={deg}
          x1="0"
          y1="-290"
          x2="0"
          y2={deg % 30 === 0 ? -268 : -280}
          transform={`rotate(${deg})`}
        />
      ))}
    </svg>
  );
}

function Hero() {
  return (
    <section className="bp-hero" aria-labelledby="bp-hero-title" data-motion-hero>
      <div className="bp-hero-grid-lines" aria-hidden />
      <div className="bp-hero-glow" aria-hidden />
      <div className="bp-hero-rings" data-depth="0.08" aria-hidden>
        <Rings />
      </div>
      <p className="bp-hero-giant" data-depth="0.18" aria-hidden>
        Beyondlean
      </p>
      <div className="bp-hero-paul" data-depth="0.1">
        <Image
          src="/beyondlean/paul-cutout.png"
          alt="Paul Swift"
          width={1050}
          height={1400}
          sizes="(max-width: 860px) 90vw, 46vw"
          priority
        />
      </div>
      <div className="bp-hero-chips" data-depth="-0.06" aria-hidden>
        <div className="bp-chip bp-chip-1">
          <span className="bp-chip-figure">£306k</span>
          <span>a year saved · airline caterer</span>
        </div>
        <div className="bp-chip bp-chip-2">
          <span className="bp-chip-figure">+160%</span>
          <span>productivity · UK bank</span>
        </div>
        <div className="bp-chip bp-chip-3">
          <span className="bp-chip-figure">25 years</span>
          <span>Lean Six Sigma Master Black Belt</span>
        </div>
      </div>

      <div className="bp-wrap bp-hero-copy">
        <h1 id="bp-hero-title" className="bp-display bp-hero-title">
          25 years fixing how big firms work.{" "}
          <em>Now I coach owners to do the same.</em>
        </h1>
        <p className="bp-hero-lede">
          I&apos;m Paul Swift. I help owners of growing UK businesses cut the
          waste, fix the flow of work and take themselves out of the middle of
          it.
        </p>
        <div className="bp-actions">
          <a className="bp-btn bp-btn-light" href={BOOK_HREF}>
            Book a value call
            <ArrowRight aria-hidden />
          </a>
          <a className="bp-btn bp-btn-ghost" href={SCORE_HREF}>
            Get your free BOSS Score
          </a>
        </div>
      </div>
    </section>
  );
}

function Record() {
  return (
    <section className="bp-record" aria-labelledby="bp-record-title">
      <div className="bp-wrap">
        <ul className="bp-sectors" aria-label="Sectors Paul has worked in">
          {SECTORS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <div className="bp-record-grid">
          <div className="bp-record-head" data-reveal>
            <h2 id="bp-record-title" className="bp-display">
              The record <em>speaks first.</em>
            </h2>
            <p>
              Results from 25 years inside aerospace, banking, energy and food
              production. The same thinking now works for owners, faster.
            </p>
          </div>
          <dl className="bp-ledger">
            {RECORD.map((r) => (
              <div key={r.figure} data-reveal>
                <dt className="bp-ledger-figure">{r.figure}</dt>
                <dd>
                  <strong>{r.label}</strong>
                  <span>{r.where}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

function Problems() {
  return (
    <section
      className="bp-paper bp-problems"
      aria-labelledby="bp-problems-title"
    >
      <div className="bp-wrap bp-problems-grid">
        <div className="bp-problems-head">
          <h2 id="bp-problems-title" className="bp-display">
            Busy, but the profit <em>doesn&apos;t show it?</em>
          </h2>
          <p>
            Most of the fix is in how the work gets done. Here is what that
            looks like from the owner&apos;s chair.
          </p>
        </div>
        <ul className="bp-problem-list">
          {PROBLEMS.map((p) => (
            <li key={p.title} data-reveal>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: "Get your BOSS Score",
    text: "13 quick questions. A score out of 100 across the 10 areas of your business, free.",
  },
  {
    title: "Talk it through",
    text: "On a value call we find the one or two things costing you most. You leave with a clear next step either way.",
  },
  {
    title: "Fix it, and make it stick",
    text: "A 90-day plan, worked through side by side and measured before and after.",
  },
];

function Steps() {
  return (
    <section className="bp-steps-section" aria-labelledby="bp-steps-title">
      <div className="bp-wrap">
        <div className="bp-steps-head" data-reveal>
          <h2 id="bp-steps-title" className="bp-display">
            How we work together. <em>Score it. Talk it through. Fix it.</em>
          </h2>
        </div>
        <ol className="bp-steps">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className={`bp-step bp-step-${i + 1}`}
              data-reveal
            >
              <span className="bp-step-bar">Step {i + 1}</span>
              <div className="bp-step-body">
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="bp-steps-cta">
          <a className="bp-btn bp-btn-light" href={SCORE_HREF}>
            Get your free BOSS Score
            <ArrowRight aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}

function Results() {
  return (
    <section
      className="bp-paper bp-results"
      id="results"
      aria-labelledby="bp-results-title"
    >
      <div className="bp-wrap">
        <div className="bp-results-head" data-reveal>
          <h2 id="bp-results-title" className="bp-display">
            Real work. <em>Real numbers.</em>
          </h2>
          <p>
            Client names stay private. Each story says whether the money was
            saved or found.
          </p>
        </div>
        <div className="bp-files">
          {CASES.map((c, i) => (
            <article
              className="bp-file"
              key={c.where}
              style={{ "--i": i } as React.CSSProperties}
            >
              <div className="bp-file-figure">
                <span className="bp-file-number">{c.figure}</span>
                <span className="bp-file-label">{c.figureLabel}</span>
                <span
                  className={
                    c.status === "Delivered" ? "bp-status is-done" : "bp-status"
                  }
                >
                  {c.status}
                </span>
              </div>
              <div className="bp-file-body">
                <h3>{c.where}</h3>
                <dl>
                  <div>
                    <dt>The problem</dt>
                    <dd>{c.problem}</dd>
                  </div>
                  <div>
                    <dt>What we did</dt>
                    <dd>{c.did}</dd>
                  </div>
                  <div>
                    <dt>The result</dt>
                    <dd>{c.result}</dd>
                  </div>
                </dl>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section className="bp-about" id="about" aria-labelledby="bp-about-title">
      <div className="bp-wrap bp-about-grid">
        <figure className="bp-portrait" data-reveal>
          <Image
            src="/beyondlean/paul.jpg"
            alt="Paul Swift"
            width={1050}
            height={1400}
            sizes="(max-width: 860px) 100vw, 40vw"
          />
          <figcaption>
            <span>Paul Swift</span>
            <span>North Wales</span>
          </figcaption>
        </figure>
        <div className="bp-about-copy">
          <h2 id="bp-about-title" className="bp-display" data-reveal>
            I&apos;ve run a small business myself.{" "}
            <em>So I know where it hurts.</em>
          </h2>
          <p>
            I started as a fitter on the shop floor. Then I ran my own car sales
            and MOT business for five years. As a Production Director I helped
            grow profit fivefold. After that came Airbus, an airline caterer,
            and 20 years running Beyondlean, helping banks, energy firms and
            government teams work better.
          </p>
          <p>
            Most of the problems I fixed in big firms show up in growing
            businesses too. An owner can move much faster on them, which is why
            I now work with owners.
          </p>
          <p>
            Outside work I live on a small farm with dogs and ponies. I hold a
            5th Dan black belt in karate and coach two clubs. Both teach the
            same thing: get the basics right, then keep improving.
          </p>
          <blockquote className="bp-quote" data-reveal>
            <p>
              &ldquo;Any improvement is 20% about the tools and 80% about the
              people.&rdquo;
            </p>
          </blockquote>
        </div>
      </div>
      <div className="bp-wrap">
        <ol className="bp-timeline" aria-label="Paul's career">
          {CAREER.map((c) => (
            <li key={c.year} data-reveal>
              <span className="bp-timeline-year">{c.year}</span>
              <span className="bp-timeline-role">{c.role}</span>
              <span className="bp-timeline-place">{c.place}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Score() {
  return (
    <section className="bp-score" id="score" aria-labelledby="bp-score-title">
      <div className="bp-wrap bp-score-grid">
        <div>
          <h2 id="bp-score-title" className="bp-display" data-reveal>
            Where is your business losing money? <em>Find out free.</em>
          </h2>
          <p>
            13 quick questions give you a score out of 100 across the 10 areas
            of your business, from sales and systems to you as the owner. Then
            we go through it together.
          </p>
          <a className="bp-btn bp-btn-light" href={SCORE_HREF}>
            Get your BOSS Score
            <ArrowRight aria-hidden />
          </a>
        </div>
        <figure className="bp-score-card" data-reveal>
          <BossWheel
            areaScores={EXAMPLE_AREA_SCORES}
            totalScore={EXAMPLE_TOTAL}
            showLegend={false}
            size="compact"
            aria-label="Example BOSS wheel across ten business areas"
          />
          <figcaption>Example score</figcaption>
        </figure>
      </div>
    </section>
  );
}

function Close() {
  return (
    <section className="bp-close" id="book" aria-labelledby="bp-close-title">
      <div className="bp-wrap">
        <div className="bp-close-card">
          <div className="bp-close-glow" aria-hidden />
          <div className="bp-close-inner">
            <h2 id="bp-close-title" className="bp-display bp-close-title">
              Ready when you are. <em>Book a value call.</em>
            </h2>
            <p>
              Pick a time that suits you. We look at where your business is now,
              where you want it to be, and what&apos;s in the way.
            </p>
            <div className="bp-actions">
              <a className="bp-btn bp-btn-light" href={BOOK_HREF}>
                Book a value call
                <ArrowRight aria-hidden />
              </a>
              <a className="bp-btn bp-btn-ghost" href={SCORE_HREF}>
                Get your free BOSS Score
              </a>
            </div>
            <ul className="bp-contact">
              <li>
                <Phone aria-hidden />
                <a href="tel:+447843577771">{PHONE}</a>
              </li>
              <li>
                <Mail aria-hidden />
                <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
              </li>
            </ul>
          </div>
          <div className="bp-close-paul" aria-hidden>
            <Image
              src="/beyondlean/paul-cutout.png"
              alt=""
              width={1050}
              height={1400}
              sizes="(max-width: 860px) 70vw, 420px"
            />
          </div>
        </div>
      </div>
      <footer className="bp-footer">
        <div className="bp-wrap bp-footer-inner">
          <span className="bp-wordmark">
            <Wordmark />
          </span>
          <span>Improvement never ends.</span>
          <span className="bp-footer-right">
            © {new Date().getFullYear()} Beyondlean Ltd ·{" "}
            <a
              href="https://www.linkedin.com/in/paul-swift-b360b34"
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn <ArrowUpRight aria-hidden />
            </a>
          </span>
        </div>
      </footer>
    </section>
  );
}

export function BeyondleanPremium({
  switcher,
  theme,
}: {
  switcher?: React.ReactNode;
  theme?: "bca";
}) {
  return (
    <div
      className={`bp-root${theme === "bca" ? " bp-bca" : ""} ${figtree.variable} ${instrumentSerif.variable}`}
      id="top"
      data-motion-root
    >
      <Nav />
      <main>
        <Hero />
        <Record />
        <Problems />
        <div id="method">
          <Untangle scoreHref={SCORE_HREF} />
          <Steps />
        </div>
        <Results />
        <About />
        <Score />
        <Close />
      </main>
      <PremiumMotion />
      {switcher}
    </div>
  );
}
