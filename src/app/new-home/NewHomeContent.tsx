"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bird,
  Clock,
  Compass,
  LineChart,
  Menu,
  Play,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { BossWheel } from "@/components/BossCharts/BossWheel";

const LINK_DIAGNOSTIC = "/assessment";
const LINK_COACH = "/directory";
const LINK_SIGNUP_COACH = "/signup";

/** Demo wheel scores (0–10 per area) — illustrative only */
const DEMO_AREA_SCORES = [6.2, 5.4, 7.1, 4.9, 6.8, 5.6, 6.3, 6.9, 5.2, 6.5];
const DEMO_TOTAL = 62;

const navy = "#0c5290";
const lightBlue = "#42a1ee";
const teal = "#0d9488";

const outcomeItems = [
  { label: "More Profit", Icon: TrendingUp },
  { label: "More Freedom", Icon: Bird },
  { label: "More Time", Icon: Clock },
  { label: "Stronger Team", Icon: Users },
  { label: "Predictable Revenue", Icon: LineChart },
  { label: "Clearer Strategy", Icon: Compass },
] as const;

const benefitCards = [
  {
    title: "Increase your profit",
    body: "Find hidden margin. Take control of your numbers. Make every decision from data, not gut feel.",
  },
  {
    title: "Build predictable revenue",
    body: "Get a marketing and sales engine that delivers consistent leads — without you doing all the selling.",
  },
  {
    title: "Lead a team that owns it",
    body: "Develop the leaders, systems, and culture so your team carries the weight you've been carrying alone.",
  },
  {
    title: "Systemise the work",
    body: "Document how the work gets done so quality and consistency don't depend on you being there.",
  },
  {
    title: "Reclaim your time",
    body: "Get out of the day-to-day. Lead from above the chaos. Stop being the bottleneck.",
  },
  {
    title: "Get a clear plan",
    body: "Know exactly where the business is going, what to fix next, and what to leave for later.",
  },
];

const differentiators = [
  {
    title: "Personalised attention",
    body: "A certified Profit Coach working one-to-one with you. They know your business, your numbers, your priorities. The plan is built for you.",
  },
  {
    title: "A proven system",
    body: "The Profit System covers every area of your business — from owner performance to team leadership. Built from 25+ leading business frameworks.",
  },
  {
    title: "Diagnosis, not guesswork",
    body: "Every engagement starts with the BOSS Diagnostic. You see exactly where you stand. Your coach works from your data, not their opinion.",
  },
  {
    title: "Measurable results",
    body: "Progress is tracked every 90 days. Before/after data shows exactly what moved. You always know where you stand.",
  },
];

const whoItsFor = [
  "You can't take a real holiday without your phone",
  "You've delegated, but the important decisions still come back to you",
  "Revenue is unpredictable — good months and bad months with no clear pattern",
  "You're working harder than ever, but the business isn't growing proportionally",
  "You've read the books, tried a coach, attended the events. Things shifted for a few weeks. Then you were back where you were",
  "You can't see exactly where the business is leaking time, money, or both",
];

const faqs = [
  {
    q: "I've worked with a business coach before. How is this different?",
    a: "Most business coaching is built around the coach's preferred frameworks and personal opinion. Profit Coaching is built around The Profit System — a complete operating methodology that covers every area of your business, with a diagnostic that shows your specific gaps. The plan comes from your data, not your coach's instinct.",
  },
  {
    q: "How much does it cost?",
    a: "Coaching engagements vary by coach, scope, and length. Most clients invest between £1,500 and £3,000 per month for one-to-one Profit Coaching. The diagnostic is free. Speak to a coach to find out what fits your situation.",
  },
  {
    q: "What if I don't have time for this right now?",
    a: "The owners who say this are usually the ones who need it most. The diagnostic takes 10 minutes. If you're in a busy season, your coach builds the plan around your timeline — not the other way around.",
  },
  {
    q: "My business is small. Is this for me?",
    a: "If you're doing £200K or more in revenue and you have at least one person on your team, yes. The Profit System works for businesses up to £5M. Below £200K the priority is usually getting to a stable revenue base, which most Profit Coaches can also help with.",
  },
  {
    q: "How long is a coaching engagement?",
    a: "Most engagements run for at least 6 months — long enough to take a complete diagnostic, build a 90-day plan, work the priorities, and re-take the diagnostic to measure what moved. Many clients renew for another 6 or 12 months.",
  },
  {
    q: "What does a typical session look like?",
    a: "Sessions are structured around your diagnostic results and 90-day priorities. Your coach works from your data — your score, your numbers, your team — to walk through what's working, what's not, and what to do next. No fluff. No filler.",
  },
  {
    q: "Can I just take the diagnostic without coaching?",
    a: "Yes. The BOSS Diagnostic is free and takes 10 minutes. You'll see your full score across all 10 areas of your business and a calculation of the revenue gap your current score represents. You don't have to speak to a coach. But most owners do — because seeing the gap is the easy part. Closing it is what takes a coach.",
  },
  {
    q: "How do I find the right coach?",
    a: "Every coach in the directory is certified in the full Profit System. They differ in industry experience, location, and personal style. Browse the directory, read their profiles, and book an introductory call with one or two. The first call is free.",
  },
];

const testimonialsPlaceholder = [
  {
    quote:
      "We went from £600K to £1.2M in 18 months without me adding a single hour to my week.",
    name: "Name pending",
    role: "Managing Director, professional services",
  },
  {
    quote:
      "Finally a system, not another opinion. The diagnostic showed us exactly where we were leaking margin.",
    name: "Name pending",
    role: "Founder, e-commerce",
  },
  {
    quote:
      "I took a two-week holiday and the business ran without my phone. That hadn't happened in ten years.",
    name: "Name pending",
    role: "Owner-operator, trade services",
  },
];

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function PrimaryCta({ className }: { className?: string }) {
  return (
    <Link
      href={LINK_DIAGNOSTIC}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[0.9375rem] font-semibold text-white shadow-lg transition duration-300 hover:brightness-110 active:scale-[0.98]",
        className
      )}
      style={{
        background: `linear-gradient(135deg, ${navy} 0%, #063056 100%)`,
        boxShadow: `0 12px 40px -12px ${navy}88`,
      }}
    >
      Take the BOSS Diagnostic
      <ArrowRight className="h-4 w-4 opacity-90" strokeWidth={2} />
    </Link>
  );
}

function SecondaryCta({ className, dark }: { className?: string; dark?: boolean }) {
  return (
    <Link
      href={LINK_COACH}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full border px-7 py-3.5 text-[0.9375rem] font-semibold transition duration-300 active:scale-[0.98]",
        dark
          ? "border-white/25 bg-white/10 text-white backdrop-blur-md hover:bg-white/15"
          : "border-slate-200/90 bg-white/60 text-[#0c5290] backdrop-blur-md hover:bg-white/90",
        className
      )}
    >
      Speak to a Coach
    </Link>
  );
}

function BossWheelBlock({
  className,
  onDark,
}: {
  className?: string;
  /** Improve score label contrast on dark backgrounds */
  onDark?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex justify-center rounded-[2rem] border border-white/50 bg-white/50 p-6 shadow-[0_20px_60px_-24px_rgba(12,82,144,0.35)] backdrop-blur-xl md:p-10",
        onDark &&
          "[&_.text-slate-500]:!text-white/85 [&_.font-semibold.text-slate-500]:!text-white/90",
        className
      )}
    >
      <div className="max-w-full [&>div]:justify-center">
        <BossWheel
          areaScores={DEMO_AREA_SCORES}
          totalScore={DEMO_TOTAL}
          aria-label="BOSS wheel preview across ten business areas"
          showLegend={false}
        />
      </div>
    </div>
  );
}

export function NewHomeContent() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen scroll-smooth bg-[#f5f8fc] font-sans text-slate-800 antialiased">
      {/* ambient background */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute -left-[20%] top-0 h-[min(80vh,720px)] w-[min(80vw,720px)] rounded-full opacity-[0.14] blur-3xl"
          style={{ background: `radial-gradient(circle at 30% 30%, ${lightBlue}, transparent 65%)` }}
        />
        <div
          className="absolute -right-[10%] top-[20%] h-[min(70vh,560px)] w-[min(70vw,560px)] rounded-full opacity-[0.11] blur-3xl"
          style={{ background: `radial-gradient(circle at 70% 40%, ${teal}, transparent 60%)` }}
        />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/40 bg-[#f5f8fc]/75 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <Link
            href="/new-home"
            className="text-lg font-semibold tracking-tight text-[#0c5290] md:text-xl"
          >
            The Profit Coach
          </Link>

          <nav className="hidden items-center gap-8 text-[0.8125rem] font-medium text-slate-600 lg:flex">
            <a href="#profit-system" className="transition hover:text-[#0c5290]">
              The Profit System
            </a>
            <Link href="/how-it-works" className="transition hover:text-[#0c5290]">
              How It Works
            </Link>
            <Link href="/blog" className="transition hover:text-[#0c5290]">
              Blog
            </Link>
            <Link href={LINK_COACH} className="transition hover:text-[#0c5290]">
              Find a Coach
            </Link>
            <a href="#resources" className="transition hover:text-[#0c5290]">
              Resources
            </a>
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <PrimaryCta className="!py-2.5 !px-5 !text-[0.8125rem]" />
          </div>

          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/80 bg-white/70 text-slate-700 backdrop-blur lg:hidden"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen ? (
          <div className="border-t border-white/50 bg-[#f5f8fc]/95 px-5 py-6 backdrop-blur-xl lg:hidden">
            <nav className="flex flex-col gap-4 text-sm font-medium text-slate-700">
              <a href="#profit-system" onClick={() => setMobileOpen(false)}>
                The Profit System
              </a>
              <Link href="/how-it-works" onClick={() => setMobileOpen(false)}>
                How It Works
              </Link>
              <Link href="/blog" onClick={() => setMobileOpen(false)}>
                Blog
              </Link>
              <Link href={LINK_COACH} onClick={() => setMobileOpen(false)}>
                Find a Coach
              </Link>
              <a href="#resources" onClick={() => setMobileOpen(false)}>
                Resources
              </a>
              <PrimaryCta className="mt-2 w-full" />
              <SecondaryCta className="w-full" />
            </nav>
          </div>
        ) : null}
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-12 md:px-8 md:pb-24 md:pt-16 lg:pt-20">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-[#0c5290]/90 md:text-sm">
            One-to-One Business Coaching
          </p>
          <h1 className="max-w-4xl text-[2.375rem] font-light leading-[1.08] tracking-[-0.035em] text-slate-900 md:text-5xl md:leading-[1.06] lg:text-[4rem] lg:leading-[1.02]">
            Transform your business.
            <br />
            <span className="font-normal text-[#0c5290]">Reclaim your life.</span>
          </h1>
          <p className="mt-8 max-w-xl text-lg font-normal leading-relaxed text-slate-600 md:text-xl">
            Personalised coaching for business owners doing £200K–£5M.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <PrimaryCta />
            <SecondaryCta />
          </div>
        </section>

        {/* Sub-hero */}
        <section
          id="how-it-works"
          className="border-y border-white/60 bg-white/40 py-16 backdrop-blur-sm md:py-24"
        >
          <div className="mx-auto grid max-w-6xl gap-12 px-5 md:grid-cols-2 md:items-center md:gap-16 md:px-8">
            <div>
              <h2 className="text-3xl font-light leading-tight tracking-[-0.03em] text-slate-900 md:text-4xl lg:text-[2.75rem] lg:leading-[1.12]">
                Unlock 30–130% more profit in just 12 months.
              </h2>
              <p className="mt-6 text-base leading-relaxed text-slate-600 md:text-lg">
                A certified Profit Coach helps you find the hidden profit in your business — and
                builds the plan to capture it. One coach. One system. One business that finally
                pays you back.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href="#overview-video"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200/90 bg-white/70 px-7 py-3.5 text-[0.9375rem] font-semibold text-[#0c5290] backdrop-blur-md transition hover:bg-white"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0c5290] text-white">
                    <Play className="h-4 w-4 translate-x-0.5" fill="currentColor" strokeWidth={0} />
                  </span>
                  Watch the 2-Minute Overview
                </a>
              </div>
            </div>
            <BossWheelBlock />
          </div>
        </section>

        {/* Overview video — placeholder immediately after sub-hero (Section 2 CTA target) */}
        <section id="overview-video" className="mx-auto max-w-4xl px-5 py-10 md:px-8 md:py-14">
          <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-slate-200/40 shadow-inner backdrop-blur-sm">
            <div className="flex aspect-video flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/80 text-[#0c5290] shadow-md">
                <Play className="h-7 w-7 translate-x-0.5" fill="currentColor" strokeWidth={0} />
              </div>
              <p className="text-sm font-medium text-slate-600">2-minute overview video</p>
              <p className="text-xs text-slate-500">Embed or URL to be added before launch.</p>
            </div>
          </div>
        </section>

        {/* Outcome band */}
        <section className="py-10 md:py-12" aria-label="Outcomes">
          <div className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#f5f8fc] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#f5f8fc] to-transparent" />
            <div className="flex gap-4 overflow-x-auto pb-2 pl-5 pr-5 pt-2 [scrollbar-width:none] md:gap-6 md:pl-8 md:pr-8 [&::-webkit-scrollbar]:hidden">
              {outcomeItems.map(({ label, Icon }) => (
                <div
                  key={label}
                  className="flex shrink-0 items-center gap-3 rounded-2xl border border-slate-200/60 bg-white/55 px-5 py-3.5 shadow-sm backdrop-blur-md"
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-inner"
                    style={{
                      background: `linear-gradient(145deg, ${lightBlue}, ${navy})`,
                    }}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="whitespace-nowrap text-sm font-semibold text-slate-800 md:text-base">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <h2 className="max-w-2xl text-3xl font-light tracking-[-0.03em] text-slate-900 md:text-4xl">
            What you get with a certified Profit Coach
          </h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {benefitCards.map((card) => (
              <article
                key={card.title}
                className="group rounded-3xl border border-slate-200/50 bg-white/60 p-8 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] backdrop-blur-xl transition duration-300 hover:border-[#42a1ee]/30 hover:shadow-[0_12px_40px_-12px_rgba(12,82,144,0.15)]"
              >
                <h3 className="text-lg font-semibold text-slate-900">{card.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 md:text-[0.9375rem]">
                  {card.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Vision */}
        <section className="border-y border-white/50 bg-gradient-to-b from-white/30 to-transparent py-16 md:py-24">
          <div className="mx-auto max-w-3xl px-5 text-center md:px-8">
            <h2 className="text-3xl font-light tracking-[-0.03em] text-slate-900 md:text-4xl">
              Go from grinding to growing.
            </h2>
            <div className="mt-8 space-y-5 text-left text-base leading-[1.75] text-slate-600 md:text-lg">
              <p>
                You started this for a reason. The income, the freedom, the impact, the life you
                wanted to build.
              </p>
              <p>
                Somewhere along the way, the business turned into a job — one that runs you instead
                of working for you. You can&apos;t take a real holiday. Decisions still come back to
                your desk. The team needs you for everything. Some months are great. Others,
                you&apos;re watching cash flow more carefully than you&apos;d like.
              </p>
              <p>
                A certified Profit Coach gives you the structure to step back from the day-to-day,
                build a team that owns the work, and run a business that pays you back — in profit,
                in freedom, and in the life you started this for.
              </p>
              <p className="font-medium text-slate-800">
                This is your roadmap to a business that works for you. Not because of you.
              </p>
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <h2 className="text-3xl font-light tracking-[-0.03em] text-slate-900 md:text-4xl">
                Built for owners who want more.
              </h2>
              <p className="mt-6 text-base leading-relaxed text-slate-600 md:text-lg">
                This is for founders, owner-operators, and managing directors of businesses doing
                £200K to £5M — anyone who&apos;s built something real and is ready to make it work
                for them, not the other way around.
              </p>
              <p className="mt-6 text-base font-medium text-slate-800">
                If three or more of these sound like your week, a Profit Coach can help:
              </p>
            </div>
            <ul className="space-y-4">
              {whoItsFor.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 rounded-2xl border border-slate-200/50 bg-white/50 px-5 py-4 text-sm leading-relaxed text-slate-700 backdrop-blur-sm md:text-[0.9375rem]"
                >
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: teal }}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Profit System */}
        <section
          id="profit-system"
          className="bg-[#071525] py-16 text-white md:py-24"
          style={{
            backgroundImage: `radial-gradient(ellipse 80% 60% at 50% -20%, ${navy}55, transparent), linear-gradient(180deg, #061018 0%, #071525 100%)`,
          }}
        >
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
              <div>
                <h2 className="text-3xl font-light tracking-[-0.03em] md:text-4xl lg:text-[2.5rem]">
                  Built on the world&apos;s best business thinking.
                </h2>
                <p className="mt-6 text-base leading-relaxed text-white/75 md:text-lg">
                  The Profit System is the operating methodology that every certified Profit Coach
                  uses with their clients. It maps the work of 25+ of the world&apos;s leading
                  business thinkers — Hormozi, Gerber, Michalowicz, Harnish, and more — into one
                  connected system.
                </p>
                <p className="mt-5 text-base leading-relaxed text-white/75 md:text-lg">
                  10 areas of business, scored across 5 levels of performance. 50 playbooks. One
                  BOSS Diagnostic that shows you exactly where your business stands today — and
                  exactly what to fix first.
                </p>
                <p className="mt-5 text-base leading-relaxed text-white/75 md:text-lg">
                  This is what a real operating system looks like. Not advice. Not theory. A
                  complete, integrated playbook for transforming a business — delivered one-to-one,
                  by a coach who knows your numbers, your priorities, and your people.
                </p>
                <Link
                  href="/how-it-works#methodology"
                  className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#7ec8ff] transition hover:text-white"
                >
                  Learn About The Profit System
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <BossWheelBlock
                onDark
                className="border-white/10 bg-white/5 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.5)]"
              />
            </div>
          </div>
        </section>

        {/* Differentiators */}
        <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <h2 className="max-w-xl text-3xl font-light tracking-[-0.03em] text-slate-900 md:text-4xl">
            What makes a Profit Coach different.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {differentiators.map((d) => (
              <article
                key={d.title}
                className="rounded-3xl border border-slate-200/40 bg-white/50 p-8 backdrop-blur-xl"
              >
                <h3 className="text-lg font-semibold text-[#0c5290]">{d.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 md:text-[0.9375rem]">
                  {d.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Elite framing */}
        <section className="border-t border-slate-200/60 bg-white/35 py-16 backdrop-blur-sm md:py-20">
          <div className="mx-auto max-w-3xl px-5 text-center md:px-8">
            <h2 className="text-3xl font-light tracking-[-0.03em] text-slate-900 md:text-4xl">
              The world&apos;s best businesses run on a system.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-slate-600 md:text-lg">
              The owner-operators who win are the ones who installed an operating system early —
              and worked it consistently. The ones who plateau are the ones still running the
              business out of their own head.
            </p>
            <p className="mt-5 text-base leading-relaxed text-slate-600 md:text-lg">
              A certified Profit Coach gives you the system, the accountability, and the outside
              perspective to see what you can&apos;t see from inside.
            </p>
            <p className="mt-5 text-base font-medium text-slate-800 md:text-lg">
              You don&apos;t need more advice. You need a coach who knows what to install, in what
              order, and how to make it stick.
            </p>
          </div>
        </section>

        {/* Testimonials */}
        <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24" id="proof">
          <h2 className="text-3xl font-light tracking-[-0.03em] text-slate-900 md:text-4xl">
            Results from real businesses
          </h2>
          <p className="mt-3 text-sm text-slate-500 md:text-base">
            Named case studies with specific numbers — placeholders until launch assets are ready.
          </p>
          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {testimonialsPlaceholder.map((t) => (
              <figure
                key={t.quote}
                className="flex flex-col rounded-3xl border border-slate-200/50 bg-white/60 p-8 backdrop-blur-xl"
              >
                <blockquote className="flex-1 text-base leading-relaxed text-slate-800">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-6 text-sm text-slate-500">
                  — {t.name}, {t.role}
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="mt-14 flex justify-center">
            <div className="w-full max-w-md rounded-[2rem] border border-slate-200/50 bg-white/50 p-8 backdrop-blur-xl">
              <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                BOSS wheel
              </p>
              <BossWheelBlock className="!border-slate-200/40 !shadow-none" />
            </div>
          </div>
        </section>

        {/* Resources placeholder */}
        <section id="resources" className="border-y border-slate-200/50 bg-white/40 py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <h2 className="text-2xl font-light text-slate-900 md:text-3xl">Resources</h2>
            <p className="mt-2 text-slate-600">Guides, tools, and updates — content coming soon.</p>
            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              {["Playbook preview", "Owner briefing", "90-day planner"].map((title) => (
                <div
                  key={title}
                  className="rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/50 p-6 text-center text-sm font-medium text-slate-500"
                >
                  {title}
                  <span className="mt-2 block text-xs font-normal text-slate-400">Placeholder</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-24">
          <h2 className="text-3xl font-light tracking-[-0.03em] text-slate-900 md:text-4xl">
            Common questions
          </h2>
          <div className="mt-10 space-y-4">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-2xl border border-slate-200/50 bg-white/50 px-6 py-4 backdrop-blur-sm open:bg-white/70"
              >
                <summary className="cursor-pointer list-none text-left text-sm font-semibold text-slate-900 md:text-[0.9375rem] [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-3">
                    {faq.q}
                    <span className="text-[#0c5290] transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-slate-600 md:text-[0.9375rem]">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="border-t border-slate-200/60 bg-gradient-to-b from-white/50 to-[#f5f8fc] py-20 md:py-28">
          <div className="mx-auto max-w-3xl px-5 text-center md:px-8">
            <h2 className="text-3xl font-light tracking-[-0.03em] text-slate-900 md:text-4xl lg:text-[2.75rem]">
              Own your business.
              <br />
              <span className="text-[#0c5290]">Don&apos;t let it own you.</span>
            </h2>
            <p className="mt-6 text-base leading-relaxed text-slate-600 md:text-lg">
              You started this for a reason. The freedom, the income, the impact, the life you
              wanted to build.
            </p>
            <p className="mt-4 text-base leading-relaxed text-slate-600 md:text-lg">
              The BOSS Diagnostic and a certified Profit Coach are how you get there.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryCta />
              <SecondaryCta />
            </div>
            <p className="mt-10 text-sm italic text-slate-500">Get the guidance you need to grow.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/80 bg-[#061018] py-16 text-white">
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-lg font-semibold">The Profit Coach</p>
              <p className="mt-2 text-sm text-white/60 italic">
                Less Chaos. More Profit. Real Freedom.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                Explore
              </p>
              <ul className="mt-4 space-y-2 text-sm text-white/75">
                <li>
                  <a href="#profit-system" className="hover:text-white">
                    The Profit System
                  </a>
                </li>
                <li>
                  <Link href="/how-it-works" className="hover:text-white">
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link href={LINK_COACH} className="hover:text-white">
                    Find a Coach
                  </Link>
                </li>
                <li>
                  <a href="#resources" className="hover:text-white">
                    Resources
                  </a>
                </li>
                <li>
                  <a href="mailto:hello@theprofitcoach.com" className="hover:text-white">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                Legal
              </p>
              <ul className="mt-4 space-y-2 text-sm text-white/75">
                <li>
                  <a href="#" className="hover:text-white">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Terms of Use
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Cookie Policy
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                Take the next step
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Link
                  href={LINK_DIAGNOSTIC}
                  className="rounded-full bg-white px-5 py-2.5 text-center text-sm font-semibold text-[#0c5290] hover:bg-white/90"
                >
                  Take the BOSS Diagnostic
                </Link>
                <Link
                  href={LINK_COACH}
                  className="rounded-full border border-white/25 px-5 py-2.5 text-center text-sm font-semibold text-white hover:bg-white/10"
                >
                  Speak to a Coach
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-10 text-center text-xs text-white/45 md:flex-row md:items-center md:justify-between md:text-left">
            <p>© 2026 The Profit Coach. All rights reserved.</p>
            <Link href={LINK_SIGNUP_COACH} className="hover:text-white/70">
              Become a Certified Profit Coach
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
