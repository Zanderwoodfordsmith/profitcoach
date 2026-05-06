import type { Metadata } from "next";
import Link from "next/link";
import { BlogAuthorByline } from "@/components/marketing/BlogAuthorByline";
import { ProfitCoachTopMenu } from "@/components/marketing/ProfitCoachTopMenu";

export const metadata: Metadata = {
  title: "Stop Trying To Get More Customers. Start Trying To Lose Fewer. — The Profit Coach",
  description:
    "Why retention is the fastest path to calmer, more profitable growth, and practical plays to reduce customer churn.",
};

export default async function LoseFewerCustomersBlogPostPage({
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
          Stop Trying To Get More Customers. Start Trying To Lose Fewer.
        </h1>
        <BlogAuthorByline readMinutes={9} coachSlug={searchParams?.coach} />

        <div className="mt-12 space-y-8 font-sans text-[1.12rem] leading-[2rem] text-slate-800 md:text-[1.22rem] md:leading-[2.2rem]">
          <p>
            Most owner-led businesses overfocus on acquisition and under-manage retention.
            Fixing churn often outperforms spending more on new customer acquisition.
          </p>
          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">Retention Maths In Plain English</h2>
          <p>
            Small retention improvements can add significant revenue without extra marketing spend,
            extra sales load, or onboarding strain.
          </p>
          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">Why Owners Miss It</h2>
          <ul className="list-disc space-y-2 pl-8">
            <li>New customers feel exciting; renewals feel invisible.</li>
            <li>Churn often happens quietly.</li>
            <li>Most teams don&apos;t collect clear churn reasons.</li>
          </ul>
          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">Retention Plays That Work</h2>
          <ul className="list-disc space-y-2 pl-8">
            <li>Quarterly risk-rating of active customers.</li>
            <li>Direct calls to at-risk customers.</li>
            <li>Monthly or quarterly check-in rhythm for top accounts.</li>
            <li>Fast owner-level response when service fails.</li>
            <li>Exit conversations to capture repeat churn patterns.</li>
          </ul>
          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">What To Do This Week</h2>
          <ol className="list-decimal space-y-2 pl-8">
            <li>Pull the active customer list sorted by revenue.</li>
            <li>Mark each customer as healthy, at risk, or critical.</li>
            <li>Call the three highest-value at-risk customers.</li>
            <li>Make one concrete improvement for each account this month.</li>
          </ol>
          <p className="!mt-10 text-2xl font-bold">Retention is attention, measured over time.</p>
        </div>
      </article>
    </main>
  );
}
