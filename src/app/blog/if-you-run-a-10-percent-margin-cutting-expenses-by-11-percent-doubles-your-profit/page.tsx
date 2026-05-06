import type { Metadata } from "next";
import Link from "next/link";
import { BlogAuthorByline } from "@/components/marketing/BlogAuthorByline";
import { ProfitCoachTopMenu } from "@/components/marketing/ProfitCoachTopMenu";

export const metadata: Metadata = {
  title:
    "If You Run A 10% Margin, Cutting Expenses By 11% Doubles Your Profit — The Profit Coach",
  description:
    "The overlooked arithmetic behind profit growth, and how to run a practical expense audit this week.",
};

export default async function MarginMathsBlogPostPage({
  searchParams,
}: {
  searchParams?: { coach?: string };
}) {
  return (
    <main className="min-h-screen bg-[#fbfbfa] text-slate-900">
      <ProfitCoachTopMenu />
      <article className="mx-auto max-w-4xl px-6 pb-24 pt-14 md:px-8 md:pb-28 md:pt-16">
        <Link href="/blog" className="text-sm font-medium text-slate-500 transition hover:text-slate-800">
          ← Back to blog
        </Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[#0c5290]">Profit &amp; Cash Flow</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.025em] md:text-6xl md:leading-[1.04]">
          If You Run A 10% Margin, Cutting Expenses By 11% Doubles Your Profit
        </h1>
        <BlogAuthorByline readMinutes={8} coachSlug={searchParams?.coach} />

        <div className="mt-12 space-y-8 font-sans text-[1.12rem] leading-[2rem] text-slate-800 md:text-[1.22rem] md:leading-[2.2rem]">
          <p>The headline is not clickbait. It is arithmetic.</p>
          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">The Maths</h2>
          <p>
            At £1,000,000 revenue and 10% net margin, profit is £100,000. Keeping the same margin and
            doubling profit via sales requires an extra £1,000,000 in revenue.
          </p>
          <p>
            Cutting £900,000 of expenses by 11% yields roughly £199,900 profit. Same revenue. Nearly double
            profit.
          </p>
          <p>That is usually two to five disciplined cost decisions, not a heroic turnaround.</p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">Why Owners Chase The Harder One</h2>
          <p>
            Revenue work feels exciting and visible. Expense work feels small and boring, even when it is
            far more profitable.
          </p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">The Expense Audit</h2>
          <ol className="list-decimal space-y-2 pl-8">
            <li>Pull 12 months of line-by-line expenses.</li>
            <li>Sort into: essential good, essential bloated, used to be useful, never useful.</li>
            <li>Add the bottom two buckets.</li>
          </ol>
          <p>In £200K-£5M businesses, that number is often far larger than expected.</p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">What To Do This Week</h2>
          <p>Block two hours. Run the audit. Cut three items by Friday.</p>
          <p>Then repeat quarterly. The compounding effect is the edge.</p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">A Note On What We Do</h2>
          <p>
            Profit &amp; Cash Flow is one of the ten BOSS Diagnostic areas. Many owners think they have a
            revenue problem when they really have a margin problem.
          </p>
          <p className="!mt-10 text-2xl font-bold">11% is usually closer than it looks.</p>
        </div>
      </article>
    </main>
  );
}
