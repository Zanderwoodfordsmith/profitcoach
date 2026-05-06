import type { Metadata } from "next";
import Link from "next/link";
import { BlogAuthorByline } from "@/components/marketing/BlogAuthorByline";
import { ProfitCoachTopMenu } from "@/components/marketing/ProfitCoachTopMenu";

export const metadata: Metadata = {
  title: "Most Business Owners Don't Have A Strategy. They Have A To-Do List. — The Profit Coach",
  description:
    "How to separate strategy from activity, answer the four critical strategy questions, and stop reactive execution.",
};

export default async function StrategyVsTodoBlogPostPage({
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
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[#0c5290]">
          Strategy &amp; Planning
        </p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.025em] md:text-6xl md:leading-[1.04]">
          Most Business Owners Don&apos;t Have A Strategy. They Have A To-Do List.
        </h1>
        <BlogAuthorByline readMinutes={9} coachSlug={searchParams?.coach} />

        <div className="mt-12 space-y-8 font-sans text-[1.12rem] leading-[2rem] text-slate-800 md:text-[1.22rem] md:leading-[2.2rem]">
          <p>
            Most owners call a list of activities a strategy. A strategy is not what you will do;
            it is what you will choose.
          </p>
          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">The Four Strategy Questions</h2>
          <ol className="list-decimal space-y-2 pl-8">
            <li>Who is this business for?</li>
            <li>What are we selling them?</li>
            <li>Why us instead of alternatives?</li>
            <li>How will we reliably reach them?</li>
          </ol>
          <p>
            If those four are unclear, activity expands but progress shrinks.
          </p>
          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">Why To-Do-List Strategy Fails</h2>
          <ul className="list-disc space-y-2 pl-8">
            <li>Lists grow; strategy chooses.</li>
            <li>Lists don&apos;t tell you what to reject.</li>
            <li>Lists keep teams guessing what matters this week.</li>
          </ul>
          <p>
            If your strategy hasn&apos;t forced meaningful &ldquo;no&rdquo; decisions lately, you likely
            don&apos;t have one yet.
          </p>
          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">What To Do This Week</h2>
          <ol className="list-decimal space-y-2 pl-8">
            <li>Block 60 minutes with no interruptions.</li>
            <li>Write your answers to the four questions in plain language.</li>
            <li>Identify one current contradiction in your business.</li>
            <li>Fix that contradiction this quarter.</li>
          </ol>
          <p className="!mt-10 text-2xl font-bold">Clarity is strategy. Activity is not.</p>
        </div>
      </article>
    </main>
  );
}
