"use client";

import Image from "next/image";
import Link from "next/link";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
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
import { useState, type ReactNode } from "react";
import { BossWheel } from "@/components/BossCharts/BossWheel";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-fraunces",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-jakarta",
});

const LINK_DIAGNOSTIC = "/assessment";
const LINK_COACH = "/directory";
const LINK_SIGNUP_COACH = "/signup";
const LOGO_WHITE = "/brand/profit-coach-logo-white.svg";

/** Demo wheel scores (0–10 per area) — illustrative only */
const DEMO_AREA_SCORES = [6.2, 5.4, 7.1, 4.9, 6.8, 5.6, 6.3, 6.9, 5.2, 6.5];
const DEMO_TOTAL = 62;

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
    a: "The owners who say this are usually the ones who need it most. The diagnostic takes 3 minutes. If you're in a busy season, your coach builds the plan around your timeline — not the other way around.",
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
    a: "Yes. The BOSS Diagnostic is free and takes 3 minutes. You'll see your full score across all 10 areas of your business and a calculation of the revenue gap your current score represents. You don't have to speak to a coach. But most owners do — because seeing the gap is the easy part. Closing it is what takes a coach.",
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

const navLinks = [
  { label: "The Profit System", href: "#profit-system" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Blog", href: "/blog" },
  { label: "Find a Coach", href: LINK_COACH },
  { label: "Resources", href: "#resources" },
] as const;

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function PrimaryCta({ className }: { className?: string }) {
  return (
    <Link
      href={LINK_DIAGNOSTIC}
      className={cx(
        "group inline-flex items-center justify-center gap-2 rounded-full bg-[#10b981] px-7 py-3.5 text-[15px] font-semibold text-[#061a2e] shadow-[0_14px_30px_-12px_rgba(16,185,129,0.5)] transition hover:brightness-110 active:scale-[0.98]",
        className
      )}
    >
      Take the BOSS Diagnostic
      <ArrowRight
        className="size-4 transition group-hover:translate-x-1"
        strokeWidth={2.5}
      />
    </Link>
  );
}

function SecondaryCta({
  className,
  dark,
}: {
  className?: string;
  dark?: boolean;
}) {
  return (
    <Link
      href={LINK_COACH}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full border px-7 py-3.5 text-[15px] font-semibold transition active:scale-[0.98]",
        dark
          ? "border-white/35 text-white hover:border-white hover:bg-white/10"
          : "border-[#d5dde5] bg-white text-[#0c5290] hover:border-[#0c5290]/40 hover:bg-[#f4f6f8]",
        className
      )}
    >
      Speak to a Coach
    </Link>
  );
}

function Eyebrow({
  children,
  onDark,
}: {
  children: ReactNode;
  onDark?: boolean;
}) {
  return (
    <p
      className={cx(
        "text-[12px] font-semibold uppercase tracking-[0.32em]",
        onDark ? "text-[#7ec8ff]" : "text-[#0c5290]"
      )}
    >
      {children}
    </p>
  );
}

function DisplayHeading({
  children,
  className,
  as: Tag = "h2",
}: {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <Tag
      className={cx(
        fraunces.className,
        "text-balance font-normal leading-[1.08] tracking-[-0.018em]",
        "[&_em]:font-normal [&_em]:italic",
        className
      )}
    >
      {children}
    </Tag>
  );
}

function BossWheelBlock({
  className,
  onDark,
}: {
  className?: string;
  onDark?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex justify-center rounded-[14px] border border-[#d5dde5] bg-white p-6 shadow-[0_24px_50px_-28px_rgba(12,36,56,0.35)] md:p-8",
        onDark &&
          "border-white/15 bg-white/95 [&_.text-slate-500]:!text-slate-600",
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
    <div
      className={cx(
        jakarta.className,
        fraunces.variable,
        jakarta.variable,
        "min-h-screen scroll-smooth bg-[#f4f6f8] text-[#0c2438] antialiased"
      )}
    >
      <style>{`
        @keyframes nh-rise {
          from { opacity: 0; transform: translateY(22px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes nh-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .nh-rise { animation: nh-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .nh-fade { animation: nh-fade 0.9s ease both; }
        @media (prefers-reduced-motion: reduce) {
          .nh-rise, .nh-fade { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>

      {/* ─── Nav ─── */}
      <header className="absolute inset-x-0 top-0 z-50">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-5 md:px-8">
          <Link href="/new-home" className="relative z-10 flex items-center">
            <Image
              src={LOGO_WHITE}
              alt="The Profit Coach"
              width={148}
              height={36}
              className="h-8 w-auto"
              priority
              unoptimized
            />
          </Link>

          <nav className="hidden items-center gap-8 text-[13px] font-medium text-white/75 lg:flex">
            {navLinks.map((l) =>
              l.href.startsWith("/") ? (
                <Link
                  key={l.href}
                  href={l.href}
                  className="transition hover:text-white"
                >
                  {l.label}
                </Link>
              ) : (
                <a
                  key={l.href}
                  href={l.href}
                  className="transition hover:text-white"
                >
                  {l.label}
                </a>
              )
            )}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href={LINK_DIAGNOSTIC}
              className="hidden rounded-full bg-[#10b981] px-5 py-2.5 text-[13px] font-semibold text-[#061a2e] shadow-[0_10px_24px_-10px_rgba(16,185,129,0.55)] transition hover:brightness-110 sm:inline-flex"
            >
              Take the Diagnostic
            </Link>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-full border border-white/25 text-white lg:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div className="border-t border-white/10 bg-[#061a2e]/95 px-5 py-6 backdrop-blur-xl lg:hidden">
            <nav className="flex flex-col gap-4 text-sm font-medium text-white/85">
              {navLinks.map((l) =>
                l.href.startsWith("/") ? (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className="py-1"
                  >
                    {l.label}
                  </Link>
                ) : (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className="py-1"
                  >
                    {l.label}
                  </a>
                )
              )}
              <PrimaryCta className="mt-2 w-full" />
              <SecondaryCta dark className="w-full" />
            </nav>
          </div>
        ) : null}
      </header>

      <main>
        {/* ─── Hero ─── */}
        <section className="relative overflow-hidden bg-[#061a2e] pt-24 text-white md:pt-28">
          <div
            className="pointer-events-none absolute inset-0 nh-fade"
            aria-hidden
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(66,161,238,0.30), transparent 60%), radial-gradient(ellipse 50% 50% at 85% 20%, rgba(13,148,136,0.18), transparent 55%), linear-gradient(180deg, #061523 0%, #08243d 55%, #0a3358 100%)",
              }}
            />
            <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#42a1ee]/20 blur-[120px]" />
          </div>

          <div className="relative mx-auto grid max-w-[1180px] items-center gap-12 px-5 pb-14 pt-8 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-16 lg:pt-12">
            <div className="nh-rise" style={{ animationDelay: "60ms" }}>
              <Eyebrow onDark>One-to-One Business Coaching</Eyebrow>
              <DisplayHeading
                as="h1"
                className="mt-5 max-w-xl text-[clamp(2.5rem,5vw,4rem)] text-white [&_em]:text-[#75c1ff]"
              >
                Transform your business.
                <br />
                <em>Reclaim your life.</em>
              </DisplayHeading>
              <p className="mt-6 max-w-lg text-[17px] font-normal leading-relaxed text-white/65 sm:text-[18px]">
                Personalised coaching for business owners doing £200K–£5M.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <PrimaryCta />
                <SecondaryCta dark />
              </div>
            </div>

            <div
              className="nh-rise relative mx-auto w-full max-w-[480px] lg:mx-0 lg:max-w-none"
              style={{ animationDelay: "160ms" }}
            >
              <div className="relative overflow-hidden rounded-[14px] border border-white/15 bg-white/5 p-4 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.65)] backdrop-blur-sm sm:p-6">
                <BossWheelBlock
                  onDark
                  className="!border-0 !bg-transparent !p-0 !shadow-none"
                />
                <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                  BOSS Diagnostic preview
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Sub-hero */}
        <section
          id="how-it-works"
          className="scroll-mt-20 border-b border-[#d5dde5] bg-white"
        >
          <div className="mx-auto grid max-w-[1180px] gap-12 px-5 py-16 md:grid-cols-2 md:items-center md:gap-16 md:px-8 md:py-24">
            <div className="nh-rise" style={{ animationDelay: "80ms" }}>
              <Eyebrow>How it works</Eyebrow>
              <DisplayHeading className="mt-4 text-[clamp(1.85rem,3.6vw,2.85rem)] text-[#061a2e] [&_em]:text-[#0c5290]">
                Unlock 30–130% more profit in just <em>12 months</em>.
              </DisplayHeading>
              <p className="mt-6 text-[16px] leading-relaxed text-[#44525f] md:text-[17px]">
                A certified Profit Coach helps you find the hidden profit in your
                business — and builds the plan to capture it. One coach. One
                system. One business that finally pays you back.
              </p>
              <div className="mt-8">
                <a
                  href="#overview-video"
                  className="group inline-flex items-center gap-3 text-[15px] font-semibold text-[#0c5290] transition hover:text-[#061a2e]"
                >
                  <span className="inline-flex size-11 items-center justify-center rounded-full border border-[#d5dde5] bg-[#f4f6f8] text-[#0c5290] transition group-hover:border-[#0c5290]/40">
                    <Play className="size-3.5 fill-current" />
                  </span>
                  Watch the 2-Minute Overview
                </a>
              </div>
            </div>
            <div className="nh-rise" style={{ animationDelay: "180ms" }}>
              <BossWheelBlock />
            </div>
          </div>
        </section>

        {/* Overview video placeholder */}
        <section
          id="overview-video"
          className="scroll-mt-20 mx-auto max-w-[900px] px-5 py-12 md:px-8 md:py-16"
        >
          <div className="overflow-hidden rounded-[14px] border border-[#d5dde5] bg-[#e8eef3] shadow-[0_24px_50px_-28px_rgba(12,36,56,0.25)]">
            <div className="flex aspect-video flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex size-16 items-center justify-center rounded-full border border-white/50 bg-white/80 text-[#0c5290] shadow-md backdrop-blur-md">
                <Play className="size-6 translate-x-0.5 fill-current" />
              </div>
              <p className="text-sm font-medium text-[#44525f]">
                2-minute overview video
              </p>
              <p className="text-xs text-[#6b7a88]">
                Embed or URL to be added before launch.
              </p>
            </div>
          </div>
        </section>

        {/* Outcome band */}
        <section className="py-8 md:py-10" aria-label="Outcomes">
          <div className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#f4f6f8] to-transparent md:w-16" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#f4f6f8] to-transparent md:w-16" />
            <div className="flex gap-4 overflow-x-auto px-5 pb-2 pt-2 [scrollbar-width:none] md:gap-5 md:px-8 [&::-webkit-scrollbar]:hidden">
              {outcomeItems.map(({ label, Icon }) => (
                <div
                  key={label}
                  className="flex shrink-0 items-center gap-3 rounded-[12px] border border-[#d5dde5] bg-white px-5 py-3.5 shadow-[0_1px_2px_rgba(12,36,56,0.04)]"
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-[10px] bg-[#10b981]/12 text-[#059669]">
                    <Icon className="size-5" strokeWidth={2} />
                  </span>
                  <span className="whitespace-nowrap text-[14px] font-semibold text-[#061a2e] md:text-[15px]">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="mx-auto max-w-[1180px] px-5 py-16 md:px-8 md:py-24">
          <Eyebrow>What you get</Eyebrow>
          <DisplayHeading className="mt-4 max-w-2xl text-[clamp(1.85rem,3.4vw,2.75rem)] text-[#061a2e] [&_em]:text-[#0c5290]">
            What you get with a certified <em>Profit Coach</em>
          </DisplayHeading>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {benefitCards.map((card) => (
              <article
                key={card.title}
                className="rounded-[14px] border border-[#d5dde5] bg-white p-7 shadow-[0_1px_2px_rgba(12,36,56,0.04)] transition hover:border-[#0c5290]/30 hover:shadow-[0_16px_40px_-20px_rgba(12,36,56,0.2)]"
              >
                <h3 className="text-[17px] font-bold tracking-tight text-[#061a2e]">
                  {card.title}
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-[#44525f] md:text-[15px]">
                  {card.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Vision */}
        <section className="border-y border-[#d5dde5] bg-white py-16 md:py-24">
          <div className="mx-auto max-w-[720px] px-5 text-center md:px-8">
            <Eyebrow>The shift</Eyebrow>
            <DisplayHeading className="mt-4 text-[clamp(1.85rem,3.4vw,2.75rem)] text-[#061a2e] [&_em]:text-[#0c5290]">
              Go from grinding to <em>growing</em>.
            </DisplayHeading>
            <div className="mt-8 space-y-5 text-left text-[16px] leading-[1.78] text-[#44525f] md:text-[17px]">
              <p>
                You started this for a reason. The income, the freedom, the
                impact, the life you wanted to build.
              </p>
              <p>
                Somewhere along the way, the business turned into a job — one
                that runs you instead of working for you. You can&apos;t take a
                real holiday. Decisions still come back to your desk. The team
                needs you for everything. Some months are great. Others,
                you&apos;re watching cash flow more carefully than you&apos;d
                like.
              </p>
              <p>
                A certified Profit Coach gives you the structure to step back
                from the day-to-day, build a team that owns the work, and run a
                business that pays you back — in profit, in freedom, and in the
                life you started this for.
              </p>
              <p className="font-semibold text-[#061a2e]">
                This is your roadmap to a business that works for you. Not
                because of you.
              </p>
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section className="mx-auto max-w-[1180px] px-5 py-16 md:px-8 md:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <Eyebrow>Who it&apos;s for</Eyebrow>
              <DisplayHeading className="mt-4 text-[clamp(1.85rem,3.4vw,2.75rem)] text-[#061a2e] [&_em]:text-[#0c5290]">
                Built for owners who want <em>more</em>.
              </DisplayHeading>
              <p className="mt-6 text-[16px] leading-relaxed text-[#44525f] md:text-[17px]">
                This is for founders, owner-operators, and managing directors of
                businesses doing £200K to £5M — anyone who&apos;s built something
                real and is ready to make it work for them, not the other way
                around.
              </p>
              <p className="mt-6 text-[15px] font-semibold text-[#061a2e] md:text-[16px]">
                If three or more of these sound like your week, a Profit Coach
                can help:
              </p>
            </div>
            <ul className="space-y-3">
              {whoItsFor.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 rounded-[12px] border border-[#d5dde5] bg-white px-5 py-4 text-[14px] leading-relaxed text-[#44525f] md:text-[15px]"
                >
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#10b981]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Profit System */}
        <section
          id="profit-system"
          className="scroll-mt-20 relative overflow-hidden py-16 text-white md:py-24"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 80% -10%, rgba(66,161,238,0.20), transparent 60%), linear-gradient(180deg, #0a3358 0%, #061a2e 100%)",
          }}
        >
          <div className="relative mx-auto max-w-[1180px] px-5 md:px-8">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
              <div>
                <Eyebrow onDark>The Profit System</Eyebrow>
                <DisplayHeading className="mt-4 text-[clamp(1.85rem,3.4vw,2.75rem)] text-white [&_em]:text-[#75c1ff]">
                  Built on the world&apos;s best business{" "}
                  <em>thinking</em>.
                </DisplayHeading>
                <p className="mt-6 text-[16px] leading-relaxed text-white/70 md:text-[17px]">
                  The Profit System is the operating methodology that every
                  certified Profit Coach uses with their clients. It maps the
                  work of 25+ of the world&apos;s leading business thinkers —
                  Hormozi, Gerber, Michalowicz, Harnish, and more — into one
                  connected system.
                </p>
                <p className="mt-5 text-[16px] leading-relaxed text-white/70 md:text-[17px]">
                  10 areas of business, scored across 5 levels of performance. 50
                  playbooks. One BOSS Diagnostic that shows you exactly where
                  your business stands today — and exactly what to fix first.
                </p>
                <p className="mt-5 text-[16px] leading-relaxed text-white/70 md:text-[17px]">
                  This is what a real operating system looks like. Not advice.
                  Not theory. A complete, integrated playbook for transforming a
                  business — delivered one-to-one, by a coach who knows your
                  numbers, your priorities, and your people.
                </p>
                <Link
                  href="/how-it-works#methodology"
                  className="group mt-8 inline-flex items-center gap-2 text-[14px] font-semibold text-[#7ec8ff] transition hover:text-white"
                >
                  Learn About The Profit System
                  <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                </Link>
              </div>
              <BossWheelBlock onDark />
            </div>
          </div>
        </section>

        {/* Differentiators */}
        <section className="mx-auto max-w-[1180px] px-5 py-16 md:px-8 md:py-24">
          <Eyebrow>Why Profit Coaching</Eyebrow>
          <DisplayHeading className="mt-4 max-w-xl text-[clamp(1.85rem,3.4vw,2.75rem)] text-[#061a2e] [&_em]:text-[#0c5290]">
            What makes a Profit Coach <em>different</em>.
          </DisplayHeading>
          <div className="mt-12 grid gap-5 md:grid-cols-2 md:gap-6">
            {differentiators.map((d) => (
              <article
                key={d.title}
                className="rounded-[14px] border border-[#d5dde5] bg-white p-7 shadow-[0_1px_2px_rgba(12,36,56,0.04)]"
              >
                <h3 className="text-[17px] font-bold tracking-tight text-[#0c5290]">
                  {d.title}
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-[#44525f] md:text-[15px]">
                  {d.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Elite framing */}
        <section className="border-y border-[#d5dde5] bg-white py-16 md:py-20">
          <div className="mx-auto max-w-[720px] px-5 text-center md:px-8">
            <DisplayHeading className="text-[clamp(1.85rem,3.4vw,2.75rem)] text-[#061a2e] [&_em]:text-[#0c5290]">
              The world&apos;s best businesses run on a <em>system</em>.
            </DisplayHeading>
            <p className="mt-6 text-[16px] leading-relaxed text-[#44525f] md:text-[17px]">
              The owner-operators who win are the ones who installed an operating
              system early — and worked it consistently. The ones who plateau are
              the ones still running the business out of their own head.
            </p>
            <p className="mt-5 text-[16px] leading-relaxed text-[#44525f] md:text-[17px]">
              A certified Profit Coach gives you the system, the accountability,
              and the outside perspective to see what you can&apos;t see from
              inside.
            </p>
            <p className="mt-5 text-[16px] font-semibold text-[#061a2e] md:text-[17px]">
              You don&apos;t need more advice. You need a coach who knows what to
              install, in what order, and how to make it stick.
            </p>
          </div>
        </section>

        {/* Testimonials */}
        <section
          id="proof"
          className="scroll-mt-20 mx-auto max-w-[1180px] px-5 py-16 md:px-8 md:py-24"
        >
          <Eyebrow>Proof</Eyebrow>
          <DisplayHeading className="mt-4 text-[clamp(1.85rem,3.4vw,2.75rem)] text-[#061a2e]">
            Results from real businesses
          </DisplayHeading>
          <p className="mt-3 text-[14px] text-[#6b7a88] md:text-[15px]">
            Named case studies with specific numbers — placeholders until launch
            assets are ready.
          </p>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {testimonialsPlaceholder.map((t) => (
              <figure
                key={t.quote}
                className="flex flex-col rounded-[14px] border border-[#d5dde5] bg-white p-7 shadow-[0_1px_2px_rgba(12,36,56,0.04)]"
              >
                <blockquote
                  className={cx(
                    fraunces.className,
                    "flex-1 text-[17px] italic leading-relaxed text-[#061a2e]"
                  )}
                >
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-6 text-[13px] text-[#6b7a88]">
                  — {t.name}, {t.role}
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="mt-14 flex justify-center">
            <div className="w-full max-w-md rounded-[14px] border border-[#d5dde5] bg-white p-6 shadow-[0_1px_2px_rgba(12,36,56,0.04)] sm:p-8">
              <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-[#6b7a88]">
                BOSS wheel
              </p>
              <BossWheelBlock className="!border-0 !p-0 !shadow-none" />
            </div>
          </div>
        </section>

        {/* Resources placeholder */}
        <section
          id="resources"
          className="scroll-mt-20 border-y border-[#d5dde5] bg-white py-16 md:py-20"
        >
          <div className="mx-auto max-w-[1180px] px-5 md:px-8">
            <Eyebrow>Resources</Eyebrow>
            <DisplayHeading className="mt-4 text-[clamp(1.65rem,3vw,2.25rem)] text-[#061a2e]">
              Guides, tools, and updates
            </DisplayHeading>
            <p className="mt-3 text-[15px] text-[#44525f]">
              Content coming soon.
            </p>
            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              {["Playbook preview", "Owner briefing", "90-day planner"].map(
                (title) => (
                  <div
                    key={title}
                    className="rounded-[12px] border border-dashed border-[#d5dde5] bg-[#f4f6f8] p-6 text-center text-[14px] font-semibold text-[#6b7a88]"
                  >
                    {title}
                    <span className="mt-2 block text-[12px] font-normal text-[#6b7a88]/80">
                      Placeholder
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="mx-auto max-w-[720px] px-5 py-16 md:px-8 md:py-24">
          <Eyebrow>FAQ</Eyebrow>
          <DisplayHeading className="mt-4 text-[clamp(1.85rem,3.4vw,2.75rem)] text-[#061a2e]">
            Common questions
          </DisplayHeading>
          <div className="mt-10 space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-[12px] border border-[#d5dde5] bg-white px-5 py-4 open:shadow-[0_8px_24px_-16px_rgba(12,36,56,0.2)]"
              >
                <summary className="cursor-pointer list-none text-left text-[14px] font-semibold text-[#061a2e] md:text-[15px] [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-3">
                    {faq.q}
                    <span className="text-[#0c5290] transition group-open:rotate-45">
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-4 text-[14px] leading-relaxed text-[#44525f] md:text-[15px]">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section
          className="relative overflow-hidden py-20 text-white md:py-28"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% -10%, rgba(66,161,238,0.22), transparent 60%), linear-gradient(180deg, #0a3358 0%, #061a2e 100%)",
          }}
        >
          <div className="relative mx-auto max-w-[720px] px-5 text-center md:px-8">
            <DisplayHeading className="text-[clamp(1.85rem,3.6vw,2.85rem)] text-white [&_em]:text-[#75c1ff]">
              Own your business.
              <br />
              <em>Don&apos;t let it own you.</em>
            </DisplayHeading>
            <p className="mt-6 text-[16px] leading-relaxed text-white/70 md:text-[17px]">
              You started this for a reason. The freedom, the income, the
              impact, the life you wanted to build.
            </p>
            <p className="mt-4 text-[16px] leading-relaxed text-white/70 md:text-[17px]">
              The BOSS Diagnostic and a certified Profit Coach are how you get
              there.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryCta />
              <SecondaryCta dark />
            </div>
            <p
              className={cx(
                fraunces.className,
                "mt-10 text-[15px] italic text-white/50"
              )}
            >
              Get the guidance you need to grow.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#04121f] py-16 text-white">
        <div className="mx-auto max-w-[1180px] px-5 md:px-8">
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Image
                src={LOGO_WHITE}
                alt="The Profit Coach"
                width={140}
                height={34}
                className="h-7 w-auto"
                unoptimized
              />
              <p
                className={cx(
                  fraunces.className,
                  "mt-3 text-[14px] italic text-white/55"
                )}
              >
                Less Chaos. More Profit. Real Freedom.
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">
                Explore
              </p>
              <ul className="mt-4 space-y-2 text-[14px] text-white/75">
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
                  <a
                    href="mailto:hello@theprofitcoach.com"
                    className="hover:text-white"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">
                Legal
              </p>
              <ul className="mt-4 space-y-2 text-[14px] text-white/75">
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">
                Take the next step
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Link
                  href={LINK_DIAGNOSTIC}
                  className="rounded-full bg-[#10b981] px-5 py-2.5 text-center text-[13px] font-semibold text-[#061a2e] transition hover:brightness-110"
                >
                  Take the BOSS Diagnostic
                </Link>
                <Link
                  href={LINK_COACH}
                  className="rounded-full border border-white/25 px-5 py-2.5 text-center text-[13px] font-semibold text-white transition hover:bg-white/10"
                >
                  Speak to a Coach
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-10 text-center text-[12px] text-white/40 md:flex-row md:items-center md:justify-between md:text-left">
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
