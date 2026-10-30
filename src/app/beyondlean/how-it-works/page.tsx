import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, RotateCw, X } from "lucide-react";
import { BossWheel } from "@/components/BossCharts/BossWheel";
import { BOOK_HREF, CALL_AGENDA, EXAMPLE_AREA_SCORES, EXAMPLE_TOTAL, FOR, NOT_FOR, SCORE_HREF } from "@/components/beyondlean/data";
import { Untangle } from "@/components/beyondlean/Untangle";
import { PhaseRail } from "@/components/beyondlean/v5/PhaseRail";
import { HowPage } from "@/components/beyondlean/v5/HowPage";
import {
  CircleButton,
  CloseCard,
  FaqSection,
  Heading,
  HOME,
  PageHero,
  ScoreCallout,
  V5Shell,
  VersionSwitch,
} from "@/components/beyondlean/v5/parts";
import { getCaseStudies } from "@/lib/beyondlean/content";
import { beyondleanMode } from "@/lib/beyondlean/mode";
import "@/components/beyondlean/v5/how.css";

export const metadata: Metadata = {
  title: "How it works | Paul Swift, Beyondlean",
  description:
    "Score your business, find the one thing holding it back on a Constraint Call, then fix what matters most with a 90-day plan worked through side by side.",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ v?: string }> };

const STEPS = [
  {
    title: "Score it",
    text: "Take the free BOSS Score. It shows where your business is strong and where it leaks time and money, before anyone gives you an opinion.",
    points: [
      "13 quick questions, free",
      "A score out of 100 across the 10 areas of your business",
      "From sales and cash to systems, your team and you as the owner",
    ],
    cta: { href: SCORE_HREF, label: "Get Your Free BOSS Score" },
  },
  {
    title: "Talk it through",
    text: "On a Constraint Call we go through your score and your numbers together, and find the one thing holding your business back.",
    points: [
      "We look across the whole business: sales, operations, team, cash and you",
      "You leave with the one to three things to do next, whether we work together or not",
      "If I can't help, I'll tell you",
    ],
    cta: { href: BOOK_HREF, label: "Book a Constraint Call" },
  },
  {
    title: "Fix it, and make it stick",
    text: "We build a 90-day plan around the biggest leak first, then work through it side by side, in person or on Zoom.",
    points: [
      "Measured before and after, so you see what changed",
      "Your team learns the new way of working, so it lasts without me",
      "Then we move to the next leak",
    ],
    cta: { href: BOOK_HREF, label: "Start With a Constraint Call" },
  },
];

const CHAPTERS = [
  { id: "score", num: "01", title: "Score it" },
  { id: "talk", num: "02", title: "Talk it through" },
  { id: "fix", num: "03", title: "Fix it" },
];

/** Paul's Standard Business Roadmap (content/beyondlean/blog/standard-business-roadmap.md). */
const ROADMAP = [
  { title: "Diagnostic", text: "A clear picture of where you are now." },
  { title: "Stability", text: "Get control of the basics, so you have a solid base to build on." },
  { title: "Strategy", text: "Agree where you're going and the plan to get there." },
  { title: "Action", text: "Make the changes with your team. Don't wait for perfect, get it going." },
  { title: "Evaluation", text: "Measure what changed against where you started." },
];

function Points({ items }: { items: string[] }) {
  return (
    <ul className="v5-how-points">
      {items.map((p) => (
        <li key={p}>
          <Check aria-hidden />
          {p}
        </li>
      ))}
    </ul>
  );
}

function ChapterHead({ num, title, text }: { num: string; title: string; text: string }) {
  return (
    <>
      <span className="v5-how-step">Step {num}</span>
      <h2 className="v5-how-chapter-title">{title}</h2>
      <p className="v5-how-chapter-text">{text}</p>
    </>
  );
}

function FitSection() {
  return (
    <section className="v5-section v5-white" aria-labelledby="v5-fit-title">
      <div className="v5-wrap">
        <div className="v5-head is-center" data-reveal>
          <Heading id="v5-fit-title" light="Is this for you?" strong="Who I work with, and who I don't." center />
        </div>
        <div className="v5-fit">
          <div className="v5-fit-card is-yes" data-reveal>
            <h3>
              <Check aria-hidden /> This is for you if
            </h3>
            <ul>
              {FOR.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
          <div className="v5-fit-card" data-reveal>
            <h3>
              <X aria-hidden /> This is not for you if
            </h3>
            <ul>
              {NOT_FOR.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
        <ScoreCallout title="Not sure yet? Start with your score." />
      </div>
    </section>
  );
}

function Phases() {
  return (
    <section className="v5-section v5-soft v5-how-phases" aria-labelledby="v5-how-phases-title">
      <div className="v5-wrap">
        <div className="v5-head" data-reveal>
          <Heading id="v5-how-phases-title" light="Three steps." strong="Measure first, then fix what matters." />
        </div>
        <div className="v5-how-layout">
          <aside className="v5-how-rail-col">
            <PhaseRail steps={CHAPTERS} />
          </aside>
          <div className="v5-how-chapters">
            <article id="score" className="v5-how-chapter">
              <div className="v5-how-chapter-copy">
                <ChapterHead num="01" title="Score it" text={STEPS[0].text} />
                <Points items={STEPS[0].points} />
                <CircleButton href={SCORE_HREF}>Get Your Free BOSS Score</CircleButton>
              </div>
              <figure className="v5-how-visual v5-how-score">
                <figcaption className="v5-how-label">Example score</figcaption>
                <BossWheel
                  areaScores={EXAMPLE_AREA_SCORES}
                  totalScore={EXAMPLE_TOTAL}
                  showLegend={false}
                  size="compact"
                  aria-label="Example BOSS wheel across ten business areas"
                />
              </figure>
            </article>

            <article id="talk" className="v5-how-chapter">
              <div className="v5-how-chapter-copy">
                <ChapterHead num="02" title="Talk it through" text={STEPS[1].text} />
                <Points items={STEPS[1].points} />
                <CircleButton href={BOOK_HREF}>Book a Constraint Call</CircleButton>
              </div>
              <div className="v5-how-visual v5-how-call">
                <p className="v5-how-label">The Constraint Call</p>
                <ol className="v5-how-agenda">
                  {CALL_AGENDA.map((a, i) => (
                    <li key={a.title}>
                      <span className="v5-how-agenda-num" aria-hidden>
                        {i + 1}
                      </span>
                      <div>
                        <strong>{a.title}</strong>
                        <span>{a.text}</span>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="v5-how-call-foot">
                  <Image src="/beyondlean/paul.jpg" alt="" width={96} height={96} />
                  <div>
                    <strong>With Paul Swift</strong>
                    <span>Free. If I can&apos;t help, I&apos;ll tell you.</span>
                  </div>
                </div>
              </div>
            </article>

            <article id="fix" className="v5-how-chapter">
              <div className="v5-how-chapter-copy">
                <ChapterHead num="03" title="Fix it, and make it stick" text={STEPS[2].text} />
                <Points items={STEPS[2].points} />
                <CircleButton href={BOOK_HREF}>Start With a Constraint Call</CircleButton>
              </div>
              <div className="v5-how-visual v5-how-roadmap">
                <p className="v5-how-label">My five-step roadmap</p>
                <ol className="v5-how-road">
                  {ROADMAP.map((r, i) => (
                    <li key={r.title} className={i === 0 ? "is-done" : undefined}>
                      <span className="v5-how-road-num" aria-hidden>
                        {i === 0 ? <Check /> : i + 1}
                      </span>
                      <div>
                        <strong>{r.title}</strong>
                        <span>{r.text}</span>
                        {i === 0 && <em>Your score and the Constraint Call cover this</em>}
                        {i === 1 && <em className="is-plan">Your 90-day plan starts here</em>}
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="v5-how-road-loop">
                  <RotateCw aria-hidden /> Then round again on the next leak.
                </p>
                <Link className="v5-text-link" href={`${HOME}/blog/standard-business-roadmap`}>
                  Read about the roadmap <ArrowRight aria-hidden />
                </Link>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

function Proof() {
  const studies = getCaseStudies().slice(0, 3);
  if (studies.length === 0) return null;
  return (
    <section className="v5-section v5-white" aria-labelledby="v5-how-proof-title">
      <div className="v5-wrap">
        <div className="v5-head v5-head-split" data-reveal>
          <Heading id="v5-how-proof-title" light="What fixing it" strong="looked like elsewhere." />
          <Link className="v5-text-link" href={`${HOME}/case-studies`}>
            All Case Studies <ArrowRight aria-hidden />
          </Link>
        </div>
        <div className="v5-how-proof">
          {studies.map((c) => (
            <Link key={c.slug} href={`${HOME}/case-studies/${c.slug}`} className="v5-how-proof-card" data-reveal>
              <div className="v5-how-proof-media">
                {c.photo && <Image src={c.photo} alt="" fill sizes="(max-width: 900px) 100vw, 400px" />}
                <div className="v5-how-proof-figure">
                  <strong>{c.figure}</strong>
                  <span>{c.figureLabel}</span>
                </div>
              </div>
              <div className="v5-how-proof-body">
                <span className="v5-how-proof-client">{c.client}</span>
                <h3>{c.title}</h3>
                <span className="v5-article-more">
                  Read the case study <ArrowRight aria-hidden />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function HowItWorksPage({ searchParams }: Props) {
  const { enabled, preview } = beyondleanMode();
  if (!enabled) notFound();
  const old = preview && (await searchParams).v === "old";
  const switcher = preview ? <VersionSwitch current={old ? "old" : "new"} /> : null;
  if (!old) return <HowPage switcher={switcher} />;

  // Earlier version (sticky step rail), kept under Old until Zander picks.
  return (
    <V5Shell active="how" switcher={switcher}>
      <PageHero
        light="How it works."
        strong="Three steps to more profit and less firefighting."
        lede="Measure first, then fix what matters most. It's the same method I've used for 25 years in aerospace, banking, energy and food production, shaped for owner-led businesses."
      >
        <div className="v5-hero-actions">
          <CircleButton href={SCORE_HREF}>Get Your Free BOSS Score</CircleButton>
          <a className="v5-how-hero-link" href={BOOK_HREF}>
            or book a Constraint Call <ArrowRight aria-hidden />
          </a>
        </div>
        <nav className="v5-how-chips" aria-label="Jump to a step">
          {CHAPTERS.map((c) => (
            <a key={c.id} href={`#${c.id}`}>
              <span>{c.num}</span>
              {c.title}
            </a>
          ))}
        </nav>
      </PageHero>

      <Untangle scoreHref={SCORE_HREF} />

      <Phases />

      <Proof />

      <FitSection />

      <FaqSection />
      <CloseCard />
    </V5Shell>
  );
}
