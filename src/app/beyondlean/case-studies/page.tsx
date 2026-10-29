import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { BOOK_HREF } from "@/components/beyondlean/BeyondleanSite";
import { CircleButton, CloseCard, HOME, PageHero, ScoreCallout, V5Shell } from "@/components/beyondlean/v5/parts";
import { getCaseStudies } from "@/lib/beyondlean/content";
import { beyondleanMode } from "@/lib/beyondlean/mode";

export const metadata: Metadata = {
  title: "Case studies | Paul Swift, Beyondlean",
  description: "Real projects, real numbers. How Paul Swift fixed the way work gets done in food production, finance, energy and more.",
  robots: { index: false, follow: false },
};

export default function CaseStudiesPage() {
  if (!beyondleanMode().enabled) notFound();
  const studies = getCaseStudies();
  return (
    <V5Shell active="cases">
      <PageHero
        crumb={[{ href: `${HOME}/case-studies`, label: "Case studies" }]}
        light="Real work."
        strong="Real numbers."
        lede="Projects from 25 years of fixing how work gets done. Client names stay private. Each story says whether the money was saved, or found in the review and handed over as a plan."
      >
        <div className="v5-hero-actions">
          <CircleButton href={BOOK_HREF}>Book a free value call</CircleButton>
        </div>
      </PageHero>

      <section className="v5-section v5-soft" aria-label="All case studies">
        <div className="v5-wrap">
          <div className="v5-cases">
            {studies.map((c) => (
              <Link key={c.slug} href={`${HOME}/case-studies/${c.slug}`} className="v5-case-card" data-reveal>
                <div className="v5-case-card-top">
                  {c.photo && <Image src={c.photo} alt="" fill sizes="(max-width: 900px) 100vw, 600px" />}
                  <div className="v5-case-card-figure">
                    <strong>{c.figure}</strong>
                    <span>{c.figureLabel}</span>
                  </div>
                </div>
                <div className="v5-case-card-body">
                  <div className="v5-case-tags">
                    <span className={c.status === "Delivered" ? "v5-status is-done" : "v5-status"}>{c.status}</span>
                    <span className="v5-status">{c.sector}</span>
                  </div>
                  <h3>{c.title}</h3>
                  <p>
                    <strong>{c.client}.</strong> {c.summary}
                  </p>
                  <span className="v5-article-more">
                    Read the case study <ArrowRight aria-hidden />
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <ScoreCallout title="What would a review find in your business?" />
        </div>
      </section>

      <CloseCard />
    </V5Shell>
  );
}
