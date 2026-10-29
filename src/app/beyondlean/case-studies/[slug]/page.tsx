import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { BOOK_HREF } from "@/components/beyondlean/BeyondleanSite";
import { CircleButton, CloseCard, HOME, Markdown, PageHero, ScoreCallout, V5Shell } from "@/components/beyondlean/v5/parts";
import { getCaseStudies, getCaseStudy, sections } from "@/lib/beyondlean/content";
import { beyondleanMode } from "@/lib/beyondlean/mode";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getCaseStudies().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const study = getCaseStudy((await params).slug);
  return {
    title: study ? `${study.title} | Case study | Beyondlean` : "Case study | Beyondlean",
    description: study?.summary,
    robots: { index: false, follow: false },
  };
}

/** "- **57 to 40** people for the same output" becomes a figure and its line. */
function glance(md: string) {
  return md
    .split("\n")
    .map((l) => l.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^\*\*(.+?)\*\*\s*[:,-]?\s*(.*)$/);
      return m ? { figure: m[1], text: m[2] } : { figure: "", text: l.replace(/\*\*/g, "") };
    });
}

export default async function CaseStudyPage({ params }: Props) {
  const { enabled, preview } = beyondleanMode();
  if (!enabled) notFound();
  const study = getCaseStudy((await params).slug);
  if (!study) notFound();
  const s = sections(study.body);
  const more = getCaseStudies()
    .filter((c) => c.slug !== study.slug)
    .slice(0, 2);

  return (
    <V5Shell active="cases">
      <PageHero
        crumb={[
          { href: `${HOME}/case-studies`, label: "Case studies" },
          { href: `${HOME}/case-studies/${study.slug}`, label: study.client },
        ]}
        light={`${study.client}.`}
        strong={study.title}
        lede={study.summary}
      >
        <div className="v5-hero-meta">
          <span>{study.status}</span>
          <span>{study.sector}</span>
          {study.timeframe && <span>{study.timeframe}</span>}
        </div>
      </PageHero>

      <section className="v5-section v5-white" aria-label="The case study">
        <div className="v5-wrap v5-case-detail">
          <article>
            {s["At a glance"] && (
              <ul className="v5-glance" aria-label="At a glance">
                {glance(s["At a glance"]).map((g) => (
                  <li key={g.text}>
                    {g.figure && <strong>{g.figure}</strong>}
                    {g.text}
                  </li>
                ))}
              </ul>
            )}
            {["The problem", "What we did"].map((h) =>
              s[h] ? (
                <div className="v5-story-block" key={h}>
                  <h2>{h}</h2>
                  <Markdown>{s[h]}</Markdown>
                </div>
              ) : null
            )}
            <ScoreCallout title="Could your business have the same leak?" />
            {s["What changed"] && (
              <div className="v5-story-block">
                <h2>What changed</h2>
                <Markdown>{s["What changed"]}</Markdown>
              </div>
            )}
            {s["What an owner can take from this"] && (
              <div className="v5-lesson">
                <h2>What an owner can take from this</h2>
                <Markdown>{s["What an owner can take from this"]}</Markdown>
              </div>
            )}
          </article>
          <aside className="v5-post-side">
            <dl className="v5-case-facts">
              <div>
                <dt>Client</dt>
                <dd>{study.client}</dd>
              </div>
              <div>
                <dt>Sector</dt>
                <dd>{study.sector}</dd>
              </div>
              <div>
                <dt>Result</dt>
                <dd>
                  {study.figure} {study.figureLabel}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{study.status}</dd>
              </div>
              {study.timeframe && (
                <div>
                  <dt>Timeframe</dt>
                  <dd>{study.timeframe}</dd>
                </div>
              )}
            </dl>
            {preview && study.confirm && <p className="v5-note-confirm">Preview note, not shown live: {study.confirm}</p>}
            <div className="v5-side-cta">
              <h3>Want this kind of result?</h3>
              <p>Book a free value call and we&apos;ll find where your business is leaking.</p>
              <CircleButton href={BOOK_HREF} tone="white">
                Book a free call
              </CircleButton>
            </div>
          </aside>
        </div>
      </section>

      {more.length > 0 && (
        <section className="v5-section v5-soft" aria-labelledby="v5-more-title">
          <div className="v5-wrap">
            <div className="v5-head v5-head-split">
              <h2 id="v5-more-title" className="v5-h2">
                <span>More</span> <strong>case studies.</strong>
              </h2>
              <Link className="v5-text-link" href={`${HOME}/case-studies`}>
                All case studies <ArrowRight aria-hidden />
              </Link>
            </div>
            <div className="v5-cases">
              {more.map((c) => (
                <Link key={c.slug} href={`${HOME}/case-studies/${c.slug}`} className="v5-case-card">
                  <div className="v5-case-card-top">
                    <div className="v5-case-card-figure">
                      <strong>{c.figure}</strong>
                      <span>{c.figureLabel}</span>
                    </div>
                  </div>
                  <div className="v5-case-card-body">
                    <h3>{c.title}</h3>
                    <p>{c.summary}</p>
                    <span className="v5-article-more">
                      Read the case study <ArrowRight aria-hidden />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <CloseCard />
    </V5Shell>
  );
}
