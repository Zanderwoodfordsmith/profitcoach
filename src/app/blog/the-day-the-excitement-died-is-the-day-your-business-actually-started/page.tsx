import type { Metadata } from "next";
import Link from "next/link";
import { BlogAuthorByline } from "@/components/marketing/BlogAuthorByline";
import { ProfitCoachTopMenu } from "@/components/marketing/ProfitCoachTopMenu";

export const metadata: Metadata = {
  title:
    "The Day The Excitement Died Is The Day Your Business Actually Started — The Profit Coach",
  description:
    "Why losing the early buzz is not failure, but the transition point where real business rhythm begins.",
};

export default async function DayExcitementDiedBlogPostPage({
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
          The Day The Excitement Died Is The Day Your Business Actually Started
        </h1>
        <BlogAuthorByline readMinutes={8} coachSlug={searchParams?.coach} />

        <div className="mt-12 space-y-8 font-sans text-[1.12rem] leading-[2rem] text-slate-800 md:text-[1.22rem] md:leading-[2.2rem]">
          <p>
            Every owner remembers the high: first major client, first meaningful month, first real
            validation.
          </p>
          <p>
            Then somewhere between month 14 and year three, the excitement goes quiet. Most owners panic.
            They should not.
          </p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">What&apos;s Actually Happening</h2>
          <p>
            Excitement is a response to novelty. By definition, novelty fades. That is not a warning sign.
            It means your business has moved from new to normal.
          </p>
          <p>
            The mistake is reading flatness as failure, instead of seeing it as maturity.
          </p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">What Most Owners Do Next</h2>
          <p>
            They chase a new high, question the path, or quietly slow down. All three come from believing
            excitement was the engine.
          </p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">What&apos;s Actually True</h2>
          <p>
            Excitement is the spark. Rhythm is the engine. The real job is doing the right work when it no
            longer feels new.
          </p>
          <p>
            The owners who pull ahead are not more motivated. They are more structured.
          </p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">How To Recognise The Moment</h2>
          <p>
            You&apos;re still working hard but no longer feel proud of it. Same effort, lower emotional return.
            That is the transition point where many stall.
          </p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">What To Do About It</h2>
          <ol className="list-decimal space-y-2 pl-8">
            <li>Stop measuring progress by feeling alone.</li>
            <li>Replace excitement with a weekly and quarterly rhythm.</li>
            <li>Get honest about fatigue before questioning your entire direction.</li>
          </ol>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">A Note On What We Do</h2>
          <p>
            The Profit System is built around cadence and scoreboards, not motivation spikes. Flat Tuesdays
            and great Fridays run on the same structure.
          </p>
          <p className="!mt-10 text-2xl font-bold">The high is gone. That is the doorway. Walk through it.</p>
        </div>
      </article>
    </main>
  );
}
