import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BOOK_HREF, CAREER } from "@/components/beyondlean/data";
import { CircleButton, CloseCard, Heading, HOME, PageHero, V5Shell, VersionSwitch } from "@/components/beyondlean/v5/parts";
import { beyondleanMode } from "@/lib/beyondlean/mode";

export const metadata: Metadata = {
  title: "About Paul Swift | Beyondlean",
  description:
    "From fitter on the shop floor to running his own business, Airbus and 20 years of Beyondlean. Paul Swift now coaches owners of growing UK businesses.",
  robots: { index: false, follow: false },
};

const VALUES = ["Honesty", "Keep your word", "Fairness", "Always learning", "Have fun"];

const CREDENTIALS = [
  "Lean Six Sigma Master Black Belt",
  "HNC Engineering",
  "NVQ 3 Coaching Award",
  "Trained in The Profit System",
];

type Props = { searchParams: Promise<{ v?: string }> };

export default async function AboutPage({ searchParams }: Props) {
  const { enabled, preview } = beyondleanMode();
  if (!enabled) notFound();
  const old = preview && (await searchParams).v === "old";
  return (
    <V5Shell active="about" switcher={preview ? <VersionSwitch current={old ? "old" : "new"} /> : null}>
      <PageHero
        light="I've run a small business myself."
        strong="So I know where it hurts."
        lede="25 years of making work flow, from the shop floor to the boardroom. Now I help owners of growing UK businesses do the same in their own."
      />

      <section className="v5-section v5-white" aria-labelledby="v5-story-title">
        <div className="v5-wrap v5-about">
          <figure className="v5-about-photo" data-reveal>
            <Image
              src={old ? "/beyondlean/paul.jpg" : "/beyondlean/paul-wales.jpg"}
              alt="Paul Swift"
              width={1050}
              height={1400}
              sizes="(max-width: 900px) 100vw, 480px"
              priority
            />
            <figcaption className="v5-photo-badge">
              <span className="v5-photo-badge-num">20</span>
              <span>years running Beyondlean Ltd</span>
            </figcaption>
          </figure>
          <div className="v5-about-copy">
            <Heading id="v5-story-title" light="My story," strong="in plain words." />
            <p>
              I started out as a fitter at Royal Ordnance, working on torpedoes. It taught me that how work is done on the
              floor decides everything else.
            </p>
            <p>
              Then I ran my own business: a car sales and MOT centre. I know what it&apos;s like when every decision, every
              problem and every bill lands on you.
            </p>
            <p>
              As a Production Director I helped grow profit by 500%, freed up cash and cut stock right back. At Airbus I
              learned Lean the Toyota way, and helped design a culture-change programme for 10,000 people. At an airline
              caterer I helped get a business back on its feet after an industrial dispute.
            </p>
            <p>
              In 2006 I set up Beyondlean. For 20 years I&apos;ve worked with banks, insurers, energy firms, media companies
              and government teams, fixing how work flows and training their people to keep it going.
            </p>
            <p>
              The problems I fixed in big firms show up in growing businesses too. The difference is that an owner can
              move fast. That&apos;s why I now work with owners.
            </p>
            <CircleButton href={BOOK_HREF}>Book a Constraint Call</CircleButton>
          </div>
        </div>
      </section>

      <section className="v5-section v5-soft" aria-labelledby="v5-career-title">
        <div className="v5-wrap">
          <div className="v5-head" data-reveal>
            <Heading id="v5-career-title" light="From the shop floor" strong="to the boardroom, and back." />
          </div>
          <ol className="v5-timeline">
            {CAREER.map((c) => (
              <li key={c.year} data-reveal>
                <span className="v5-timeline-year">{c.year}</span>
                <strong>{c.role}</strong>
                <span>{c.place}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="v5-section v5-white" aria-labelledby="v5-values-title">
        <div className="v5-wrap v5-two-col">
          <div data-reveal>
            <Heading id="v5-values-title" light="What I stand for." strong="How I work with you." />
            <div className="v5-prose">
              <p>
                Any improvement is 20% about the tools and 80% about the people. I&apos;ll tell you straight what I see,
                I&apos;ll do what I say, and I&apos;ll measure whether it worked.
              </p>
              <p>
                Outside work I live on a small farm in North Wales with dogs and ponies. I hold a 5th Dan black belt in
                karate and coach two clubs. Both teach the same thing: get the basics right, then keep improving.
              </p>
            </div>
          </div>
          <div data-reveal>
            <ul className="v5-values" aria-label="Values">
              {VALUES.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
            <h3 className="v5-small-head">Qualifications</h3>
            <ul className="v5-chips">
              {CREDENTIALS.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <CloseCard />
    </V5Shell>
  );
}
