"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ProfitCoachTopMenu } from "@/components/marketing/ProfitCoachTopMenu";

type BlogCategory =
  | "Owner Performance"
  | "Strategy & Planning"
  | "Profit & Cash Flow"
  | "Revenue & Marketing"
  | "Ops, Systems & Team";

type BlogPost = {
  title: string;
  excerpt: string;
  href: string;
  category: BlogCategory;
  date: string;
  image: string;
};

const BLOG_CATEGORIES: readonly BlogCategory[] = [
  "Owner Performance",
  "Strategy & Planning",
  "Profit & Cash Flow",
  "Revenue & Marketing",
  "Ops, Systems & Team",
];

const posts: readonly BlogPost[] = [
  {
    title: "The 90-Day Plan Is The Most Underrated Tool In Business",
    excerpt:
      "Most owners plan too short (today) or too long (year). The quarter is where real execution lives.",
    href: "/blog/the-90-day-plan-is-the-most-underrated-tool-in-business",
    category: "Strategy & Planning",
    date: "May 2026",
    image: "/how-it-works/nine-step-roadmap.png",
  },
  {
    title: "Most Business Owners Don't Have A Strategy. They Have A To-Do List.",
    excerpt:
      "A strategy is four clear choices. Most owners have activity without decisions.",
    href: "/blog/most-business-owners-dont-have-a-strategy-they-have-a-to-do-list",
    category: "Strategy & Planning",
    date: "May 2026",
    image: "/landing/v2/how-3.png",
  },
  {
    title: "Most Owners Don't Have A Sales Problem. They Have A Follow-Up Problem.",
    excerpt:
      "Many lost deals are dropped deals. Follow-up cadence is often the biggest immediate revenue lever.",
    href: "/blog/most-owners-dont-have-a-sales-problem-they-have-a-follow-up-problem",
    category: "Revenue & Marketing",
    date: "May 2026",
    image: "/landing/v2/how-2.png",
  },
  {
    title: "Stop Trying To Get More Customers. Start Trying To Lose Fewer.",
    excerpt:
      "Retention improvements can beat acquisition spend. Fix the leak before pouring harder.",
    href: "/blog/stop-trying-to-get-more-customers-start-trying-to-lose-fewer",
    category: "Revenue & Marketing",
    date: "May 2026",
    image: "/landing/v2/dashboard.png",
  },
  {
    title: "You Don't Have A Team Problem. You Have A Standards Problem.",
    excerpt:
      "Inconsistent performance is usually a standards issue. Set the line and hold it.",
    href: "/blog/you-dont-have-a-team-problem-you-have-a-standards-problem",
    category: "Ops, Systems & Team",
    date: "May 2026",
    image: "/how-it-works/owner-pyramid.png",
  },
  {
    title: "Indecision Is The Most Expensive Thing In Your Business",
    excerpt:
      "The decision you keep postponing is often the most expensive line item in the company. Run a decision audit and clear one this week.",
    href: "/blog/indecision-is-the-most-expensive-thing-in-your-business",
    category: "Owner Performance",
    date: "May 2026",
    image: "/landing/v2/how-1.png",
  },
  {
    title: "The Day The Excitement Died Is The Day Your Business Actually Started",
    excerpt:
      "When the buzz disappears, most owners panic. The disciplined ones install rhythm and pull away from the pack.",
    href: "/blog/the-day-the-excitement-died-is-the-day-your-business-actually-started",
    category: "Owner Performance",
    date: "May 2026",
    image: "/landing/v2/dashboard.png",
  },
  {
    title: "Business Is Shockingly Simple. That's Why It's So Hard.",
    excerpt:
      "Most owners do not have a knowledge problem. They have an execution problem around the simple, emotional decisions that actually move the number.",
    href: "/blog/business-is-shockingly-simple-thats-why-its-so-hard",
    category: "Owner Performance",
    date: "May 2026",
    image: "/landing/v2/hero.png",
  },
  {
    title: "The 5 Levels Of Business Owner. Most People Get Stuck At Level 2.",
    excerpt:
      "Revenue can hide reality. This breakdown helps owners identify their true stage, avoid the Level 2 trap, and move up with the right shift.",
    href: "/blog/the-5-levels-of-business-owner-most-people-get-stuck-at-level-2",
    category: "Owner Performance",
    date: "May 2026",
    image: "/how-it-works/five-levels.png",
  },
  {
    title: "If You Run A 10% Margin, Cutting Expenses By 11% Doubles Your Profit",
    excerpt:
      "Simple arithmetic most owners ignore: margin control can outperform brute-force revenue chasing.",
    href: "/blog/if-you-run-a-10-percent-margin-cutting-expenses-by-11-percent-doubles-your-profit",
    category: "Profit & Cash Flow",
    date: "May 2026",
    image: "/landing/v2/how-2.png",
  },
  {
    title: "Most Owners Want Speed. They Need Control First.",
    excerpt:
      "Growth multiplies what already exists. Build control before velocity if you want profitable momentum instead of bigger chaos.",
    href: "/blog/most-owners-want-speed-they-need-control-first",
    category: "Strategy & Planning",
    date: "May 2026",
    image: "/landing/v2/how-3.png",
  },
  {
    title: "The Bottleneck In Your Business Has Your Name On It",
    excerpt:
      "If decisions, approvals, and fixes still route through you, growth caps at your personal capacity. Here is the weekly handover playbook.",
    href: "/blog/the-bottleneck-in-your-business-has-your-name-on-it",
    category: "Owner Performance",
    date: "May 2026",
    image: "/landing/v2/landing-full.png",
  },
];

export function BlogContent() {
  const [activeCategory, setActiveCategory] = useState<"All" | BlogCategory>("All");

  const visiblePosts = useMemo(
    () =>
      activeCategory === "All"
        ? posts
        : posts.filter((post) => post.category === activeCategory),
    [activeCategory]
  );

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-slate-900">
      <ProfitCoachTopMenu />

      <section className="mx-auto max-w-6xl px-5 pb-10 pt-10 md:px-8 md:pb-14 md:pt-14">
        <div
          className="rounded-[2rem] border border-white/65 px-6 py-10 shadow-[0_24px_60px_-30px_rgba(12,82,144,0.45)] md:px-12 md:py-14"
          style={{
            background:
              "linear-gradient(120deg, rgba(255,228,237,0.95) 0%, rgba(234,245,255,0.95) 45%, rgba(237,255,251,0.95) 100%)",
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#0c5290]">
            The Blog
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.03em] md:text-6xl">
            Ideas, stories, and practical thinking for business owners.
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-slate-700 md:text-lg">
            Straight-talking essays on profit, leadership, systems, and owner performance.
            Less noise. More signal.
          </p>
          <div className="mt-8 flex w-full max-w-xl flex-col gap-3 sm:flex-row">
            <input
              type="email"
              placeholder="Email address"
              className="h-12 w-full rounded-full border border-white/70 bg-white/80 px-5 text-sm text-slate-800 outline-none ring-[#0c5290]/30 placeholder:text-slate-500 focus:ring-2"
            />
            <button
              type="button"
              className="h-12 shrink-0 rounded-full bg-[#0c5290] px-7 text-sm font-semibold text-white transition hover:bg-[#094271]"
            >
              Subscribe
            </button>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setActiveCategory("All")}
            className={`rounded-full px-4 py-2 text-base font-medium transition-colors ${
              activeCategory === "All"
                ? "bg-sky-700 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            All
          </button>
          {BLOG_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`rounded-full px-4 py-2 text-base font-medium transition-colors ${
                activeCategory === category
                  ? "bg-sky-700 text-white"
                  : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 md:px-8 md:pb-28">
        {visiblePosts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-600">
            No posts in this category yet.
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-3">
            {visiblePosts.map((post, index) => {
              if (post.href === "#") {
                return (
                  <article
                    key={post.title}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white opacity-90"
                  >
                    <div className="relative h-56 w-full overflow-hidden">
                      <Image
                        src={post.image}
                        alt={post.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    </div>
                    <div className="p-6 md:p-7">
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#0c5290]">
                        {post.category} · {post.date}
                      </p>
                      <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.02em] text-slate-900">
                        {post.title}
                      </h2>
                      <p className="mt-4 text-base leading-relaxed text-slate-600">
                        {post.excerpt}
                      </p>
                      <p className="mt-6 text-sm font-medium text-slate-400">
                        Article coming soon
                      </p>
                    </div>
                  </article>
                );
              }

              return (
                <Link
                  key={post.title}
                  href={post.href}
                  className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="relative h-56 w-full overflow-hidden">
                    <Image
                      src={post.image}
                      alt={post.title}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-[1.02]"
                      sizes="(max-width: 768px) 100vw, 33vw"
                      priority={index === 0}
                    />
                  </div>
                  <div className="p-6 md:p-7">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#0c5290]">
                      {post.category} · {post.date}
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.02em] text-slate-900">
                      {post.title}
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-slate-600">{post.excerpt}</p>
                    <p className="mt-6 text-sm font-semibold text-slate-900">Read article →</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
