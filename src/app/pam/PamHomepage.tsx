"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  LineChart,
  Mail,
  MapPin,
  Menu,
  Phone,
  Play,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const LINK_DIAGNOSTIC = "/assessment";
const LINK_BOOK = "/doubleprofitsinsixmonths";
const LINK_BLOG = "/blog";
const LINK_HOW = "/how-it-works";

const PAM_PHOTO = "/pam/pam-portrait.jpg";
const PAM_STAGE = "/pam/pam-bca.png";
const LOGO_WHITE = "/brand/profit-coach-logo-white.svg";

const navLinks = [
  { label: "About", href: "#about" },
  { label: "System", href: "#system" },
  { label: "Results", href: "#results" },
  { label: "Method", href: "#method" },
  { label: "Stories", href: "#stories" },
  { label: "Blog", href: "#news" },
] as const;

const heroPills = [
  { icon: Target, label: "Diagnose" },
  { icon: Compass, label: "Prioritise" },
  { icon: TrendingUp, label: "Compound" },
] as const;

const aboutChecks = [
  "A clear score across every area of the business — not opinions",
  "The right sequence of work so you stop fixing the wrong things first",
  "Practical playbooks that turn strategy into this quarter’s actions",
];

const services = [
  {
    title: "Owner Performance",
    body: "Get out of the bottleneck. Protect focus, reclaim hours, and lead from above the chaos.",
    icon: Users,
  },
  {
    title: "Vision & Strategy",
    body: "Align the mission, strategy, and 90-day plan so the whole business pulls in one direction.",
    icon: Compass,
  },
  {
    title: "Profit & Velocity",
    body: "Find hidden margin, tighten cash, and build revenue systems that don’t depend on you.",
    icon: LineChart,
  },
  {
    title: "Team & Value",
    body: "Install standards, systems, and leadership so the business can run — and grow — without you.",
    icon: BarChart3,
  },
] as const;

const projects = [
  {
    title: "BOSS Diagnostic",
    category: "Clarity",
    image: "/landing/v2/dashboard.png",
    blurb: "Fifty questions. Ten areas. A score that shows where profit and time are leaking.",
  },
  {
    title: "Profit System",
    category: "Methodology",
    image: "/how-it-works/three-pillars.png",
    blurb: "Vision, Velocity, and Value — the complete operating system for owners.",
  },
  {
    title: "90-Day Plans",
    category: "Execution",
    image: "/how-it-works/nine-step-roadmap.png",
    blurb: "Sequenced playbooks so you fix what matters most, in the right order.",
  },
] as const;

const passionPoints = [
  "Uncover profit already sitting inside your numbers",
  "Install simple systems that free 10–15 hours a week",
  "Build a team that owns delivery — not just tasks",
  "Create a business that works when you step back",
];

const stats = [
  { value: "45+", label: "Years in business" },
  { value: "250+", label: "Coaches trained globally" },
  { value: "61%", label: "Typical profit lift path" },
  { value: "10–15h", label: "Hours reclaimed weekly" },
] as const;

const testimonials = [
  {
    quote:
      "I believe that Pam is the best coach I have ever, ever had. She's professional and insightful and the sessions that we've had fundamentally changed the way I do business; specifically I can point to huge amounts of profit in my various companies that Pam and only Pam recognised.",
    author: "John Davy",
    role: "Entrepreneur & business owner",
  },
  {
    quote:
      "The Profit System gave us a language for the whole business. For the first time we knew what to fix next — and what to leave alone. Profit went up while my hours went down.",
    author: "Business owner",
    role: "Service business, £1–3M",
  },
  {
    quote:
      "Straight-talking, practical, and relentlessly focused on profit and freedom. Pam doesn’t coach theory — she coaches the next move that puts cash in the bank.",
    author: "Client",
    role: "Owner-managed company",
  },
] as const;

const steps = [
  {
    num: "01",
    title: "See the truth",
    body: "Take the BOSS Diagnostic. You get a clear picture of Owner Performance and nine business modules — so coaching starts from data, not guesswork.",
  },
  {
    num: "02",
    title: "Install the priorities",
    body: "Pam turns your score into a sequenced 90-day plan using the Profit System playbooks. You work the levers that move profit and time first.",
  },
  {
    num: "03",
    title: "Measure and compound",
    body: "Every quarter you re-score, lock in what’s working, and raise the next set of standards — until the business runs without you as the bottleneck.",
  },
] as const;

const posts = [
  {
    title: "The Bottleneck In Your Business Has Your Name On It",
    excerpt:
      "If every decision still comes back to you, growth will always feel like more pressure — not more freedom.",
    href: "/blog/the-bottleneck-in-your-business-has-your-name-on-it",
    category: "Owner Performance",
    image: "/landing/v2/how-1.png",
  },
  {
    title: "If You Run A 10% Margin, Cutting Expenses By 11% Doubles Your Profit",
    excerpt:
      "Most owners chase revenue. The fastest path to cash is often already inside the P&L.",
    href: "/blog/if-you-run-a-10-percent-margin-cutting-expenses-by-11-percent-doubles-your-profit",
    category: "Profit & Cash Flow",
    image: "/landing/v2/dashboard.png",
  },
  {
    title: "The 5 Levels Of Business Owner — Most People Get Stuck At Level 2",
    excerpt:
      "From Overwhelm to Owner: why most businesses stall in Overworked — and how to climb.",
    href: "/blog/the-5-levels-of-business-owner-most-people-get-stuck-at-level-2",
    category: "Strategy",
    image: "/how-it-works/five-levels.png",
  },
] as const;

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function PamHomepage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const story = testimonials[storyIndex] ?? testimonials[0];

  return (
    <div
      className={cx(
        jakarta.className,
        "min-h-screen scroll-smooth bg-[#f5f8fc] text-[#0f172a] antialiased"
      )}
    >
      <style>{`
        @keyframes pam-rise {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pam-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .pam-rise { animation: pam-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .pam-fade { animation: pam-fade 0.9s ease both; }
      `}</style>

      {/* ─── Nav ─── */}
      <header className="absolute inset-x-0 top-0 z-50">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-5 md:px-8">
          <Link href="/pam" className="relative z-10 flex items-center gap-2.5">
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
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="transition hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href={LINK_BOOK}
              className="hidden rounded-full border border-white/35 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:border-white hover:bg-white/10 sm:inline-flex"
            >
              Book with Pam
            </Link>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-full border border-white/25 text-white lg:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div className="border-t border-white/10 bg-[#061a2e]/95 px-5 py-6 backdrop-blur-xl lg:hidden">
            <nav className="flex flex-col gap-4 text-sm font-medium text-white/85">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="py-1"
                >
                  {l.label}
                </a>
              ))}
              <Link
                href={LINK_BOOK}
                onClick={() => setMobileOpen(false)}
                className="mt-2 inline-flex items-center justify-center rounded-full bg-[#10b981] px-5 py-3 font-semibold text-[#061a2e]"
              >
                Book with Pam
              </Link>
            </nav>
          </div>
        ) : null}
      </header>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden bg-[#061a2e] pt-24 text-white md:pt-28">
        <div
          className="pointer-events-none absolute inset-0 pam-fade"
          aria-hidden
        >
          <div className="absolute -left-[20%] top-[-10%] h-[55%] w-[55%] rounded-full bg-[#0c5290]/35 blur-[100px]" />
          <div className="absolute -right-[10%] bottom-[-20%] h-[50%] w-[45%] rounded-full bg-[#1ca0c2]/20 blur-[110px]" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
              backgroundSize: "28px 28px",
            }}
          />
        </div>

        <div className="relative mx-auto grid max-w-[1180px] items-center gap-12 px-5 pb-10 pt-8 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-6 lg:pt-12">
          <div className="pam-rise" style={{ animationDelay: "60ms" }}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-[#7ec8ff]">
              Pam Woodford · Global #1 Profit Coach
            </p>
            <h1 className="mt-5 max-w-xl text-balance text-[clamp(2.35rem,5.2vw,3.75rem)] font-bold leading-[1.05] tracking-[-0.035em]">
              Build profit and grow your business with the Profit System
            </h1>
            <p className="mt-6 max-w-lg text-[17px] font-normal leading-relaxed text-white/65 sm:text-[18px]">
              Stop firefighting. Diagnose the real bottlenecks, install the right
              90-day priorities, and compound profit — without more hours, hires,
              or hassle.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href={LINK_BOOK}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#10b981] px-7 py-3.5 text-[15px] font-semibold text-[#061a2e] shadow-[0_12px_32px_-10px_rgba(16,185,129,0.55)] transition hover:brightness-110 active:scale-[0.98]"
              >
                Get started
                <ArrowRight className="size-4" strokeWidth={2.5} />
              </Link>
              <Link
                href={LINK_HOW}
                className="inline-flex items-center gap-2.5 rounded-full px-2 py-2 text-[15px] font-semibold text-white/90 transition hover:text-white"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-full border border-white/30 bg-white/5">
                  <Play className="size-3.5 fill-current" />
                </span>
                How it works
              </Link>
            </div>
          </div>

          <div
            className="relative pam-rise mx-auto w-full max-w-[520px] lg:mx-0 lg:max-w-none"
            style={{ animationDelay: "160ms" }}
          >
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-gradient-to-b from-[#0a3a66] to-[#061a2e] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.65)] sm:aspect-[5/6]">
              <Image
                src={PAM_PHOTO}
                alt="Pam Woodford"
                fill
                priority
                className="object-cover object-top"
                sizes="(max-width: 1024px) 90vw, 480px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#061a2e]/70 via-transparent to-[#061a2e]/10" />

              {/* Floating UI accents */}
              <div className="absolute left-4 top-6 hidden rounded-2xl border border-white/15 bg-[#061a2e]/70 p-3 shadow-lg backdrop-blur-md sm:block">
                <div className="mb-2 flex items-end gap-1">
                  {[40, 62, 48, 78, 55, 88].map((h, i) => (
                    <span
                      key={i}
                      className="w-2 rounded-sm bg-[#42a1ee]"
                      style={{ height: `${h * 0.35}px`, opacity: 0.55 + i * 0.07 }}
                    />
                  ))}
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                  Profit trend
                </p>
              </div>
            </div>

            <div className="absolute -left-2 bottom-16 rounded-full border border-white/15 bg-white px-4 py-2.5 shadow-xl sm:-left-6 sm:bottom-24">
              <p className="text-[13px] font-bold text-[#0c5290]">+61% profit path</p>
              <p className="text-[11px] font-medium text-slate-500">
                Five simple levers
              </p>
            </div>
            <div className="absolute -right-1 top-16 rounded-full border border-white/15 bg-[#10b981] px-4 py-2.5 shadow-xl sm:-right-4 sm:top-20">
              <p className="text-[13px] font-bold text-[#061a2e]">45+ years</p>
              <p className="text-[11px] font-medium text-[#061a2e]/70">
                Business experience
              </p>
            </div>
          </div>
        </div>

        <div className="relative border-t border-white/10">
          <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-6 px-5 py-7 sm:grid-cols-3 md:px-8">
            {heroPills.map(({ icon: Icon, label }, i) => (
              <div
                key={label}
                className="pam-rise flex items-center gap-3 text-white/80"
                style={{ animationDelay: `${220 + i * 80}ms` }}
              >
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-[#10b981]/15 text-[#10b981]">
                  <Icon className="size-5" strokeWidth={2} />
                </span>
                <span className="text-[15px] font-semibold tracking-tight">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── About ─── */}
      <section id="about" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-[1180px] px-5 py-16 md:px-8 md:py-24">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div>
              <h2 className="max-w-2xl text-balance text-[clamp(1.85rem,3.6vw,2.85rem)] font-bold leading-[1.12] tracking-[-0.03em] text-[#061a2e]">
                Your trusted partner in unlocking business potential
              </h2>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-slate-600">
                Pam Woodford has lived the journey — built, sold, and returned with a
                mission: guide owners from chaos to control with the Profit System,
                so business and life are fun again.
              </p>
              <ul className="mt-8 space-y-3.5">
                {aboutChecks.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#10b981]/15 text-[#059669]">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                    <span className="text-[15px] leading-snug text-slate-700">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-start lg:justify-end lg:pt-6">
              <Link
                href={LINK_DIAGNOSTIC}
                className="group inline-flex size-[72px] items-center justify-center rounded-full bg-[#10b981] text-[#061a2e] shadow-[0_12px_32px_-10px_rgba(16,185,129,0.5)] transition hover:scale-105"
                aria-label="Take the BOSS Diagnostic"
              >
                <Play className="size-6 fill-current transition group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          <div className="relative mt-12 aspect-[21/9] overflow-hidden rounded-[1.5rem] bg-[#e8f0f8] sm:mt-16 sm:aspect-[2.4/1]">
            <Image
              src={PAM_STAGE}
              alt="Pam Woodford delivering a Profit System session"
              fill
              className="object-cover object-[center_35%]"
              sizes="(max-width: 1180px) 100vw, 1180px"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#061a2e]/35 to-transparent" />
          </div>
        </div>
      </section>

      {/* ─── Services / System ─── */}
      <section id="system" className="scroll-mt-20 bg-[#f5f8fc]">
        <div className="mx-auto max-w-[1180px] px-5 py-16 md:px-8 md:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            <div className="relative min-h-[420px] overflow-hidden rounded-[1.5rem] bg-[#0c5290] lg:min-h-full">
              <Image
                src="/landing/v2/how-3.png"
                alt="Owners building a stronger business"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 45vw"
              />
              <div className="absolute inset-0 bg-[#061a2e]/25" />
            </div>

            <div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#0c5290]">
                    The Profit System
                  </p>
                  <h2 className="mt-3 max-w-md text-balance text-[clamp(1.75rem,3.2vw,2.5rem)] font-bold leading-[1.12] tracking-[-0.03em] text-[#061a2e]">
                    How we can help your business
                  </h2>
                </div>
                <Link
                  href={LINK_HOW}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#10b981] px-5 py-2.5 text-[13px] font-semibold text-[#061a2e] transition hover:brightness-110"
                >
                  View the system
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </div>

              <div className="mt-10 grid gap-5 sm:grid-cols-2">
                {services.map(({ title, body, icon: Icon }) => (
                  <article
                    key={title}
                    className="rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-[#0c5290]/25 hover:shadow-md"
                  >
                    <span className="inline-flex size-11 items-center justify-center rounded-xl bg-[#10b981]/12 text-[#059669]">
                      <Icon className="size-5" strokeWidth={2} />
                    </span>
                    <h3 className="mt-4 text-[17px] font-bold tracking-tight text-[#061a2e]">
                      {title}
                    </h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                      {body}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Results / Portfolio ─── */}
      <section id="results" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-[1180px] px-5 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#0c5290]">
              Inside the system
            </p>
            <h2 className="mt-3 text-balance text-[clamp(1.75rem,3.2vw,2.5rem)] font-bold leading-[1.12] tracking-[-0.03em] text-[#061a2e]">
              Tools that turn clarity into profit
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-slate-600">
              Diagnosis, playbooks, and 90-day execution — the same framework Pam
              uses with owners and trains coaches worldwide to deliver.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {projects.map((p) => (
              <article key={p.title} className="group">
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#eef3f8]">
                  <Image
                    src={p.image}
                    alt={p.title}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                <div className="mt-4">
                  <h3 className="text-[18px] font-bold tracking-tight text-[#061a2e]">
                    {p.title}
                  </h3>
                  <p className="mt-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#0c5290]">
                    {p.category}
                  </p>
                  <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                    {p.blurb}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Passion + Stats ─── */}
      <section className="bg-[#061a2e] text-white">
        <div className="mx-auto max-w-[1180px] px-5 py-16 md:px-8 md:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="relative aspect-square overflow-hidden rounded-[1.5rem] bg-[#0a2a45] sm:aspect-[5/4] lg:aspect-square">
              <Image
                src="/landing/v2/how-2.png"
                alt="Working the numbers"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#7ec8ff]">
                Passion
              </p>
              <h2 className="mt-3 text-balance text-[clamp(1.75rem,3.2vw,2.5rem)] font-bold leading-[1.12] tracking-[-0.03em]">
                Passion to increase company profit — and reclaim your life
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-white/65">
                Financial freedom and time freedom aren’t nice-to-haves. They’re the
                point. Pam’s coaching is straight-talking, practical, and built
                around the Profit System.
              </p>
              <ul className="mt-8 space-y-3.5">
                {passionPoints.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#10b981]/20 text-[#10b981]">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                    <span className="text-[15px] leading-snug text-white/85">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-8 border-t border-white/10 pt-12 lg:grid-cols-4 lg:gap-6">
            {stats.map((s) => (
              <div key={s.label} className="text-center lg:text-left">
                <p className="text-[clamp(2rem,4vw,2.75rem)] font-extrabold tracking-[-0.04em] text-[#10b981]">
                  {s.value}
                </p>
                <p className="mt-1 text-[14px] font-medium text-white/60">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section id="stories" className="scroll-mt-20 bg-[#04121f] text-white">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-16 md:px-8 md:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-16">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#7ec8ff]">
              Testimonials
            </p>
            <h2 className="mt-3 text-balance text-[clamp(1.75rem,3.2vw,2.5rem)] font-bold leading-[1.12] tracking-[-0.03em]">
              What our happy clients say
            </h2>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                aria-label="Previous testimonial"
                onClick={() =>
                  setStoryIndex(
                    (i) => (i - 1 + testimonials.length) % testimonials.length
                  )
                }
                className="inline-flex size-11 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-[#10b981] hover:text-[#10b981]"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Next testimonial"
                onClick={() =>
                  setStoryIndex((i) => (i + 1) % testimonials.length)
                }
                className="inline-flex size-11 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-[#10b981] hover:text-[#10b981]"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>

          <blockquote key={storyIndex} className="pam-rise">
            <p className="text-[clamp(1.2rem,2.4vw,1.65rem)] font-light italic leading-[1.45] text-white/90">
              “{story.quote}”
            </p>
            <footer className="mt-8">
              <p className="text-[16px] font-bold text-[#10b981]">{story.author}</p>
              <p className="mt-1 text-[14px] text-white/50">{story.role}</p>
              <div className="mt-3 flex gap-1 text-[#10b981]" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i}>★</span>
                ))}
              </div>
            </footer>
          </blockquote>
        </div>
      </section>

      {/* ─── How we work ─── */}
      <section id="method" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-[1180px] px-5 py-16 md:px-8 md:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="relative">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-[#e8f0f8] sm:aspect-[5/6]">
                <Image
                  src={PAM_STAGE}
                  alt="Pam Woodford coaching live"
                  fill
                  className="object-cover object-[center_30%]"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
              <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/60 bg-white/95 p-4 shadow-xl backdrop-blur sm:left-8 sm:right-auto sm:w-[240px]">
                <div className="flex -space-x-2">
                  {["#0c5290", "#42a1ee", "#1ca0c2", "#10b981"].map((c) => (
                    <span
                      key={c}
                      className="size-8 rounded-full border-2 border-white"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <p className="mt-3 text-[15px] font-bold text-[#061a2e]">
                  250+ coaches worldwide
                </p>
                <p className="text-[12px] text-slate-500">
                  Trained in the Profit System
                </p>
              </div>
            </div>

            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#0c5290]">
                How we work
              </p>
              <h2 className="mt-3 text-balance text-[clamp(1.75rem,3.2vw,2.5rem)] font-bold leading-[1.12] tracking-[-0.03em] text-[#061a2e]">
                Diagnose. Prioritise. Compound.
              </h2>
              <ol className="mt-10 space-y-8">
                {steps.map((step) => (
                  <li key={step.num} className="flex gap-5">
                    <span className="shrink-0 text-[28px] font-light leading-none tracking-tight text-slate-300">
                      {step.num}
                    </span>
                    <div>
                      <h3 className="text-[18px] font-bold text-[#061a2e]">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link
                href={LINK_DIAGNOSTIC}
                className="mt-10 inline-flex items-center gap-2 rounded-full bg-[#0c5290] px-6 py-3.5 text-[14px] font-semibold text-white shadow-[0_12px_40px_-12px_rgba(12,82,144,0.55)] transition hover:bg-[#094274]"
              >
                Take the free BOSS Diagnostic
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Blog ─── */}
      <section id="news" className="scroll-mt-20 bg-[#f5f8fc]">
        <div className="mx-auto max-w-[1180px] px-5 py-16 md:px-8 md:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#0c5290]">
                Insights
              </p>
              <h2 className="mt-3 text-balance text-[clamp(1.75rem,3.2vw,2.5rem)] font-bold leading-[1.12] tracking-[-0.03em] text-[#061a2e]">
                Latest from the Profit System
              </h2>
            </div>
            <Link
              href={LINK_BLOG}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#10b981] px-5 py-2.5 text-[13px] font-semibold text-[#061a2e] transition hover:brightness-110"
            >
              View all
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          <div className="mt-12 grid gap-7 md:grid-cols-3">
            {posts.map((post) => (
              <article
                key={post.href}
                className="flex flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div className="relative aspect-[16/10] bg-[#e8f0f8]">
                  <Image
                    src={post.image}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0c5290]">
                    {post.category}
                  </p>
                  <h3 className="mt-2 text-[17px] font-bold leading-snug tracking-tight text-[#061a2e]">
                    <Link href={post.href} className="hover:text-[#0c5290]">
                      {post.title}
                    </Link>
                  </h3>
                  <p className="mt-3 flex-1 text-[14px] leading-relaxed text-slate-600">
                    {post.excerpt}
                  </p>
                  <Link
                    href={post.href}
                    className="mt-5 inline-flex items-center gap-1 text-[13px] font-semibold text-[#0c5290] hover:underline"
                  >
                    Read more
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-[#061a2e] text-white">
        <div className="mx-auto max-w-[1180px] px-5 py-14 md:px-8">
          <div className="grid gap-8 border-b border-white/10 pb-10 sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[#10b981]/15 text-[#10b981]">
                <Phone className="size-4" />
              </span>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Book a session
                </p>
                <Link
                  href={LINK_BOOK}
                  className="mt-1 text-[15px] font-semibold text-white hover:text-[#10b981]"
                >
                  Free profit strategy call
                </Link>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[#10b981]/15 text-[#10b981]">
                <Mail className="size-4" />
              </span>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Start here
                </p>
                <Link
                  href={LINK_DIAGNOSTIC}
                  className="mt-1 text-[15px] font-semibold text-white hover:text-[#10b981]"
                >
                  Take the BOSS Diagnostic
                </Link>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[#10b981]/15 text-[#10b981]">
                <MapPin className="size-4" />
              </span>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Reach
                </p>
                <p className="mt-1 text-[15px] font-semibold text-white">
                  Coaching owners worldwide
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-8 py-10 lg:flex-row lg:items-center lg:justify-between">
            <Link href="/pam" className="inline-flex">
              <Image
                src={LOGO_WHITE}
                alt="The Profit Coach"
                width={160}
                height={40}
                className="h-9 w-auto opacity-90"
              />
            </Link>
            <nav className="flex flex-wrap gap-x-7 gap-y-3 text-[13px] font-medium text-white/60">
              {navLinks.map((l) => (
                <a key={l.href} href={l.href} className="hover:text-white">
                  {l.label}
                </a>
              ))}
              <Link href={LINK_HOW} className="hover:text-white">
                How it works
              </Link>
            </nav>
          </div>

          <div className="flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-white/40">
              © {new Date().getFullYear()} The Profit Coach · Pam Woodford
            </p>
            <div className="flex flex-wrap items-center gap-5 text-[13px] text-white/45">
              <Link href="/new-home" className="hover:text-white">
                Profit Coach home
              </Link>
              <Link href="/directory" className="hover:text-white">
                Find a coach
              </Link>
              <a
                href="#about"
                className="inline-flex size-9 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-[#10b981] hover:text-[#10b981]"
                aria-label="Back to top"
              >
                <ChevronLeft className="size-4 rotate-90" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
