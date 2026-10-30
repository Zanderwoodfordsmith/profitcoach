import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { CloseCard, CtaCard, HOME, PageHero, ScoreCallout, V5Shell, VersionSwitch } from "@/components/beyondlean/v5/parts";
import { SCORE_HREF } from "@/components/beyondlean/data";
import { BlogFilter } from "@/components/beyondlean/v5/BlogFilter";
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

/** The first version of this page (featured cards, then one section per topic), kept until Zander picks. */
function OldBlog({ switcher }: { switcher: React.ReactNode }) {
  const posts = getPublishedPosts();
  const [lead, ...featured] = posts.filter((p) => p.featured);
  const rest = posts.filter((p) => !p.featured);
  const groups = BLOG_CATEGORIES.map((c) => ({ category: c, items: rest.filter((p) => p.category === c) })).filter(
    (g) => g.items.length > 0
  );

  return (
    <V5Shell active="blog" switcher={switcher}>
      <PageHero
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

type Props = { searchParams: Promise<{ v?: string }> };

/** The featured title in the CTA box's two weights: the last two words go bold and blue. */
function splitTitle(title: string) {
  const words = title.split(" ");
  if (words.length < 3) return { light: "", strong: title };
  return { light: words.slice(0, -2).join(" "), strong: words.slice(-2).join(" ") };
}

export default async function BlogPage({ searchParams }: Props) {
  const { enabled, preview } = beyondleanMode();
  if (!enabled) notFound();
  const old = preview && (await searchParams).v === "old";
  const switcher = preview ? <VersionSwitch current={old ? "old" : "new"} /> : null;
  if (old) return <OldBlog switcher={switcher} />;

  const posts = getPublishedPosts();
  const [lead, ...rest] = posts;

  return (
    <V5Shell active="blog" switcher={switcher}>
      <PageHero
        light="Paul's blog."
        strong="Getting the basics right."
        lede="20 years of writing on leadership, culture and how work really gets done, from the shop floor to the boardroom."
        photo="/beyondlean/paul-whiteboard.jpg"
      />

      {lead && (
        <section className="v5-section v5-soft" aria-label="Featured article">
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
