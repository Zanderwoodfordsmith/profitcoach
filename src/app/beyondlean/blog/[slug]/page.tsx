import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { BOOK_HREF } from "@/components/beyondlean/data";
import { CircleButton, CloseCard, HOME, Markdown, PageHero, ScoreCallout, V5Shell } from "@/components/beyondlean/v5/parts";
import { PostCard } from "@/components/beyondlean/v5/PostCard";
import { getPost, getPublishedPosts } from "@/lib/beyondlean/content";
import { beyondleanMode } from "@/lib/beyondlean/mode";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getPublishedPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getPost((await params).slug);
  return {
    title: post ? `${post.title} | Paul Swift, Beyondlean` : "Blog | Beyondlean",
    description: post?.excerpt,
    robots: { index: false, follow: false },
  };
}

/** Splits the article at the H2 nearest its middle, so the score opt-in sits mid-read. */
function splitMiddle(body: string): [string, string] {
  const heads = [...body.matchAll(/^## /gm)].map((m) => m.index ?? 0).filter((i) => i > 0);
  if (heads.length === 0) return [body, ""];
  const mid = body.length / 2;
  const at = heads.reduce((best, i) => (Math.abs(i - mid) < Math.abs(best - mid) ? i : best), heads[0]);
  return [body.slice(0, at), body.slice(at)];
}

export default async function BlogPostPage({ params }: Props) {
  if (!beyondleanMode().enabled) notFound();
  const post = getPost((await params).slug);
  if (!post) notFound();
  const [first, second] = splitMiddle(post.body);
  const related = getPublishedPosts()
    .filter((p) => p.slug !== post.slug)
    .sort((a, b) => Number(b.category === post.category) - Number(a.category === post.category))
    .slice(0, 3);

  return (
    <V5Shell active="blog">
      <PageHero
        strong={post.title}
        lede={post.excerpt}
      >
        <div className="v5-hero-meta">
          <span>{post.category}</span>
          {post.readMinutes && <span>{post.readMinutes} min read</span>}
          <span>By Paul Swift</span>
        </div>
      </PageHero>

      <section className="v5-section v5-white" aria-label="Article">
        <div className="v5-wrap v5-post">
          <article className="v5-post-body">
            <Markdown>{first}</Markdown>
            <ScoreCallout />
            {second && <Markdown>{second}</Markdown>}
          </article>
          <aside className="v5-post-side">
            <div className="v5-author">
              <div className="v5-author-head">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/beyondlean/paul.jpg" alt="" />
                <div>
                  <strong>Paul Swift</strong>
                  <span>Business coach, Beyondlean</span>
                </div>
              </div>
              <p>25 years fixing how work gets done. Lean Six Sigma Master Black Belt. Has run his own business.</p>
              <Link className="v5-text-link" href={`${HOME}/about`}>
                About Paul <ArrowRight aria-hidden />
              </Link>
            </div>
            <div className="v5-side-cta">
              <h3>Talk it through with Paul</h3>
              <p>A Constraint Call finds the one thing holding your business back, and what to fix first.</p>
              <CircleButton href={BOOK_HREF} tone="white">
                Book a Constraint Call
              </CircleButton>
            </div>
          </aside>
        </div>
      </section>

      {related.length > 0 && (
        <section className="v5-section v5-soft" aria-labelledby="v5-related-title">
          <div className="v5-wrap">
            <div className="v5-head v5-head-split">
              <h2 id="v5-related-title" className="v5-h2">
                <span>Keep</span> <strong>reading.</strong>
              </h2>
              <Link className="v5-text-link" href={`${HOME}/blog`}>
                All articles <ArrowRight aria-hidden />
              </Link>
            </div>
            <div className="v5-posts">
              {related.map((p) => (
                <PostCard key={p.slug} post={p} href={`${HOME}/blog/${p.slug}`} />
              ))}
            </div>
          </div>
        </section>
      )}

      <CloseCard />
    </V5Shell>
  );
}
