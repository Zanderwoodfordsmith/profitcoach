import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  ChevronDown,
  Clock,
  Factory,
  Gauge,
  Landmark,
  Mail,
  Phone,
  Plane,
  Shield,
  TrendingDown,
  UserRound,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { BossWheel } from "@/components/BossCharts/BossWheel";
import { figtree, instrumentSerif } from "@/fonts";
import { BOOK_HREF, EMAIL, EXAMPLE_AREA_SCORES, EXAMPLE_TOTAL, PHONE, SCORE_HREF } from "./BeyondleanSite";
import { PremiumMotion } from "./PremiumMotion";
import { Untangle } from "./Untangle";
import "./beyondleanPremium.css";
import "./beyondleanBca.css";
import "./beyondleanV5.css";

const PHONE_HREF = "tel:+447843577771";

const SECTORS = [
  { icon: Plane, label: "Aerospace" },
  { icon: UtensilsCrossed, label: "Food" },
  { icon: Landmark, label: "Banking" },
  { icon: Zap, label: "Energy" },
  { icon: Shield, label: "Defence" },
  { icon: Factory, label: "Manufacturing" },
];

const PAINS = [
  {
    icon: UserRound,
    title: "Everything comes back to you",
    text: "Decisions and problems wait for you, so the business only moves as fast as you do.",
  },
  {
    icon: Clock,
    title: "Your best people firefight",
    text: "Rework and chasing eat the hours that should be making money.",
  },
  {
    icon: Gauge,
    title: "Jobs take too long",
    text: "Work sits waiting between people and steps. Customers notice first.",
  },
  {
    icon: TrendingDown,
    title: "Sales up, profit flat",
    text: "More work brings more cost, because the way you work hasn't kept up.",
  },
];

const PHASES = [
  {
    step: "Step 1",
    title: "Score it",
    text: "Take the free BOSS Score: 13 quick questions, a score out of 100 across the 10 areas of your business.",
    photo: "/beyondlean/stock/whiteboard.jpg",
    href: SCORE_HREF,
    cta: "Get your score",
  },
  {
    step: "Step 2",
    title: "Talk it through",
    text: "On a free value call we find the one or two things costing you most, and agree a clear next step.",
    photo: null,
    href: BOOK_HREF,
    cta: "Book a value call",
  },
  {
    step: "Step 3",
    title: "Fix it, and make it stick",
    text: "A 90-day plan worked through side by side, measured before and after, until the change holds.",
    photo: "/beyondlean/stock/assembly-line.jpg",
    href: "#method",
    cta: "See how it works",
  },
];

const RESULTS = [
  {
    photo: "/beyondlean/stock/food-trays.jpg",
    figure: "£306k",
    label: "a year saved",
    status: "Delivered",
    title: "An airline caterer's business-class meals",
    text: "The tables and flow of work redesigned. The same meals made by 40 people instead of 57, beating the target by £90,000.",
  },
  {
    photo: "/beyondlean/stock/assembly-line.jpg",
    figure: "£1.4m",
    label: "a year found",
    status: "Found in the review",
    title: "A UK snack maker's packing lines",
    text: "13 lines running a third to two-thirds of the day. A plan to lift that to 70% with huddles, boards and faster changeovers.",
  },
  {
    photo: "/beyondlean/stock/whiteboard-present.jpg",
    figure: "£1m",
    label: "a year found",
    status: "Found in the review",
    title: "An energy trader's daily reports",
    text: "Three teams built the same reports, then met to check them. One owner per report freed the traders to trade.",
  },
];

const FAQS = [
  {
    q: "What happens on the value call?",
    a: "We look at your BOSS Score or your numbers, find the one or two things costing you most, and agree a next step. If I can't help, I'll tell you.",
  },
  {
    q: "What size of business do you work with?",
    a: "Owner-led UK businesses with a team and real processes, usually 10 to 50 people.",
  },
  {
    q: "Do you only work with manufacturers?",
    a: "No. If you have people and processes, I can help. Most of my work has been in manufacturing, food, finance, energy and contact centres.",
  },
  {
    q: "Do we meet in person?",
    a: "Both work. I'm based in North Wales and work with owners across the UK, in person or on Zoom.",
  },
  {
    q: "What does it cost?",
    a: "It depends on what we find. The BOSS Score and the value call are free, and you'll know the fee before you commit to anything.",
  },
];

const LIBRARY = [
  {
    tag: "Culture",
    title: "Kaizen Jitsu, the art of improvement",
    text: "What 40 years of martial arts taught me about making change stick.",
    href: "https://www.beyondlean.com/kaizen-jitsu.html",
  },
  {
    tag: "Operations",
    title: "Standardisation gone wrong",
    text: "Any process can be standardised. Use common sense first.",
    href: "https://www.beyondlean.com/standardisation.html",
  },
  {
    tag: "Leadership",
    title: "Effective meetings",
    text: "I didn't attend, and nobody died. How to win back your week.",
    href: "https://www.beyondlean.com/effective-meetings.html",
  },
];

function Wordmark() {
  return (
    <>
      <span className="v5-wm-a">Beyond</span>
      <span className="v5-wm-b">lean</span>
    </>
  );
}

function CircleButton({ href, children, tone = "blue" }: { href: string; children: React.ReactNode; tone?: "blue" | "white" }) {
  return (
    <a className={`v5-cbtn v5-cbtn-${tone}`} href={href}>
      <span className="v5-cbtn-ic" aria-hidden>
        <ArrowUpRight />
      </span>
      {children}
    </a>
  );
}

function Heading({ id, light, strong, center = false }: { id: string; light: string; strong: string; center?: boolean }) {
  return (
    <h2 id={id} className={`v5-h2${center ? " is-center" : ""}`}>
      <span>{light}</span> <strong>{strong}</strong>
    </h2>
  );
}

function Nav() {
  return (
    <header className="v5-nav" data-motion-nav>
      <div className="v5-wrap v5-nav-inner">
        <a className="v5-wordmark" href="#top" aria-label="Beyondlean, back to top">
          <Wordmark />
        </a>
        <nav className="v5-nav-pill" aria-label="Main">
          <a href="#method">How it works</a>
          <a href="#results">Results</a>
          <a href="#about">About Paul</a>
          <a href="#library">Library</a>
          <a href="#faq">FAQ</a>
        </nav>
        <a className="v5-phone" href={PHONE_HREF}>
          <span className="v5-phone-ic" aria-hidden>
            <Phone />
          </span>
          <span className="v5-phone-num">{PHONE}</span>
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="v5-hero" aria-labelledby="v5-hero-title" data-motion-hero>
      <div className="v5-hero-beams" aria-hidden />
      <p className="v5-hero-ghost" data-depth="0.14" aria-hidden>
        Beyond
      </p>
      <div className="v5-wrap v5-hero-grid">
        <div className="v5-hero-copy">
          <p className="v5-badge">
            <BadgeCheck aria-hidden /> Lean Six Sigma Master Black Belt · 25 years
          </p>
          <h1 id="v5-hero-title">25 years fixing how big firms work. Now I help owners do the same.</h1>
          <p className="v5-hero-lede">
            A 90-day plan to lift your profit and take you out of the middle of your business. Built by someone who has
            run one.
          </p>
          <div className="v5-hero-actions">
            <CircleButton href={BOOK_HREF}>Book a free value call</CircleButton>
            <a className="v5-link-light" href={SCORE_HREF}>
              Or get your free BOSS Score <ArrowRight aria-hidden />
            </a>
          </div>
          <div className="v5-hero-proof">
            <span className="v5-proof-figure">+160%</span>
            <span className="v5-proof-text">
              productivity for a UK bank&apos;s
              <br />
              mortgage team, offers out in half the time
            </span>
          </div>
        </div>
        <div className="v5-hero-figure" data-depth="0.06">
          <Image
            src="/beyondlean/paul-cutout.png"
            alt="Paul Swift"
            width={1050}
            height={1400}
            sizes="(max-width: 900px) 80vw, 560px"
            priority
          />
          <div className="v5-glass v5-glass-check">
            <BadgeCheck aria-hidden />
            <span>Has run his own business</span>
          </div>
          <div className="v5-glass v5-glass-ring">
            <svg viewBox="0 0 64 64" aria-hidden>
              <circle cx="32" cy="32" r="27" className="v5-ring-track" />
              <circle cx="32" cy="32" r="27" className="v5-ring-fill" pathLength={100} strokeDasharray="30 100" />
            </svg>
            <span className="v5-ring-num">30%</span>
            <span className="v5-ring-text">
              less labour for the same output at an airline caterer, £306k a year
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Sectors() {
  return (
    <section className="v5-sectors" aria-label="Sectors Paul has delivered results in">
      <div className="v5-wrap">
        <p className="v5-sectors-label">Results delivered in</p>
        <ul>
          {SECTORS.map(({ icon: Icon, label }) => (
            <li key={label}>
              <Icon aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Pains() {
  return (
    <section className="v5-section v5-white" aria-labelledby="v5-pains-title">
      <div className="v5-wrap">
        <div className="v5-head is-center" data-reveal>
          <Heading id="v5-pains-title" light="Busy, but the profit" strong="doesn't show it?" center />
          <p>Most of the fix is in how the work gets done. Sound familiar?</p>
        </div>
        <ul className="v5-pains">
          {PAINS.map(({ icon: Icon, title, text }) => (
            <li key={title} data-reveal>
              <span className="v5-icon-tile" aria-hidden>
                <Icon />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ul>
        <div className="v5-section-cta">
          <CircleButton href={SCORE_HREF}>See where yours stands: free BOSS Score</CircleButton>
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
            I helped grow profit fivefold. Then came Airbus, an airline caterer, and 20 years running Beyondlean for
            banks, energy firms and government teams.
          </p>
          <p>
            Big-firm problems show up in growing businesses too. Owners can fix them faster, so that&apos;s who I work
            with now.
          </p>
          <div className="v5-stat-cards">
            <div>
              <span className="v5-stat-num">+500%</span>
              <span>profit as Production Director of a small car business</span>
            </div>
            <div>
              <span className="v5-stat-num">£3m+</span>
              <span>signed-off savings in an 800-person contact centre</span>
            </div>
          </div>
          <CircleButton href={BOOK_HREF}>Book a free value call</CircleButton>
        </div>
      </div>
    </section>
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
          <Heading id="v5-phases-title" light="How we work together." strong="Score it. Talk it through. Fix it." center />
        </div>
        <ol className="v5-phase-cards">
          {PHASES.map((p) => (
            <li key={p.title} className={p.photo ? "v5-phase has-photo" : "v5-phase is-solid"} data-reveal>
              {p.photo && <Image src={p.photo} alt="" fill sizes="(max-width: 900px) 100vw, 400px" />}
              <div className="v5-phase-body">
                <span className="v5-phase-step">{p.step}</span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
                <a className="v5-outline-btn" href={p.href}>
                  {p.cta} <ArrowRight aria-hidden />
                </a>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Results() {
  return (
    <section className="v5-section v5-white" id="results" aria-labelledby="v5-results-title">
      <div className="v5-wrap">
        <div className="v5-head v5-head-split" data-reveal>
          <Heading id="v5-results-title" light="Real work." strong="Real numbers." />
          <p>Client names stay private. Each story says whether the money was saved or found in the review.</p>
        </div>
        <div className="v5-results">
          {RESULTS.map((r) => (
            <article key={r.title} className="v5-result" data-reveal>
              <div className="v5-result-photo">
                <Image src={r.photo} alt="" fill sizes="(max-width: 900px) 100vw, 400px" />
                <div className="v5-result-badge">
                  <span className="v5-result-num">{r.figure}</span>
                  <span>{r.label}</span>
                </div>
              </div>
              <div className="v5-result-body">
                <span className={r.status === "Delivered" ? "v5-status is-done" : "v5-status"}>{r.status}</span>
                <h3>{r.title}</h3>
                <p>{r.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Score() {
  return (
    <section className="v5-section v5-soft" aria-labelledby="v5-score-title">
      <div className="v5-wrap v5-score">
        <div className="v5-score-panel" data-reveal>
          <h2 id="v5-score-title" className="v5-h2 is-dark">
            <span>Where is your business losing money?</span> <strong>Find out free, in minutes.</strong>
          </h2>
          <p>
            13 quick questions give you a score out of 100 across the 10 areas of your business, from sales to systems
            to you as the owner. Then we go through it together.
          </p>
          <CircleButton href={SCORE_HREF} tone="white">
            Get your free BOSS Score
          </CircleButton>
        </div>
        <figure className="v5-score-card" data-reveal>
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

function Faq() {
  return (
    <section className="v5-section v5-white" id="faq" aria-labelledby="v5-faq-title">
      <div className="v5-wrap v5-faq">
        <div className="v5-faq-head">
          <Heading id="v5-faq-title" light="Questions owners" strong="ask first." />
          <p>Anything else, call me on {PHONE} or book a call.</p>
          <CircleButton href={BOOK_HREF}>Book a free value call</CircleButton>
        </div>
        <div className="v5-faq-list">
          {FAQS.map((f, i) => (
            <details key={f.q} open={i === 0}>
              <summary>
                {f.q}
                <ChevronDown aria-hidden />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Library() {
  return (
    <section className="v5-section v5-soft" id="library" aria-labelledby="v5-library-title">
      <div className="v5-wrap">
        <div className="v5-head v5-head-split" data-reveal>
          <Heading id="v5-library-title" light="From Paul's" strong="library." />
          <p>20 years of writing on getting the basics right. A few owners&apos; favourites.</p>
        </div>
        <div className="v5-library">
          {LIBRARY.map((a) => (
            <a key={a.title} className="v5-article" href={a.href} target="_blank" rel="noreferrer" data-reveal>
              <span className="v5-article-tag">{a.tag}</span>
              <h3>{a.title}</h3>
              <p>{a.text}</p>
              <span className="v5-article-more">
                Read the article <ArrowUpRight aria-hidden />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function Close() {
  return (
    <section className="v5-close-wrap" id="book" aria-labelledby="v5-close-title">
      <div className="v5-wrap">
        <div className="v5-close">
          <div className="v5-close-copy">
            <h2 id="v5-close-title" className="v5-h2 is-dark">
              <span>Ready when you are.</span> <strong>Book a free value call.</strong>
            </h2>
            <p>
              Pick a time that suits you. We look at where your business is now, where you want it to be, and what&apos;s
              in the way. If I can&apos;t help, I&apos;ll tell you.
            </p>
            <CircleButton href={BOOK_HREF} tone="white">
              Book a free value call
            </CircleButton>
            <ul className="v5-close-contact">
              <li>
                <Phone aria-hidden />
                <a href={PHONE_HREF}>{PHONE}</a>
              </li>
              <li>
                <Mail aria-hidden />
                <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
              </li>
            </ul>
          </div>
          <div className="v5-close-photo" aria-hidden>
            <Image src="/beyondlean/paul-cutout.png" alt="" width={1050} height={1400} sizes="(max-width: 900px) 70vw, 440px" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="v5-footer">
      <div className="v5-wrap v5-footer-grid">
        <div>
          <span className="v5-wordmark">
            <Wordmark />
          </span>
          <p>
            Business coaching for owner-led UK businesses. 25 years of making work flow, now helping owners get their
            time and profit back.
          </p>
        </div>
        <div>
          <h3>Explore</h3>
          <a href="#method">How it works</a>
          <a href="#results">Results</a>
          <a href="#about">About Paul</a>
          <a href="#faq">FAQ</a>
        </div>
        <div>
          <h3>Get started</h3>
          <a href={SCORE_HREF}>Free BOSS Score</a>
          <a href={BOOK_HREF}>Book a value call</a>
          <a href="#library">Paul&apos;s library</a>
        </div>
        <div>
          <h3>Contact</h3>
          <a href={PHONE_HREF}>{PHONE}</a>
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
          <span>North Wales, working UK-wide</span>
          <a href="https://www.linkedin.com/in/paul-swift-b360b34" target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        </div>
      </div>
      <div className="v5-wrap v5-footer-bottom">
        <span>© {new Date().getFullYear()} Beyondlean Ltd. Improvement never ends.</span>
      </div>
    </footer>
  );
}

export function BeyondleanV5({ switcher }: { switcher?: React.ReactNode }) {
  return (
    <div className={`bp-root bp-bca v5-root ${figtree.variable} ${instrumentSerif.variable}`} id="top" data-motion-root>
      <Nav />
      <main>
        <Hero />
        <Sectors />
        <Pains />
        <About />
        <div id="method">
          <Untangle scoreHref={SCORE_HREF} />
        </div>
        <Phases />
        <Results />
        <Score />
        <Faq />
        <Library />
        <Close />
      </main>
      <Footer />
      <PremiumMotion />
      {switcher}
    </div>
  );
}
