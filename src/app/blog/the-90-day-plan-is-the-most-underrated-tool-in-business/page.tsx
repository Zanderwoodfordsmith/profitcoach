import type { Metadata } from "next";
import Link from "next/link";
import { BlogAuthorByline } from "@/components/marketing/BlogAuthorByline";
import { ProfitCoachTopMenu } from "@/components/marketing/ProfitCoachTopMenu";

export const metadata: Metadata = {
  title: "The 90-Day Plan Is The Most Underrated Tool In Business — The Profit Coach",
  description:
    "Why 90-day planning beats annual planning for owner-led businesses, and how to run a practical quarterly cadence.",
};

export default async function NinetyDayPlanBlogPostPage({
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
          The 90-Day Plan Is The Most Underrated Tool In Business
        </h1>
        <BlogAuthorByline readMinutes={9} coachSlug={searchParams?.coach} />

        <div className="mt-12 space-y-8 font-sans text-[1.12rem] leading-[2rem] text-slate-800 md:text-[1.22rem] md:leading-[2.2rem]">
          <p>
            Most owners run on two timescales: today and someday. The missing middle is the quarter.
            The 90-day plan is short enough to stay real and long enough to finish meaningful work.
          </p>
          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">Why Annual Plans Fail</h2>
          <ul className="list-disc space-y-2 pl-8">
            <li>They are too far away to feel urgent.</li>
            <li>They are too long to stay specific.</li>
            <li>They are too big to be finishable.</li>
          </ul>
          <p>
            Most annual plans are a wishlist by spring. A quarter forces choices, sequencing, and
            execution.
          </p>
          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">Why 90 Days Is The Right Unit</h2>
          <p>
            In 90 days you can hire properly, launch an offer, fix a process, test a marketing
            change, and see real movement. You can also still hold the whole plan in your head.
          </p>
          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">What A Real 90-Day Plan Includes</h2>
          <ul className="list-disc space-y-2 pl-8">
            <li>Three priorities for the quarter.</li>
            <li>One clear measurable outcome for each.</li>
            <li>A weekly 30-minute review cadence.</li>
          </ul>
          <p>
            The hardest part is defending the three. Every new idea must replace an existing priority,
            not sit beside it.
          </p>
          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">Run This This Week</h2>
          <ol className="list-decimal space-y-2 pl-8">
            <li>Block 90 minutes.</li>
            <li>Write everything currently competing for attention.</li>
            <li>Choose the three priorities that would make the quarter a win.</li>
            <li>Define one-line outcomes with a date 90 days out.</li>
            <li>Book a recurring 30-minute weekly review.</li>
            <li>Tell the team those three priorities in plain English.</li>
          </ol>
          <p className="!mt-10 text-2xl font-bold">Pick three. Defend three. Repeat every quarter.</p>
        </div>
      </article>
    </main>
  );
}
