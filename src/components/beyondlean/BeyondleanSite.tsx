import Image from "next/image";
import { ArrowRight, Mail, Phone } from "lucide-react";
import { BossWheel } from "@/components/BossCharts/BossWheel";
import { figtree, instrumentSerifItalic } from "@/fonts";
import "./beyondlean.css";

export type BeyondleanLook = "calm" | "bold";

export const BOOK_HREF = "/book/paul-swift";
export const SCORE_HREF = "/score/paul-swift";
export const PHONE = "07843 577771";
export const EMAIL = "paul@beyondlean.com";

// Delivered results from Paul's CV and LinkedIn. To confirm with Paul before launch.
export const RECORD = [
  { figure: "+500%", label: "profit", where: "As Production Director of a small car business" },
  { figure: "£306k", label: "a year saved", where: "Airline caterer. The same meals made by 17 fewer people" },
  { figure: "+160%", label: "productivity", where: "UK bank mortgage team. Offers out in half the time" },
  { figure: "£3m+", label: "signed-off savings", where: "Energy firm contact centre with 800 staff" },
];

export const PROBLEMS = [
  {
    title: "Everything comes back to you.",
    text: "Decisions, problems and sign-offs wait for you, so the business only moves as fast as you do.",
  },
  {
    title: "Your good people spend the day firefighting.",
    text: "Rework, chasing and fixing mistakes eat the hours that should be making money.",
  },
  {
    title: "Jobs take longer than they should.",
    text: "Work sits waiting between people and steps. Customers notice before you do.",
  },
  {
    title: "Sales go up. Profit doesn't.",
    text: "More work brings more cost, because the way the work gets done hasn't kept up.",
  },
];

const STEPS = [
  {
    title: "Get your BOSS Score",
    text: "Answer 13 quick questions and get a score out of 100 across the 10 areas of your business. It's free.",
  },
  {
    title: "Talk it through on a value call",
    text: "We go through your score together and find the one or two things costing you most. You leave with a clear next step, whether we work together or not.",
  },
  {
    title: "Fix it, and make it stick",
    text: "We work through a 90-day plan side by side and measure before and after. If the change doesn't stick, I haven't done my job.",
  },
];

export const CASES = [
  {
    where: "Business class meals for a global airline caterer",
    status: "Delivered",
    problem:
      "38% of the work on the main meal lines added nothing for the customer, and every shift lost 25 minutes getting started.",
    did: "Redesigned the tables and the flow of work, set clear roles, and built a staffing calculator from passenger numbers.",
    result: "The same output with 40 people instead of 57. £306,000 a year saved against a target of £216,000.",
    figure: "£306k",
    figureLabel: "a year saved",
  },
  {
    where: "Packing lines at a UK snack maker",
    status: "Found in the review",
    problem: "13 packing lines were only running between a third and two-thirds of the day.",
    did: "Daily five-minute team huddles, boards everyone can read, faster changeovers and cover for breaks.",
    result: "A plan to lift machine time to 70%, worth about £1.4m a year in extra profit.",
    figure: "£1.4m",
    figureLabel: "a year found",
  },
  {
    where: "Daily reports at an energy trading desk",
    status: "Found in the review",
    problem: "Three teams built the same reports every day, then met to check them against each other.",
    did: "Mapped every step, then gave each report one owner and one version of the truth.",
    result: "About £1m a year of trading time freed up for the people who make the money.",
    figure: "£1m",
    figureLabel: "a year found",
  },
];

export const CAREER = [
  { year: "1983", role: "Fitter on the shop floor", place: "Royal Ordnance" },
  { year: "1989", role: "Owner of a car sales and MOT business", place: "His own firm" },
  { year: "1994", role: "Production Director", place: "Profit up fivefold" },
  { year: "1999", role: "Lean consultant", place: "Airbus UK" },
  { year: "2005", role: "Improvement lead, UK and Ireland", place: "Airline catering" },
  { year: "2006", role: "Founder", place: "Beyondlean Ltd" },
];

export const EXAMPLE_AREA_SCORES = [6.2, 5.4, 7.1, 4.9, 6.8, 5.6, 6.3, 6.9, 5.2, 6.5];
export const EXAMPLE_TOTAL = 62;

/** Headline in the BCA two-weight style. In the bold look one word turns serif italic. */
function Headline({
  as: Tag = "h2",
  light,
  strong,
  accent,
  look,
}: {
  as?: "h1" | "h2";
  light: string;
  strong: string;
  accent?: string;
  look: BeyondleanLook;
}) {
  const parts = accent && look === "bold" ? strong.split(accent) : null;
  return (
    <Tag className="bl-headline">
      <span className="bl-headline-light">{light}</span>{" "}
      <span className="bl-headline-strong">
        {parts ? (
          <>
            {parts[0]}
            <em className="bl-accent">{accent}</em>
            {parts[1]}
          </>
        ) : (
          strong
        )}
      </span>
    </Tag>
  );
}

function Actions({ onDark = false }: { onDark?: boolean }) {
  return (
    <div className="bl-actions">
      <a className={onDark ? "bl-btn bl-btn-light" : "bl-btn"} href={BOOK_HREF}>
        Book a value call
        <ArrowRight aria-hidden />
      </a>
      <a className={onDark ? "bl-btn bl-btn-ghost-dark" : "bl-btn bl-btn-ghost"} href={SCORE_HREF}>
        Get your free BOSS Score
      </a>
    </div>
  );
}

function Wordmark() {
  return (
    <a className="bl-wordmark" href="#top" aria-label="Beyondlean, back to top">
      <span className="bl-wordmark-light">Beyond</span>
      <span className="bl-wordmark-strong">lean</span>
    </a>
  );
}

function Nav({ look }: { look: BeyondleanLook }) {
  return (
    <header className={`bl-nav bl-nav-${look}`}>
      <div className="bl-wrap bl-nav-inner">
        <Wordmark />
        <nav aria-label="Main">
          <ul className="bl-nav-links">
            <li>
              <a href="#how">How I work</a>
            </li>
            <li>
              <a href="#results">Results</a>
            </li>
            <li>
              <a href="#about">About Paul</a>
            </li>
          </ul>
        </nav>
        <a className="bl-btn bl-btn-small" href={BOOK_HREF}>
          Book a call
        </a>
      </div>
    </header>
  );
}

const HERO_LIGHT = "25 years fixing how big firms work.";
const HERO_STRONG = "Now I coach owners to do the same.";
const HERO_TEXT =
  "I'm Paul Swift. I've spent my career making work flow at Airbus, in banking, energy and defence. Now I help owners of growing UK businesses fix the same problems: jobs that take too long, mistakes that cost money, and a week that runs on you.";

function RecordLedger() {
  return (
    <dl className="bl-ledger">
      {RECORD.map((r) => (
        <div className="bl-ledger-row" key={r.figure}>
          <dt>
            <span className="bl-figure">{r.figure}</span>
            <span className="bl-figure-label">{r.label}</span>
          </dt>
          <dd>{r.where}</dd>
        </div>
      ))}
    </dl>
  );
}

function HeroCalm() {
  return (
    <section className="bl-hero-calm" aria-labelledby="bl-hero-title">
      <div className="bl-wrap bl-hero-calm-head">
        <div id="bl-hero-title">
          <Headline as="h1" light={HERO_LIGHT} strong={HERO_STRONG} look="calm" />
        </div>
        <p className="bl-lede">{HERO_TEXT}</p>
        <Actions />
        <p className="bl-note">Based in North Wales. Working with owners across the UK, in person and on Zoom.</p>
      </div>
      <div className="bl-wrap">
        <div className="bl-dossier">
          <figure className="bl-dossier-photo">
            <Image
              src="/beyondlean/paul.jpg"
              alt="Paul Swift"
              width={1050}
              height={1400}
              sizes="(max-width: 860px) 100vw, 420px"
              priority
            />
            <figcaption>
              <strong>Paul Swift</strong>
              <span>Business coach · Lean Six Sigma Master Black Belt</span>
            </figcaption>
          </figure>
          <div className="bl-dossier-record">
            <h2 className="bl-dossier-title">The record, in numbers</h2>
            <RecordLedger />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroBold() {
  return (
    <section className="bl-hero-bold" aria-labelledby="bl-hero-title">
      <div className="bl-hero-bold-band" aria-hidden />
      <div className="bl-wrap bl-hero-bold-grid">
        <div className="bl-hero-bold-copy" id="bl-hero-title">
          <Headline as="h1" light={HERO_LIGHT} strong={HERO_STRONG} accent="owners" look="bold" />
          <p className="bl-lede">{HERO_TEXT}</p>
          <Actions onDark />
          <p className="bl-note">Based in North Wales. Working with owners across the UK, in person and on Zoom.</p>
        </div>
        <div className="bl-hero-bold-figure">
          <Image
            src="/beyondlean/paul-cutout.png"
            alt="Paul Swift"
            width={1050}
            height={1400}
            sizes="(max-width: 860px) 80vw, 560px"
            priority
          />
          <div className="bl-chip bl-chip-name">
            <strong>Paul Swift</strong>
            <span>Business coach, Beyondlean</span>
          </div>
          <div className="bl-chip bl-chip-cred">
            <strong>25 years</strong>
            <span>Master Black Belt</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function RecordTiles() {
  return (
    <section className="bl-section bl-tiles-section" aria-labelledby="bl-record-title">
      <div className="bl-wrap">
        <p className="bl-statement" id="bl-record-title">
          I help owners fix the way work gets done, so the business makes more money and leans on them less.
        </p>
        <div className="bl-tiles">
          {RECORD.map((r, i) => (
            <div className={`bl-tile bl-tile-${i}`} key={r.figure}>
              <span className="bl-figure">{r.figure}</span>
              <span className="bl-tile-label">{r.label}</span>
              <span className="bl-tile-where">{r.where}</span>
            </div>
          ))}
          <blockquote className="bl-tile bl-tile-quote">
            <p>&ldquo;Any improvement is 20% about the tools and 80% about the people.&rdquo;</p>
            <cite>Paul Swift</cite>
          </blockquote>
        </div>
      </div>
    </section>
  );
}

function Problems({ look }: { look: BeyondleanLook }) {
  return (
    <section className="bl-section bl-problems" aria-labelledby="bl-problems-title">
      <div className="bl-wrap bl-split">
        <div className="bl-split-head" id="bl-problems-title">
          <Headline
            light="Busy, but the profit doesn't show it?"
            strong="Most of the fix is in how the work gets done."
            accent="work"
            look={look}
          />
          {look === "calm" && (
            <blockquote className="bl-pull">
              <p>&ldquo;Any improvement is 20% about the tools and 80% about the people.&rdquo;</p>
              <cite>Paul Swift</cite>
            </blockquote>
          )}
        </div>
        <ul className="bl-rows">
          {PROBLEMS.map((p) => (
            <li key={p.title}>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HowIWork({ look }: { look: BeyondleanLook }) {
  return (
    <section className="bl-section bl-how" id="how" aria-labelledby="bl-how-title">
      <div className="bl-wrap">
        <div className="bl-center-head" id="bl-how-title">
          <Headline light="Three steps." strong="Measure first, then fix what matters most." accent="Measure" look={look} />
        </div>
        <ol className="bl-steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="bl-step-num" aria-hidden>
                {i + 1}
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Results({ look }: { look: BeyondleanLook }) {
  return (
    <section className="bl-section bl-results" id="results" aria-labelledby="bl-results-title">
      <div className="bl-wrap">
        <div className="bl-center-head" id="bl-results-title">
          <Headline light="What changes look like." strong="Real work, real numbers." accent="real" look={look} />
          <p className="bl-sub">Client names stay private. Each story says whether the money was saved or found.</p>
        </div>
        <div className="bl-cases">
          {CASES.map((c) => (
            <article className="bl-case" key={c.where}>
              <div className="bl-case-figure">
                <span className="bl-figure">{c.figure}</span>
                <span className="bl-figure-label">{c.figureLabel}</span>
                <span className={c.status === "Delivered" ? "bl-status bl-status-done" : "bl-status"}>{c.status}</span>
              </div>
              <div className="bl-case-body">
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

function About({ look }: { look: BeyondleanLook }) {
  return (
    <section className="bl-section bl-about" id="about" aria-labelledby="bl-about-title">
      <div className="bl-wrap bl-split">
        <div className="bl-about-copy">
          <div id="bl-about-title">
            <Headline light="I've run a small business myself." strong="So I know where it hurts." accent="hurts" look={look} />
          </div>
          <p>
            I started as a fitter on the shop floor. Then I ran my own car sales and MOT business for five years. As a
            Production Director I helped grow profit fivefold. After that came Airbus, an airline caterer, and 20 years
            running Beyondlean, helping banks, energy firms and government teams work better.
          </p>
          <p>
            Most of the problems I fixed in big firms show up in growing businesses too. An owner can move much faster
            on them, which is why I now work with owners.
          </p>
          <p>
            Outside work I live on a small farm in North Wales with dogs and ponies. I hold a 5th Dan black belt in
            karate and coach two clubs. Both teach the same thing: get the basics right, then keep improving.
          </p>
          <ul className="bl-creds">
            <li>Lean Six Sigma Master Black Belt</li>
            <li>HNC Engineering</li>
            <li>NVQ Coaching Award</li>
            <li>Trained in The Profit System</li>
          </ul>
        </div>
        <ol className="bl-career" aria-label="Paul's career">
          {CAREER.map((c) => (
            <li key={c.year}>
              <span className="bl-career-year">{c.year}</span>
              <span className="bl-career-role">{c.role}</span>
              <span className="bl-career-place">{c.place}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ScoreBand({ look }: { look: BeyondleanLook }) {
  return (
    <section className="bl-section bl-score" id="score" aria-labelledby="bl-score-title">
      <div className="bl-wrap bl-score-grid">
        <div className="bl-score-copy">
          <div id="bl-score-title">
            <Headline
              light="Where is your business losing money?"
              strong="Find out with your free BOSS Score."
              accent="free"
              look={look}
            />
          </div>
          <p>
            13 quick questions give you a score out of 100 across the 10 areas of your business, from sales and
            systems to you as the owner. Then we can go through it together on a call.
          </p>
          <a className="bl-btn bl-btn-light" href={SCORE_HREF}>
            Get your BOSS Score
            <ArrowRight aria-hidden />
          </a>
        </div>
        <figure className="bl-score-wheel">
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

function Close({ look }: { look: BeyondleanLook }) {
  return (
    <section className="bl-section bl-close" id="book" aria-labelledby="bl-close-title">
      <div className="bl-wrap bl-close-inner">
        <div id="bl-close-title">
          <Headline light="Ready when you are." strong="Book a value call with Paul." accent="value" look={look} />
        </div>
        <p className="bl-lede">
          Pick a time that suits you. We look at where your business is now, where you want it to be, and what&apos;s in
          the way.
        </p>
        <Actions />
        <ul className="bl-contact">
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
    </section>
  );
}

function Footer() {
  return (
    <footer className="bl-footer">
      <div className="bl-wrap bl-footer-inner">
        <Wordmark />
        <p>Improvement never ends.</p>
        <p className="bl-footer-small">© {new Date().getFullYear()} Beyondlean Ltd · North Wales</p>
      </div>
    </footer>
  );
}

export function LookSwitch({ look }: { look: BeyondleanLook | "v5" | "bca" | "dark" }) {
  return (
    <nav className="bl-switch" aria-label="Design options (preview only)">
      <span>Look</span>
      <a href="?look=v5" aria-current={look === "v5" ? "page" : undefined}>
        New
      </a>
      <a href="?look=bca" aria-current={look === "bca" ? "page" : undefined}>
        BCA
      </a>
      <a href="?look=dark" aria-current={look === "dark" ? "page" : undefined}>
        Dark
      </a>
      <a href="?look=calm" aria-current={look === "calm" ? "page" : undefined}>
        Calm
      </a>
      <a href="?look=bold" aria-current={look === "bold" ? "page" : undefined}>
        Bold
      </a>
    </nav>
  );
}

export function BeyondleanSite({ look, preview }: { look: BeyondleanLook; preview: boolean }) {
  return (
    <div className={`bl-root bl-${look} ${figtree.variable} ${instrumentSerifItalic.variable}`} id="top">
      <Nav look={look} />
      <main>
        {look === "bold" ? <HeroBold /> : <HeroCalm />}
        {look === "bold" && <RecordTiles />}
        <Problems look={look} />
        <HowIWork look={look} />
        <Results look={look} />
        <About look={look} />
        <ScoreBand look={look} />
        <Close look={look} />
      </main>
      <Footer />
      {preview && <LookSwitch look={look} />}
    </div>
  );
}
