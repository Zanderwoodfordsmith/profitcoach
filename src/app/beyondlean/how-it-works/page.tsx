import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";
import { BOOK_HREF, SCORE_HREF } from "@/components/beyondlean/BeyondleanSite";
import { Untangle } from "@/components/beyondlean/Untangle";
import { CircleButton, CloseCard, Heading, HOME, PageHero, ScoreCallout, V5Shell } from "@/components/beyondlean/v5/parts";
import { beyondleanMode } from "@/lib/beyondlean/mode";

export const metadata: Metadata = {
  title: "How it works | Paul Swift, Beyondlean",
  description:
    "Score your business, talk it through on a free value call, then fix what matters most with a 90-day plan worked through side by side.",
  robots: { index: false, follow: false },
};

const STEPS = [
  {
    title: "Score it",
    text: "Take the free BOSS Score. It shows where your business is strong and where it leaks time and money, before anyone gives you an opinion.",
    points: [
      "13 quick questions, free",
      "A score out of 100 across the 10 areas of your business",
      "From sales and cash to systems, your team and you as the owner",
    ],
    cta: { href: SCORE_HREF, label: "Get your free BOSS Score" },
  },
  {
    title: "Talk it through",
    text: "On a free value call we go through your score and your numbers together, and find the one or two things costing you most.",
    points: [
      "We look at where you are now and where you want to be",
      "You leave with a clear next step, whether we work together or not",
      "If I can't help, I'll tell you",
    ],
    cta: { href: BOOK_HREF, label: "Book a free value call" },
  },
  {
    title: "Fix it, and make it stick",
    text: "We build a 90-day plan around the biggest leak first, then work through it side by side, in person or on Zoom.",
    points: [
      "Measured before and after, so you see what changed",
      "Your team learns the new way of working, so it lasts without me",
      "Then we move to the next leak",
    ],
    cta: { href: BOOK_HREF, label: "Start with a value call" },
  },
];

const FOR = [
  "You own a UK business with a team, usually 10 to 50 people",
  "Every decision and problem still lands on you",
  "You're busy, but the profit doesn't show it",
  "You'll do your part and want results you can measure",
];

const NOT_FOR = [
  "You aren't willing to change how you work yourself",
  "You want someone to take the business off your hands",
  "You're looking for a quick fix with no work from the team",
];

export default function HowItWorksPage() {
  if (!beyondleanMode().enabled) notFound();
  return (
    <V5Shell active="how">
      <PageHero
        crumb={[{ href: `${HOME}/how-it-works`, label: "How it works" }]}
        light="How it works."
        strong="Score it. Talk it through. Fix it."
        lede="Measure first, then fix what matters most. The same method I've used for 25 years in aerospace, banking, energy and food production, shaped for owner-led businesses."
      >
        <div className="v5-hero-actions">
          <CircleButton href={BOOK_HREF}>Book a free value call</CircleButton>
        </div>
      </PageHero>

      <section className="v5-section v5-soft" aria-label="The three steps">
        <div className="v5-wrap">
          <ol className="v5-steps-long">
            {STEPS.map((s, i) => (
              <li key={s.title} className="v5-step-long" data-reveal>
                <span className="v5-step-num" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2>{s.title}</h2>
                  <p>{s.text}</p>
                  <CircleButton href={s.cta.href}>{s.cta.label}</CircleButton>
                </div>
                <ul>
                  {s.points.map((p) => (
                    <li key={p}>
                      <Check aria-hidden />
                      {p}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Untangle scoreHref={SCORE_HREF} />

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

      <CloseCard />
    </V5Shell>
  );
}
