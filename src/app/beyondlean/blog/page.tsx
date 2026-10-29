import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { CloseCard, HOME, PageHero, ScoreCallout, V5Shell } from "@/components/beyondlean/v5/parts";
import { BLOG_CATEGORIES, getPublishedPosts, type BlogPost } from "@/lib/beyondlean/content";
import { beyondleanMode } from "@/lib/beyondlean/mode";

export const metadata: Metadata = {
  title: "Blog | Paul Swift, Beyondlean",
  description: "20 years of writing on leadership, culture and getting the basics of operations right, for owners of growing businesses.",
  robots: { index: false, follow: false },
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function Meta({ post }: { post: BlogPost }) {
  return (
    <span className="v5-post-meta">
      <span className="v5-article-tag">{post.category}</span>
      {post.readMinutes && <span>{post.readMinutes} min read</span>}
    </span>
  );
}

function Card({ post }: { post: BlogPost }) {
  return (
    <Link className="v5-article" href={`${HOME}/blog/${post.slug}`} data-reveal>
      <Meta post={post} />
      <h3>{post.title}</h3>
      <p>{post.excerpt}</p>
      <span className="v5-article-more">
        Read the article <ArrowRight aria-hidden />
      </span>
    </Link>
  );
}

export default function BlogPage() {
  if (!beyondleanMode().enabled) notFound();
  const posts = getPublishedPosts();
  const [lead, ...featured] = posts.filter((p) => p.featured);
  const rest = posts.filter((p) => !p.featured);
  const groups = BLOG_CATEGORIES.map((c) => ({ category: c, items: rest.filter((p) => p.category === c) })).filter(
    (g) => g.items.length > 0
  );

  return (
    <V5Shell active="blog">
      <PageHero
        crumb={[{ href: `${HOME}/blog`, label: "Blog" }]}
        light="Paul's blog."
        strong="Getting the basics right."
        lede="20 years of writing on leadership, culture and how work really gets done, from the shop floor to the boardroom."
      >
        {groups.length > 0 && (
          <nav className="v5-topic-links" aria-label="Topics">
            {groups.map((g) => (
              <a key={g.category} href={`#${slugify(g.category)}`}>
                {g.category}
              </a>
            ))}
          </nav>
        )}
      </PageHero>

      <section className="v5-section v5-soft" aria-label="Featured articles">
        <div className="v5-wrap">
          {lead && (
            <Link className="v5-post-feature" href={`${HOME}/blog/${lead.slug}`} data-reveal>
              <div className="v5-post-feature-copy">
                <Meta post={lead} />
                <h2>{lead.title}</h2>
                <p>{lead.excerpt}</p>
                <span className="v5-article-more is-light">
                  Read the article <ArrowRight aria-hidden />
                </span>
              </div>
              <div className="v5-post-feature-art" aria-hidden>
                <blockquote>&ldquo;Any improvement is 20% about the tools and 80% about the people.&rdquo;</blockquote>
              </div>
            </Link>
          )}
          {featured.length > 0 && (
            <div className="v5-posts">
              {featured.map((p) => (
                <Card key={p.slug} post={p} />
              ))}
            </div>
          )}
          <ScoreCallout title="Want to know where your own business leaks?" />
        </div>
      </section>

      {groups.map((g, i) => (
        <section
          key={g.category}
          id={slugify(g.category)}
          className={`v5-section ${i % 2 === 0 ? "v5-white" : "v5-soft"}`}
          aria-labelledby={`t-${slugify(g.category)}`}
        >
          <div className="v5-wrap">
            <div className="v5-head">
              <h2 id={`t-${slugify(g.category)}`} className="v5-h2">
                <strong>{g.category}</strong>
              </h2>
            </div>
            <div className="v5-posts">
              {g.items.map((p) => (
                <Card key={p.slug} post={p} />
              ))}
            </div>
          </div>
        </section>
      ))}

      <CloseCard />
    </V5Shell>
  );
}
