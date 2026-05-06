import type { Metadata } from "next";
import Link from "next/link";
import { BlogAuthorByline } from "@/components/marketing/BlogAuthorByline";
import { ProfitCoachTopMenu } from "@/components/marketing/ProfitCoachTopMenu";

export const metadata: Metadata = {
  title: "The Bottleneck In Your Business Has Your Name On It — The Profit Coach",
  description:
    "How to identify when the owner is the bottleneck, what it costs, and a practical handover process to fix it.",
};

export default async function BottleneckBlogPostPage({
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
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[#0c5290]">Owner Performance</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.025em] md:text-6xl md:leading-[1.04]">
          The Bottleneck In Your Business Has Your Name On It
        </h1>
        <BlogAuthorByline readMinutes={9} coachSlug={searchParams?.coach} />

        <div className="mt-12 space-y-8 font-sans text-[1.12rem] leading-[2rem] text-slate-800 md:text-[1.22rem] md:leading-[2.2rem]">
          <p>Most owners think they have a team, market, or cash-flow problem.</p>
          <p>
            In many £200K-£5M businesses, the core issue is simpler and harder: the owner is the bottleneck.
          </p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">How To Know If It&apos;s You</h2>
          <ul className="list-disc space-y-2 pl-8">
            <li>Decisions stop when you are not in the room.</li>
            <li>The same problems return because solutions live in your head, not in systems.</li>
            <li>You are doing high-volume low-value admin work.</li>
            <li>Team roles and decision rights are unclear.</li>
            <li>Growth has stalled because everything routes through you.</li>
          </ul>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">Why Owners Miss It</h2>
          <p>
            Being the bottleneck can feel like being important. Letting go can feel like losing control. Both
            narratives keep owners trapped.
          </p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">The Cost</h2>
          <p>
            A bottleneck owner caps the business at the owner&apos;s personal capacity. It also creates an
            emotional tax: no switch-off, no reliable time away, constant urgency.
          </p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">How To Stop Being The Bottleneck</h2>
          <ol className="list-decimal space-y-2 pl-8">
            <li>List everything that came through you last week.</li>
            <li>Mark each task A (only you), B (can train), or C (should already be delegated).</li>
            <li>Transfer one B/C task this week and do not take it back.</li>
            <li>Repeat weekly.</li>
          </ol>
          <p>Within three months, the operating profile of the business changes materially.</p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">A Note On What We Do</h2>
          <p>
            Owner Performance sits underneath every other part of the Profit System because marketing, sales,
            and systems gains do not hold while the owner remains the choke point.
          </p>
          <p className="!mt-10 text-2xl font-bold">Change one handover a week until the business can breathe.</p>
        </div>
      </article>
    </main>
  );
}
