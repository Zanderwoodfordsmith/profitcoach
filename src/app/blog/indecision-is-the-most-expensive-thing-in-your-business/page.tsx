import type { Metadata } from "next";
import Link from "next/link";
import { ProfitCoachTopMenu } from "@/components/marketing/ProfitCoachTopMenu";

export const metadata: Metadata = {
  title: "Indecision Is The Most Expensive Thing In Your Business — The Profit Coach",
  description:
    "Why decision backlogs silently drain profit, and a practical decision audit owners can run this week.",
};

export default function IndecisionBlogPostPage() {
  return (
    <main className="min-h-screen bg-[#fbfbfa] text-slate-900">
      <ProfitCoachTopMenu />
      <article className="mx-auto max-w-4xl px-6 pb-24 pt-14 md:px-8 md:pb-28 md:pt-16">
        <Link href="/blog" className="text-sm font-medium text-slate-500 transition hover:text-slate-800">
          ← Back to blog
        </Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[#0c5290]">Owner Performance</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.025em] md:text-6xl md:leading-[1.04]">
          Indecision Is The Most Expensive Thing In Your Business
        </h1>
        <p className="mt-6 text-sm text-slate-500">By The Profit Coach Team · 8 min read</p>

        <div className="mt-12 space-y-8 font-sans text-[1.12rem] leading-[2rem] text-slate-800 md:text-[1.22rem] md:leading-[2.2rem]">
          <p>
            Owners think the expensive things in business are the obvious ones. A bad hire. A failed
            campaign. A client that didn&apos;t pay.
          </p>
          <p>
            The most expensive thing in your business right now isn&apos;t on that list. It&apos;s the
            decision you&apos;ve been sitting on for six months.
          </p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">Every Owner Has A List</h2>
          <ul className="list-disc space-y-2 pl-8">
            <li>The team member who is not working out, but you keep hoping they will.</li>
            <li>The price you have not put up in two years, even though your costs have.</li>
            <li>The product, service, or client type that drains you but still remains.</li>
            <li>The supplier you know should change, but switching feels like hassle.</li>
            <li>The conversation with a partner or colleague that has been hanging for months.</li>
          </ul>
          <p>
            Most owners can tick at least three. Each one usually costs far more than it looks because
            nobody sends you a bill for indecision.
          </p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">Why Owners Delay</h2>
          <p>
            <strong>Hope.</strong> You hope it fixes itself.
          </p>
          <p>
            <strong>Avoidance.</strong> You do not want the awkward conversation.
          </p>
          <p>
            <strong>Optionality.</strong> Choosing feels expensive because it closes a door.
          </p>
          <p>A clear no is usually cheaper than a long maybe.</p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">The Maths Of Indecision</h2>
          <p>
            A pricing decision delayed by 18 months can quietly erase tens of thousands in margin.
            Underperforming team roles, flat channels, and unresolved supplier decisions compound the
            same way.
          </p>
          <p>Add your top three indecisions and you are often looking at six figures.</p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">The Decision Audit</h2>
          <ol className="list-decimal space-y-2 pl-8">
            <li>List every decision you have delayed more than 30 days.</li>
            <li>Estimate how long each has been hanging.</li>
            <li>Estimate monthly cost for each one.</li>
            <li>Total it.</li>
          </ol>
          <p>That total is your unbilled indecision tax.</p>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">What To Do This Week</h2>
          <p>Pick the single most expensive delayed decision. Make it this week.</p>
          <ul className="list-disc space-y-2 pl-8">
            <li>Tell one person out loud.</li>
            <li>Put a date on execution.</li>
            <li>Do not reopen it.</li>
          </ul>

          <h2 className="!mt-14 text-2xl font-bold md:text-3xl">A Note On What We Do</h2>
          <p>
            Inside the Profit System, much of the value is decision forcing. Owners rarely have a
            knowledge gap. They have a decision backlog.
          </p>
          <p className="!mt-10 text-2xl font-bold">Make one decision. Then the next.</p>
        </div>
      </article>
    </main>
  );
}
