import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CtaCard, HOME, PageHero, V5Shell } from "@/components/beyondlean/v5/parts";
import { SCORE_HREF } from "@/components/beyondlean/data";
import { BlogFilter } from "@/components/beyondlean/v5/BlogFilter";
import { BLOG_CATEGORIES, getPublishedPosts } from "@/lib/beyondlean/content";
import { beyondleanMode, beyondleanRobots } from "@/lib/beyondlean/mode";

export const metadata: Metadata = {
  title: "Blog | Paul Swift, Beyondlean",
  description: "20 years of writing on leadership, culture and getting the basics of operations right, for owners of growing businesses.",
  robots: beyondleanRobots,
};

/** The featured title in the CTA box's two weights: the last two words go bold and blue. */
function splitTitle(title: string) {
  const words = title.split(" ");
  if (words.length < 3) return { light: "", strong: title };
  return { light: words.slice(0, -2).join(" "), strong: words.slice(-2).join(" ") };
}

export default function BlogPage() {
  if (!beyondleanMode().enabled) notFound();

  const posts = getPublishedPosts();
  const [lead, ...rest] = posts;

  return (
    <V5Shell active="blog">
      <PageHero
        light="Paul's blog."
        strong="Getting the basics right."
        lede="20 years of writing on leadership, culture and how work really gets done, from the shop floor to the boardroom."
        photo="/beyondlean/paul-whiteboard.jpg"
      />

      {lead && (
        <section className="v5-section v5-soft v5-blog-feature" aria-label="Featured article">
          <div className="v5-wrap v5-feature-cta">
            <CtaCard
              id="v5-featured-title"
              eyebrow={lead.readMinutes ? `Featured article, ${lead.readMinutes} min read` : "Featured article"}
              {...splitTitle(lead.title)}
              text={lead.excerpt}
              href={`${HOME}/blog/${lead.slug}`}
              label="Read the Article"
              photo="/beyondlean/paul-fix.jpg"
            />
          </div>
        </section>
      )}

      <BlogFilter
        posts={rest.map(({ slug, title, excerpt, category, readMinutes }) => ({ slug, title, excerpt, category, readMinutes }))}
        topics={BLOG_CATEGORIES}
        base={`${HOME}/blog`}
      />

      <section className="v5-close-wrap" aria-labelledby="v5-score-title">
        <div className="v5-wrap">
          <CtaCard
            id="v5-score-title"
            eyebrow="Free BOSS Score"
            light="Where is your business"
            strong="losing money?"
            text="13 quick questions give you a score out of 100 across the 10 areas of your business, and show you what to fix first. It takes a few minutes and it's free."
            href={SCORE_HREF}
            label="Get Your Free BOSS Score"
            photo="/beyondlean/owner-laptop.jpg"
          />
        </div>
      </section>
    </V5Shell>
  );
}
