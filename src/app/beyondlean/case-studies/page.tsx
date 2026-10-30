import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import {
  CloseCard,
  Heading,
  HOME,
  PageHero,
  ScoreCallout,
  V5Shell,
} from "@/components/beyondlean/v5/parts";
import { getCaseStudies, glance, sections, type CaseStudy } from "@/lib/beyondlean/content";
import { beyondleanMode } from "@/lib/beyondlean/mode";

export const metadata: Metadata = {
  title: "Case studies | Paul Swift, Beyondlean",
  description: "Real projects, real numbers. How Paul Swift fixed the way work gets done in food production, finance, energy and more.",
  robots: { index: false, follow: false },
};

function Figure({ study, label = true }: { study: CaseStudy; label?: boolean }) {
  return (
    <div className="v5-cs-figure">
      <strong>{study.figure}</strong>
      {label && <span>{study.figureLabel}</span>}
    </div>
  );
}

/** The lead story, wide (BCA case studies layout): result over client, the numbers, then the photo. */
function FeaturedStory({ study, first = false }: { study: CaseStudy; first?: boolean }) {
  const stats = glance(sections(study.body)["At a glance"] ?? "").slice(0, 3);
  return (
    <Link href={`${HOME}/case-studies/${study.slug}`} className="v5-cs-feature" data-reveal>
      <div className="v5-cs-feature-copy">
        <h2 className="v5-cs-title">
          <span>{study.client}</span>{" "}
          <strong>
            {study.figure} {study.figureLabel}
          </strong>
        </h2>
        <p className="v5-cs-teaser">{study.summary}</p>
        {stats.length > 0 && (
          <dl className="v5-cs-stats">
            {stats.map((s) => (
              <div key={s.text}>
                <dt>{s.figure}</dt>
                <dd>{s.text}</dd>
              </div>
            ))}
          </dl>
        )}
        <span className="v5-cs-btn">
          Read the case study <ArrowRight aria-hidden />
        </span>
      </div>
      <div className="v5-cs-feature-media">
        {study.photo && <Image src={study.photo} alt="" fill sizes="(max-width: 900px) 100vw, 560px" priority={first} />}
        <Figure study={study} label={false} />
      </div>
    </Link>
  );
}

/** One story in the two-column grid: photo with the number, then client over result. */
function StoryCard({ study }: { study: CaseStudy }) {
  return (
    <Link href={`${HOME}/case-studies/${study.slug}`} className="v5-cs-card" data-reveal>
      <div className="v5-cs-card-media">
        {study.photo && <Image src={study.photo} alt="" fill sizes="(max-width: 900px) 100vw, 260px" />}
        <Figure study={study} label={false} />
      </div>
      <div className="v5-cs-card-body">
        <h3 className="v5-cs-title">
          <span>{study.client}</span>{" "}
          <strong>
            {study.figure} {study.figureLabel}
          </strong>
        </h3>
        <p className="v5-cs-teaser">{study.summary}</p>
        <span className="v5-article-more">
          Read the case study <ArrowRight aria-hidden />
        </span>
      </div>
    </Link>
  );
}

function Stories({ studies }: { studies: CaseStudy[] }) {
  const featured = studies.slice(0, 3);
  const rest = studies.slice(3);
  return (
    <section className="v5-section v5-soft v5-cs-section" aria-label="Case studies">
      <div className="v5-wrap">
        <div className="v5-cs-features">
          {featured.map((c, i) => (
            <FeaturedStory key={c.slug} study={c} first={i === 0} />
          ))}
        </div>
        <div className="v5-head v5-cs-head" data-reveal>
          <Heading light="Find a story" strong="like your business." />
        </div>
        <div className="v5-cs-grid">
          {rest.map((c) => (
            <StoryCard key={c.slug} study={c} />
          ))}
        </div>
        <ScoreCallout title="What would a review find in your business?" />
      </div>
    </section>
  );
}

export default function CaseStudiesPage() {
  if (!beyondleanMode().enabled) notFound();
  const studies = getCaseStudies();
  return (
    <V5Shell active="cases">
      <PageHero
        light="Real work."
        strong="Real numbers."
        lede="Every one of these started the same way: busy people, and profit that didn't show it. Here's what changed when the work got fixed."
      />

      <Stories studies={studies} />

      <CloseCard />
    </V5Shell>
  );
}
