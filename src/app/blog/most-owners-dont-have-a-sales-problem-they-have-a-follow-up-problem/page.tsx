import type { Metadata } from "next";
import Link from "next/link";
import { BlogAuthorByline } from "@/components/marketing/BlogAuthorByline";
import { ProfitCoachTopMenu } from "@/components/marketing/ProfitCoachTopMenu";

export const metadata: Metadata = {
  title: "Most Owners Don't Have A Sales Problem. They Have A Follow-Up Problem. — The Profit Coach",
  description:
    "Why follow-up discipline is the highest-leverage revenue move in owner-led businesses, and a practical follow-up sequence.",
};

export default async function FollowUpProblemBlogPostPage({
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
          Revenue &amp; Marketing
        </p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.025em] md:text-6xl md:leading-[1.04]">
          Most Owners Don&apos;t Have A Sales Problem. They Have A Follow-Up Problem.
        </h1>
        <BlogAuthorByline readMinutes={9} coachSlug={searchParams?.coach} />

        <div className="mt-12 space-y-8 font-sans text-[1.12rem] leading-[2rem] text-slate-800 md:text-[1.22rem] md:leading-[2.2rem]">
          <p>
            Many &ldquo;lost deals&rdquo; are not lost. They are dropped due to weak follow-up cadence.
            Same leads, same offer, different process.
          </p>
          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">The Revenue Maths</h2>
          <p>
            One follow-up often converts like 20%. Structured follow-up across multiple touches can
            push results toward 50% in many owner-led businesses.
          </p>
          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">Why Owners Avoid It</h2>
          <ul className="list-disc space-y-2 pl-8">
            <li>It feels pushy.</li>
            <li>Silence feels personal.</li>
            <li>There is no system, so it depends on memory.</li>
          </ul>
          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">A Practical Follow-Up Sequence</h2>
          <ul className="list-disc space-y-2 pl-8">
            <li>Day 0: send proposal and set expectation for follow-up.</li>
            <li>Day 4: light check-in.</li>
            <li>Day 10: add value (case study, useful insight, relevant answer).</li>
            <li>Day 20: direct status check.</li>
            <li>Day 45: soft revival message.</li>
          </ul>
          <p>It should be useful and professional, not needy.</p>
          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">What To Do This Week</h2>
          <ol className="list-decimal space-y-2 pl-8">
            <li>Pull all leads/proposals from the last 90 days.</li>
            <li>Label each as closed, lost, or still open.</li>
            <li>Follow up every open one this week with value.</li>
            <li>Track outcomes and install a simple recurring follow-up system.</li>
          </ol>
          <p className="!mt-10 text-2xl font-bold">Most sales pipelines leak in follow-up, not lead flow.</p>
        </div>
      </article>
    </main>
  );
}
