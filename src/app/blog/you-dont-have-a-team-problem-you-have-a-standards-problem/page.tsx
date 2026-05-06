import type { Metadata } from "next";
import Link from "next/link";
import { BlogAuthorByline } from "@/components/marketing/BlogAuthorByline";
import { ProfitCoachTopMenu } from "@/components/marketing/ProfitCoachTopMenu";

export const metadata: Metadata = {
  title: "You Don't Have A Team Problem. You Have A Standards Problem. — The Profit Coach",
  description:
    "Why most team performance issues are standards issues, and how owners reset and hold clear operating standards.",
};

export default async function StandardsProblemBlogPostPage({
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
          Ops, Systems &amp; Team
        </p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.025em] md:text-6xl md:leading-[1.04]">
          You Don&apos;t Have A Team Problem. You Have A Standards Problem.
        </h1>
        <BlogAuthorByline readMinutes={10} coachSlug={searchParams?.coach} />

        <div className="mt-12 space-y-8 font-sans text-[1.12rem] leading-[2rem] text-slate-800 md:text-[1.22rem] md:leading-[2.2rem]">
          <p>
            Teams usually perform to the standard actually enforced, not the standard written on a wall.
            If quality is inconsistent, the line is likely unclear or moving.
          </p>
          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">What Standards Are</h2>
          <p>
            A standard is a clear minimum acceptable output or behavior, specific enough to judge as
            hit or missed.
          </p>
          <ul className="list-disc space-y-2 pl-8">
            <li>Reply to customer emails within four working hours.</li>
            <li>Send quotes within 24 hours.</li>
            <li>Start and end meetings on time.</li>
            <li>Define weekly priorities by Monday morning.</li>
          </ul>
          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">Why Standards Erode</h2>
          <p>
            Standards slip through repeated &ldquo;just this once&rdquo; exceptions. Over time, the exception
            becomes the norm.
          </p>
          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">The Owner&apos;s Role</h2>
          <p>
            Standards are owner-led. You can delegate enforcement, but not the act of setting,
            modeling, and holding the line.
          </p>
          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">Reset In 3 Steps</h2>
          <ol className="list-decimal space-y-2 pl-8">
            <li>Define 5–10 non-negotiable operating standards in plain language.</li>
            <li>Communicate them clearly with examples of hit vs miss.</li>
            <li>Hold consistently, especially on early tests.</li>
          </ol>
          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">What To Do This Week</h2>
          <ol className="list-decimal space-y-2 pl-8">
            <li>Write down five standards you want true in your business.</li>
            <li>Choose the most frequently broken one.</li>
            <li>Run a reset conversation this week and enforce consistently for 90 days.</li>
          </ol>
          <p className="!mt-10 text-2xl font-bold">
            The team rises to the line you hold, not the line you hope for.
          </p>
        </div>
      </article>
    </main>
  );
}
