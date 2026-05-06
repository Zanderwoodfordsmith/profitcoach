import type { Metadata } from "next";
import Link from "next/link";
import { ProfitCoachTopMenu } from "@/components/marketing/ProfitCoachTopMenu";

export const metadata: Metadata = {
  title: "Business Is Shockingly Simple. That's Why It's So Hard. — The Profit Coach",
  description:
    "A direct essay for business owners on why growth is simple in theory, emotionally hard in practice, and what to do this week to move forward.",
};

export default function BusinessIsSimpleBlogPostPage() {
  return (
    <main className="min-h-screen bg-[#fbfbfa] text-slate-900">
      <ProfitCoachTopMenu />

      <article className="mx-auto max-w-4xl px-6 pb-24 pt-14 md:px-8 md:pb-28 md:pt-16">
        <Link
          href="/blog"
          className="text-sm font-medium text-slate-500 transition hover:text-slate-800"
        >
          ← Back to blog
        </Link>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[#0c5290]">
          Owner Mindset
        </p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.025em] md:text-6xl md:leading-[1.04]">
          Business Is Shockingly Simple. That&apos;s Why It&apos;s So Hard.
        </h1>
        <p className="mt-6 text-sm text-slate-500">By The Profit Coach Team · 7 min read</p>

        <div className="mt-12 space-y-8 font-sans text-[1.12rem] leading-[2rem] text-slate-800 md:text-[1.22rem] md:leading-[2.2rem]">
          <p>Here&apos;s something most owners won&apos;t admit out loud.</p>

          <p>
            Running a business is not complicated.
            <br />
            It&apos;s hard. But it&apos;s not complicated.
          </p>

          <p>
            The maths fits on a napkin. Get more leads. Convert more of them. Charge
            enough. Deliver well. Keep your costs lower than your revenue. Do that for long
            enough and you have a business that pays you properly.
          </p>

          <p>That&apos;s it. That&apos;s the whole thing.</p>

          <p>
            So why does it feel so heavy?
            <br />
            Why do owners with ten years of experience still lie awake at 2am wondering if
            this month&apos;s wages will clear?
          </p>

          <p>Because simple is not the same as easy.</p>

          <h2 className="!mt-14 font-sans text-2xl font-bold leading-tight tracking-[-0.02em] text-slate-900 md:text-3xl">
            The Lie We Tell Ourselves
          </h2>

          <p>
            When something is hard, we want it to be complicated.
            <br />
            Complicated feels better. Complicated means there&apos;s a clever answer out there
            we haven&apos;t found yet. A new funnel. A new hire. A new system. A new coach. A
            new course.
          </p>

          <p>
            Complicated lets us off the hook. Because if the problem is complicated, then
            it&apos;s not our fault we haven&apos;t solved it yet.
          </p>

          <p>
            Simple is worse. Simple means we already know what to do. We just haven&apos;t done
            it.
          </p>

          <p>That&apos;s the part that hurts.</p>

          <h2 className="!mt-14 font-sans text-2xl font-bold leading-tight tracking-[-0.02em] text-slate-900 md:text-3xl">
            What&apos;s Actually Simple
          </h2>

          <p>Look at the list. Honestly.</p>

          <ul className="list-disc space-y-2 pl-8">
            <li>You know which clients drain you and which ones pay well.</li>
            <li>You know which marketing actually brings leads in and which is theatre.</li>
            <li>You know your prices are too low.</li>
            <li>
              You know there&apos;s a conversation with a team member you&apos;ve been avoiding for
              six months.
            </li>
            <li>You know your numbers are vague because you don&apos;t want to look at them.</li>
            <li>You know the offer needs reworking.</li>
            <li>You know the follow up is broken.</li>
          </ul>

          <p>
            None of that is a mystery. You don&apos;t need a guru to tell you. You already know.
          </p>

          <p>
            The reason you haven&apos;t fixed it isn&apos;t a knowledge gap. It&apos;s something else.
          </p>

          <h2 className="!mt-14 font-sans text-2xl font-bold leading-tight tracking-[-0.02em] text-slate-900 md:text-3xl">
            Why It&apos;s Hard
          </h2>

          <p>It&apos;s hard because the work is emotional, not intellectual.</p>

          <p>
            Putting your prices up is not difficult to understand. It&apos;s difficult to do,
            because you&apos;re scared the client will leave.
          </p>

          <p>
            Firing the wrong hire is not difficult to understand. It&apos;s difficult to do,
            because you feel guilty.
          </p>

          <p>
            Looking at your numbers is not difficult to understand. It&apos;s difficult to do,
            because you&apos;re scared of what you&apos;ll find.
          </p>

          <p>
            Saying no to the wrong work is not difficult to understand. It&apos;s difficult to
            do, because the cash feels like safety.
          </p>

          <p>
            The simple things are hard because doing them costs you something now in exchange
            for something better later. And most of us, on most days, would rather keep the
            pain we know than risk a different one.
          </p>

          <h2 className="!mt-14 font-sans text-2xl font-bold leading-tight tracking-[-0.02em] text-slate-900 md:text-3xl">
            The Complaint Trap
          </h2>

          <p>This is the bit nobody wants to hear.</p>

          <p>
            It is easier to complain about your business than to grow your business.
            <br />
            Complaining is free. Growing costs you something every single day.
          </p>

          <p>
            When you complain, you get sympathy from your partner, your mates, the other
            owners in the WhatsApp group. You feel a bit better for ten minutes. Nothing
            changes.
          </p>

          <p>
            When you grow, you have an awkward pricing conversation. You sit with a
            spreadsheet for two hours. You let go of a client who pays the bills but kills
            your weekends. You tell a team member their work isn&apos;t good enough.
          </p>

          <p>Complaining feels like progress. It isn&apos;t.</p>

          <p>
            The owners who pull away from the pack are not smarter. They&apos;ve just stopped
            flinching at the simple, hard things.
          </p>

          <h2 className="!mt-14 font-sans text-2xl font-bold leading-tight tracking-[-0.02em] text-slate-900 md:text-3xl">
            What To Do Instead
          </h2>

          <p>
            Stop looking for the clever answer.
            <br />
            Pick the one thing you already know you should do, and have been avoiding for the
            longest. That&apos;s the answer.
          </p>

          <p>It will probably be one of these:</p>

          <ul className="list-disc space-y-2 pl-8">
            <li>Look at the actual numbers this week. All of them.</li>
            <li>Put your prices up on the next quote.</li>
            <li>Have the conversation you&apos;ve been ducking.</li>
            <li>Stop a marketing activity that isn&apos;t working.</li>
            <li>Stop selling to the client type that&apos;s draining you.</li>
          </ul>

          <p>Pick one. Do it this week. Not next month. This week.</p>

          <p>That is the entire game.</p>

          <h2 className="!mt-14 font-sans text-2xl font-bold leading-tight tracking-[-0.02em] text-slate-900 md:text-3xl">
            A Note On What We Do
          </h2>

          <p>
            Most owners we work with at BOSS don&apos;t have a knowledge problem. They have a
            focus problem. They&apos;re doing thirty things, half of them badly, none of them
            ruthlessly.
          </p>

          <p>
            The Profit System exists to strip a business back to the few simple things that
            actually move the number, then make sure those things get done. Not in theory. In
            the next 90 days.
          </p>

          <p>
            If you&apos;ve read this far and quietly recognised yourself in three or four of the
            bullet points above, that&apos;s the signal.
          </p>

          <p>
            You don&apos;t need more ideas. You need to do the simple things you&apos;ve been putting
            off.
          </p>

          <p className="!mt-10 font-sans text-2xl font-bold leading-tight text-slate-900">
            Start today. Pick one.
          </p>
        </div>

        <div className="mt-14 border-t border-slate-200 pt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Next article
          </p>
          <Link
            href="/blog/the-5-levels-of-business-owner-most-people-get-stuck-at-level-2"
            className="mt-3 inline-block text-xl font-semibold tracking-[-0.01em] text-[#0c5290] transition hover:text-[#094271]"
          >
            The 5 Levels Of Business Owner. Most People Get Stuck At Level 2. →
          </Link>
        </div>
      </article>
    </main>
  );
}
