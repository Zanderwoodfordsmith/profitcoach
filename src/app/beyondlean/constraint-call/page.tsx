import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  Check,
  Clock,
  MoveRight,
  NotebookPen,
  Plus,
  ShieldCheck,
  Target,
  User,
  X,
} from "lucide-react";
import { StartApplyPanelNative } from "@/components/booking/StartApplyPanelNative";
import {
  BOOKING,
  CALL_AGENDA,
  FOR,
  NOT_FOR,
} from "@/components/beyondlean/data";
import { ConstraintWheel } from "@/components/beyondlean/v5/ConstraintWheel";
import { Heading, V5Shell } from "@/components/beyondlean/v5/parts";
import { beyondleanMode } from "@/lib/beyondlean/mode";
import "@/components/beyondlean/v5/how.css";
import "@/components/beyondlean/v5/book.css";

export const metadata: Metadata = {
  title: "The Constraint Call | Paul Swift, Beyondlean",
  description:
    "Every business has one thing holding the rest back. In 30 minutes, one to one, Paul Swift finds yours and the one to three things to fix first.",
  robots: { index: false, follow: false },
};

/** A simple line of work, with the slow step and the pile in front of it. */
const LINE = ["Enquiries", "Quotes", "Orders", "Delivery", "Invoicing"];
const SLOW = 1;

const TAKEAWAYS = [
  {
    title: "The one thing holding you back",
    text: "Named plainly, from your own numbers.",
  },
  {
    title: "The one to three things to do next",
    text: "In the order to do them, so the first fix makes the next one easier.",
  },
  { title: "Notes you keep", text: "Yours whether we work together or not." },
];

const QUESTIONS = [
  {
    q: "Do I need to take the BOSS Score first?",
    a: "It helps. If you've taken it, we start with your scores. If not, bring your rough numbers and we work from those.",
  },
  {
    q: "What should I bring?",
    a: "Your rough numbers (sales, profit, team size) and the thing that bothers you most right now. And an honest picture of where the business really is.",
  },
  {
    q: "Is it a sales pitch?",
    a: "It's 30 minutes on your business. If there's a fit, we talk about working together at the end, and you'll know the full fee before you commit to anything. If there isn't, you keep the notes and the plan.",
  },
  {
    q: "What if you can't help?",
    a: "I'll tell you, and where I can, I'll point you to someone who can.",
  },
];

/** The booking section on trial: Blue (default) and Light beside the old dark card, preview only. */
const BOOK_LOOKS = [
  { key: "blue", label: "Blue" },
  { key: "light", label: "Light" },
  { key: "old", label: "Old" },
] as const;

type BookLook = (typeof BOOK_LOOKS)[number]["key"];

function BookSwitch({ current }: { current: BookLook }) {
  return (
    <nav className="bl-switch" aria-label="Booking versions (preview only)">
      <span>Booking</span>
      {BOOK_LOOKS.map((l) => (
        <a
          key={l.key}
          href={`?book=${l.key}#book`}
          aria-current={current === l.key ? "page" : undefined}
        >
          {l.label}
        </a>
      ))}
    </nav>
  );
}

const BOOK_POINTS = [
  { icon: User, text: "Free, one to one with Paul" },
  { icon: NotebookPen, text: "You keep the notes" },
  { icon: ShieldCheck, text: "If I can't help, I'll tell you" },
];

function BookingForm() {
  return (
    <StartApplyPanelNative
      variant="page"
      intent="owner"
      enableLeadCapture
      slug={BOOKING.slug}
      calendarSlug={BOOKING.calendar}
      title="Book your Constraint Call"
      lead="Tell me a bit about your business, then pick a time."
    />
  );
}

/** Words and proof on the left, one white booking card on the right; on the brand blue or a pale blue. */
function BookBand({ tone }: { tone: "blue" | "light" }) {
  return (
    <section
      className={`v5-bk is-${tone}`}
      id="book"
      aria-labelledby="v5-cc-book-title"
    >
      {tone === "blue" && <div className="v5-hero-beams" aria-hidden />}
      <div className="v5-wrap v5-bk-grid">
        <div className="v5-bk-head">
          <Heading
            id="v5-cc-book-title"
            light="30 minutes."
            strong="One thing found."
          />
          <p>
            Every week the slow step stays, the work around it keeps piling up.
          </p>
        </div>
        <div className="v5-bk-form">
          <BookingForm />
        </div>
        <div className="v5-bk-trust">
          <ul className="v5-bk-points">
            {BOOK_POINTS.map(({ icon: Icon, text }) => (
              <li key={text}>
                <Icon aria-hidden /> {text}
              </li>
            ))}
          </ul>
          <div className="v5-bk-paul">
            <Image src="/beyondlean/paul.jpg" alt="" width={104} height={104} />
            <span>
              <strong>Paul Swift</strong>
              Lean Six Sigma Master Black Belt
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function PickTime({ label = "Pick a Time" }: { label?: string }) {
  return (
    <a className="v5-cta-btn" href="#book">
      {label} <MoveRight aria-hidden />
    </a>
  );
}

type Props = { searchParams: Promise<{ book?: string }> };

export default async function ConstraintCallPage({ searchParams }: Props) {
  const { enabled, preview } = beyondleanMode();
  if (!enabled) notFound();
  const asked = preview ? (await searchParams).book : undefined;
  const look: BookLook = BOOK_LOOKS.find((l) => l.key === asked)?.key ?? "blue";

  return (
    <V5Shell
      active="home"
      switcher={preview ? <BookSwitch current={look} /> : null}
    >
      {/* 1 Revolutionary: the promise, with the wheel that shows it. */}
      <section
        className="v5-cc-hero"
        aria-labelledby="v5-cc-title"
        data-motion-hero
      >
        <div className="v5-hero-beams" aria-hidden />
        <div className="v5-wrap v5-cc-hero-grid">
          <div className="v5-cc-hero-copy">
            <p className="v5-badge is-outline">
              <Target aria-hidden /> The Constraint Call
            </p>
            <Heading
              as="h1"
              id="v5-cc-title"
              light="Your business has one constraint."
              strong="Let's find it, and fix it first."
            />
            <p className="v5-page-lede">
              You and your team are putting in the work. Most of it is queuing
              up behind one thing. Find that, and the effort you already make
              starts to pay off. I&apos;ll show you what it is.
            </p>
            <div className="v5-cc-hero-actions">
              <PickTime />
              <ul className="v5-cc-facts">
                <li>
                  <Clock aria-hidden /> 30 minutes
                </li>
                <li>
                  <User aria-hidden /> One to one
                </li>
                <li>
                  <Check aria-hidden /> Free
                </li>
              </ul>
            </div>
          </div>
          <figure className="v5-cc-hero-wheel" data-depth="0.05">
            <ConstraintWheel dark ground="#0a2d57" />
            <figcaption className="v5-glass v5-cc-chip is-areas">
              <strong>10 areas</strong>
              <span>checked in a set order</span>
            </figcaption>
            <div className="v5-glass v5-cc-chip is-paul">
              <Image src="/beyondlean/paul.jpg" alt="" width={96} height={96} />
              <span>
                <strong>With Paul Swift</strong>
                25 years finding the slow step
              </span>
            </div>
          </figure>
        </div>
      </section>

      {/* 2 to 5 Resentment, recognition, redefine: the slow machine sets the pace (The Goal). */}
      <section
        className="v5-section v5-white"
        aria-labelledby="v5-cc-why-title"
      >
        <div className="v5-wrap v5-cc-split">
          <div data-reveal>
            <Heading
              id="v5-cc-why-title"
              light="Why more effort"
              strong="hasn't moved it."
            />
            <p className="v5-cc-text">
              Another hire. A new system. A push on sales. Each one helped a
              bit, and still the business runs through you.
            </p>
            <p className="v5-cc-text">
              Picture a line of work. One step is slower than the rest, and it
              sets the pace for all of it. Speed up any other step and the work
              just piles up in front of the slow one. An hour saved there is an
              hour saved everywhere. An hour saved anywhere else changes very
              little.
            </p>
            <p className="v5-cc-text">
              Every business has a slow step. It might be quoting, hiring, cash,
              a manager, or you.
            </p>
          </div>
          <figure
            className="v5-cc-line"
            data-reveal
            aria-label="A line of work where quotes are the slow step and work piles up in front of it"
          >
            <ol>
              {LINE.map((name, i) => (
                <li
                  key={name}
                  className={
                    i === SLOW ? "is-slow" : i < SLOW ? "is-before" : undefined
                  }
                >
                  {i === SLOW && (
                    <span className="v5-cc-pile" aria-hidden>
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                  <span className="v5-cc-station">{name}</span>
                  {i === SLOW && (
                    <span className="v5-cc-slow-tag">Your constraint</span>
                  )}
                </li>
              ))}
            </ol>
            <figcaption>
              Speed up any other step and the pile just grows.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* The calendar, third on the page. 11 and 12: reverse and risk. */}
      {look !== "old" ? (
        <BookBand tone={look} />
      ) : (
        <section
          className="v5-cc-book"
          id="book"
          aria-labelledby="v5-cc-book-title"
        >
          <div className="v5-wrap">
            <div className="v5-cta v5-cc-book-card">
              <div className="v5-cta-copy v5-cc-book-copy">
                <p className="v5-cta-eyebrow">Book your call</p>
                <h2 id="v5-cc-book-title" className="v5-cta-title">
                  <span>30 minutes.</span> <strong>One thing found.</strong>
                </h2>
                <p className="v5-cta-text">
                  A few quick details, three taps, then pick a time that suits
                  you. Every week the slow step stays, the work around it keeps
                  piling up.
                </p>
                <ul className="v5-cc-book-points">
                  <li>
                    <Check aria-hidden /> One to one with Paul
                  </li>
                  <li>
                    <Check aria-hidden /> You keep the notes
                  </li>
                  <li>
                    <Check aria-hidden /> If I can&apos;t help, I&apos;ll tell
                    you
                  </li>
                </ul>
              </div>
              <div className="v5-cc-book-panel">
                <BookingForm />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 6 and 7 Revelation and release: the thinking's done, and what they walk away with. */}
      <section
        className="v5-section v5-soft"
        aria-labelledby="v5-cc-done-title"
      >
        <div className="v5-wrap">
          <div className="v5-head" data-reveal>
            <Heading
              id="v5-cc-done-title"
              light="The thinking's"
              strong="already done for you."
            />
            <p>
              You bring your numbers and an honest picture. The Profit System
              does the sorting. It checks the 10 areas of your business in a set
              order, from sales and cash to systems, your team and you, so we
              spend the 30 minutes on the answer instead of guessing where to
              look.
            </p>
          </div>
          <ol className="v5-cc-takeaways">
            {TAKEAWAYS.map((t, i) => (
              <li key={t.title} data-reveal>
                <span className="v5-cc-num" aria-hidden>
                  {i + 1}
                </span>
                <h3>{t.title}</h3>
                <p>{t.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 8 and 9 Reasons and reassure: how the 30 minutes go, and one real result. */}
      <section
        className="v5-section v5-white"
        aria-labelledby="v5-cc-how-title"
      >
        <div className="v5-wrap v5-cc-split is-top">
          <div className="v5-how-visual v5-how-call" data-reveal>
            <p className="v5-how-label">The 30 minutes</p>
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
          </div>
          <div data-reveal>
            <Heading
              id="v5-cc-how-title"
              light="25 years of finding"
              strong="the slow step."
            />
            <p className="v5-cc-text">
              I&apos;ve done this in aerospace, banking, energy and food
              production, and I&apos;ve run a small business of my own, so I
              know what it&apos;s like when everything lands on you.
            </p>
            <blockquote className="v5-cc-proof">
              <p>
                At an airline caterer I worked for, one meal area had 57 people
                against a target of 45. The project scored the possible fixes
                and started with the one that came top: keeping the tables
                supplied. The area finished with 40 people, saving £306,000 a
                year.
              </p>
              <footer>
                <Image
                  src="/beyondlean/paul.jpg"
                  alt=""
                  width={96}
                  height={96}
                />
                <span>
                  <strong>Paul Swift</strong>
                  Lean Six Sigma Master Black Belt
                </span>
              </footer>
            </blockquote>
          </div>
        </div>
      </section>

      <section className="v5-section v5-soft" aria-labelledby="v5-cc-fit-title">
        <div className="v5-wrap">
          <div className="v5-head is-center" data-reveal>
            <Heading
              id="v5-cc-fit-title"
              light="Is this for you?"
              strong="Be honest, and we get further."
              center
            />
            <p>
              I ask one thing: tell me where the business really is. The more
              specific you are, the more useful the 30 minutes.
            </p>
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
        </div>
      </section>

      <section
        className="v5-section v5-white"
        aria-labelledby="v5-cc-faq-title"
      >
        <div className="v5-wrap v5-cc-faq">
          <div className="v5-head is-center" data-reveal>
            <Heading
              id="v5-cc-faq-title"
              light="Before you"
              strong="book."
              center
            />
          </div>
          <div className="v5-faq2-list">
            {QUESTIONS.map((f, i) => (
              <details key={f.q} open={i === 0}>
                <summary>
                  {f.q}
                  <span className="v5-faq2-ic" aria-hidden>
                    <Plus />
                  </span>
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
          <div className="v5-cc-faq-cta">
            <PickTime label="Book Your Constraint Call" />
          </div>
        </div>
      </section>
    </V5Shell>
  );
}
