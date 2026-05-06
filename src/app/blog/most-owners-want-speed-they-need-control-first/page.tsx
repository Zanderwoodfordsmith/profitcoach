import type { Metadata } from "next";
import Link from "next/link";
import { BlogAuthorByline } from "@/components/marketing/BlogAuthorByline";
import { ProfitCoachTopMenu } from "@/components/marketing/ProfitCoachTopMenu";

export const metadata: Metadata = {
  title: "Most Owners Want Speed. They Need Control First. — The Profit Coach",
  description:
    "Why growth amplifies what already exists, and why control must come before velocity in owner-led businesses.",
};

export default async function SpeedNeedsControlBlogPostPage({
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
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[#0c5290]">Strategy &amp; Planning</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.025em] md:text-6xl md:leading-[1.04]">
          Most Owners Want Speed. They Need Control First.
        </h1>
        <BlogAuthorByline readMinutes={8} coachSlug={searchParams?.coach} />

        <div className="mt-12 space-y-8 font-sans text-[1.12rem] leading-[2rem] text-slate-800 md:text-[1.22rem] md:leading-[2.2rem]">
          <p>
            Growth is a multiplier. If the business is healthy, growth helps. If the business is chaotic,
            growth multiplies chaos.
          </p>
          <p>Most owners chasing speed are unintentionally multiplying unresolved control problems.</p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">Why Faster Keeps Hurting</h2>
          <p>
            Bursts of new revenue often expose delivery strain, cash stress, process breakdowns, and decision
            overload. That is usually not a growth issue. It is a control issue revealed by growth.
          </p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">The Order Most Owners Get Wrong</h2>
          <p>
            The Profit System sequence is deliberate: <strong>Control</strong> then{" "}
            <strong>Velocity</strong> then <strong>Value</strong>.
          </p>
          <p>
            Skipping straight to velocity on a weak control base is why growth feels painful instead of
            compounding.
          </p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">What No-Control Looks Like</h2>
          <ul className="list-disc space-y-2 pl-8">
            <li>No clear view of margin, lead flow, or pipeline quality.</li>
            <li>No stable weekly rhythm for team accountability.</li>
            <li>Quarter priorities are vague.</li>
            <li>The business behaves differently when you are absent.</li>
          </ul>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">What To Do This Week</h2>
          <p>Pick three numbers and review them every Monday. Same three, every week, no exceptions.</p>
          <ol className="list-decimal space-y-2 pl-8">
            <li>Cash in bank.</li>
            <li>Sales / pipeline inflow.</li>
            <li>Margin on delivered work.</li>
          </ol>
          <p>Six months of this outperforms most random growth experiments.</p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">A Note On What We Do</h2>
          <p>
            The BOSS Diagnostic surfaces control gaps first because the order matters: control, then
            velocity, then value.
          </p>
          <p className="!mt-10 text-2xl font-bold">In that order, businesses compound.</p>
        </div>
      </article>
    </main>
  );
}
