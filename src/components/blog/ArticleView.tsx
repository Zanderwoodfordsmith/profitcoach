import Link from "next/link";
import type { ReactNode } from "react";

import { BlogAuthorByline } from "@/components/marketing/BlogAuthorByline";
import { ProfitCoachTopMenu } from "@/components/marketing/ProfitCoachTopMenu";
import {
  articleBodyBlocks,
  articleReadMinutes,
  inlineTokens,
  type Article,
} from "@/lib/articles";

function Inline({ text }: { text: string }) {
  return (
    <>
      {inlineTokens(text).map((t, i) =>
        t.type === "strong" ? (
          <strong key={i} className="font-bold text-slate-900">
            {t.text}
          </strong>
        ) : t.type === "em" ? (
          <em key={i}>{t.text}</em>
        ) : t.type === "link" ? (
          <a
            key={i}
            href={t.href}
            className="font-medium text-[#0c5290] underline underline-offset-2"
          >
            {t.text}
          </a>
        ) : (
          <span key={i}>{t.text}</span>
        )
      )}
    </>
  );
}

/**
 * The Profit Coach blog post layout — identical styling to the hand-built
 * static posts, driven by a DB article. Used by the public /blog/[slug]
 * route and the admin preview.
 */
export function ArticleView({
  article,
  coachSlug,
  banner,
}: {
  article: Article;
  coachSlug?: string;
  /** Optional bar above the article (e.g. admin preview notice). */
  banner?: ReactNode;
}) {
  const category = article.categories[0] ?? "The Profit Coach";
  return (
    <main className="min-h-screen bg-[#fbfbfa] text-slate-900">
      <ProfitCoachTopMenu />
      {banner}
      <article className="mx-auto max-w-4xl px-6 pb-24 pt-14 md:px-8 md:pb-28 md:pt-16">
        <Link
          href="/blog"
          className="text-sm font-medium text-slate-500 transition hover:text-slate-800"
        >
          ← Back to blog
        </Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[#0c5290]">
          {category}
        </p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.025em] md:text-6xl md:leading-[1.04]">
          {article.title}
        </h1>
        <BlogAuthorByline
          readMinutes={articleReadMinutes(article.body)}
          coachSlug={coachSlug}
        />

        <div className="mt-12 space-y-8 font-sans text-[1.12rem] leading-[2rem] text-slate-800 md:text-[1.22rem] md:leading-[2.2rem]">
          {articleBodyBlocks(article.body).map((block, i) => {
            if (block.type === "p") {
              return (
                <p key={i}>
                  <Inline text={block.text} />
                </p>
              );
            }
            if (block.type === "h2") {
              return (
                <h2 key={i} className="!mt-14 text-2xl font-bold md:text-3xl">
                  <Inline text={block.text} />
                </h2>
              );
            }
            if (block.type === "h3") {
              return (
                <h3 key={i} className="!mt-10 text-xl font-bold md:text-2xl">
                  <Inline text={block.text} />
                </h3>
              );
            }
            if (block.type === "h4") {
              return (
                <h4 key={i} className="!mt-8 text-lg font-bold md:text-xl">
                  <Inline text={block.text} />
                </h4>
              );
            }
            if (block.type === "ul") {
              return (
                <ul key={i} className="list-disc space-y-2 pl-8">
                  {block.items.map((item, j) => (
                    <li key={j}>
                      <Inline text={item} />
                    </li>
                  ))}
                </ul>
              );
            }
            if (block.type === "ol") {
              return (
                <ol key={i} className="list-decimal space-y-2 pl-8">
                  {block.items.map((item, j) => (
                    <li key={j}>
                      <Inline text={item} />
                    </li>
                  ))}
                </ol>
              );
            }
            return null;
          })}
        </div>
      </article>
    </main>
  );
}
