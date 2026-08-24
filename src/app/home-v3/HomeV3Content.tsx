"use client";

import Image from "next/image";
import Link from "next/link";
import { Fraunces, Inter, Inter_Tight } from "next/font/google";
import {
  ArrowRight,
  ArrowUpRight,
  BatteryLow,
  CheckCircle2,
  Crown,
  Flame,
  ListChecks,
  Telescope,
  TrendingUp,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { NineStepRoadmap } from "@/components/profitSystem/NineStepRoadmap";
import {
  FOUNDATION,
  OWNER_LEVELS,
} from "@/components/profitSystem/profitSystemData";

/* ────────────────────────────────────────────────────────────────────────────
   Brand language: the dashboard sidebar gradient carried onto the marketing
   surface. Deep navy → brand blue → light sky.
──────────────────────────────────────────────────────────────────────────── */

const BRAND_GRADIENT =
  "linear-gradient(165deg, #051e36 0%, #0c5290 48%, #1a8fd4 100%)";
const CTA_GRADIENT = "linear-gradient(155deg, #0a6fa8 0%, #1aa3e0 100%)";

/** House level blues, light → deep (matches OwnerLevelsDiagram). */
const LEVEL_COLORS = ["#7cc0f4", "#42a1ee", "#1f7fd1", "#0c5290", "#1ca0c2"];
const LEVEL_ICONS = [Flame, BatteryLow, ListChecks, Telescope, Crown];

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-inter-tight",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

/** Serif accent for the pre-FAQ conversion card only. */
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-fraunces",
});

/* ── Links & assets ───────────────────────────────────────────────────────── */

const LINK_SCORE = "/score";
const LINK_HOW = "/how-it-works";
const LINK_COACHES = "/directory";
const LINK_BLOG = "/blog";
const LINK_PAM = "/pam";

/** PLACEHOLDER photography (Unsplash). Swap with brand shoots when Zander
 *  shares them; keep the same crops and overlay chips. */
const HERO_PHOTO =
  "https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=1400&auto=format&fit=crop";

/* ── Demo diagnostic data (sample, order matches bossData AREAS) ──────────── */

const DEMO_AREA_SCORES = [6.2, 5.4, 7.1, 4.9, 6.8, 5.6, 6.3, 6.9, 5.2, 6.5];
const DEMO_TOTAL = 62;

/** Pillar colour per area index (0 = Owner foundation). */
const AREA_WHEEL_COLORS = [
  "#47617c",
  "#0c5290",
  "#0c5290",
  "#0c5290",
  "#42a1ee",
  "#42a1ee",
  "#42a1ee",
  "#1ca0c2",
  "#1ca0c2",
  "#1ca0c2",
];

/* ── Copy ─────────────────────────────────────────────────────────────────── */

/** Symptom checklist: the owner's week, in their own words. */
const SYMPTOMS = [
  "You can't take a holiday without your laptop.",
  "Delegating feels risky, because nobody does it quite like you.",
  "The team waits for your answer before anything moves.",
  "Half the business lives in your head.",
  "You're not sure what revenue would do if you were out for a month.",
  "Work makes you feel guilty about home. Home makes you feel guilty about work.",
] as const;

const LEVEL_DETAILS = [
  {
    soundsLike: "I never switch off.",
    body: "Too many fires to fight. It's hard to run even the day-to-day, and there's no time to think, let alone plan.",
    wayUp: "Get the fires visible. Your score shows which ones actually matter, so the week stops running you.",
  },
  {
    soundsLike: "If I stop working, revenue stops.",
    body: "You have a team, but everything still runs through you. Delegating feels slower than doing it yourself, so you never stop.",
    wayUp: "Systemise and delegate the right things first. Your score shows which ones free the most time fastest.",
  },
  {
    soundsLike: "We have systems, but growth has stalled.",
    body: "Processes and training are in place, so things run without you for a while. The next jump needs strategy, numbers, and leaders.",
    wayUp: "Shift from running the machine to steering it: strategy, financial rhythm, and your first real leaders.",
  },
  {
    soundsLike: "I'm finally working on the business.",
    body: "You manage overall performance instead of daily output. The work now is building leaders and letting go of the rest.",
    wayUp: "Build the leadership layer and hand over the last few hats. The score keeps everyone honest.",
  },
  {
    soundsLike: "The business works without me.",
    body: "Leadership runs the operation. You steer the direction, and the business pays you back in profit and time.",
    wayUp: "Protect what you built. Quarterly re-scores catch slippage before it costs you.",
  },
] as const;

const STEPS = [
  {
    n: "1",
    title: "Get your BOSS Score",
    body: "Free, 10 minutes. Fifty questions across the 10 areas that drive profit. You see your level, your score out of 100, and where the business is leaking money and time.",
  },
  {
    n: "2",
    title: "Get your 90-day plan",
    body: "Your results become a plan: the three highest-impact fixes, in the right order, each with a playbook. You always know what to work on next.",
  },
  {
    n: "3",
    title: "Work with your coach",
    body: "A certified Profit Coach installs the fixes with you, keeps you accountable, and re-scores every quarter so you can watch profit and time come back.",
  },
] as const;

const FAQS = [
  {
    q: "What is the Profit System?",
    a: "The Profit System is the framework behind every certified Profit Coach. It maps a business across three pillars and nine steps, built on one foundation: the owner. Your BOSS Score shows where you sit on it today.",
  },
  {
    q: "What does the BOSS Score actually tell me?",
    a: "Your level (from Overwhelm to Owner), a score out of 100, and a picture of all ten areas of the business. You see your strongest areas, your weakest, and what fixing the gaps is worth in your own numbers.",
  },
  {
    q: "I've tried coaching before and it didn't stick.",
    a: "Most programmes hand every owner the same advice. Profit Coaching starts with your score, so your coach works on your specific gaps in the right order. When the work fits the business, it sticks. And the quarterly re-score shows you in black and white that it's working.",
  },
  {
    q: "I'm slammed. How much time does this take?",
    a: "The score takes 10 minutes. Coaching fits around running the business: one session at a time, working the priorities in order. And if you can fix the business in a busy season, the quiet seasons look after themselves.",
  },
  {
    q: "How much does coaching cost?",
    a: "The BOSS Score is free. Coaching engagements are scoped with your coach once you've both seen your results, so the plan and the investment fit your business. There's no obligation after the score.",
  },
  {
    q: "Is my business the right size for this?",
    a: "The Profit System is built for owner-led businesses doing £1M and up: trades, engineering, manufacturing, and services alike. If that's you, the score will be accurate and the playbooks will fit. Below £1M the free score can still show you where to start; the playbooks assume a team and real revenue.",
  },
  {
    q: "Do I have to work with a coach?",
    a: "No. Your score and your results are yours either way. Most owners do choose a coach, because seeing the gaps is the easy part. Closing them, in the right order, while running the business, is where a coach makes the difference.",
  },
] as const;

/* ── Utilities ────────────────────────────────────────────────────────────── */

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cx("pc-reveal", inView && "pc-reveal-in", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/* ── Building blocks ──────────────────────────────────────────────────────── */

function Heading({
  children,
  className,
  as: Tag = "h2",
}: {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <Tag
      className={cx(
        interTight.className,
        "text-balance font-semibold leading-[1.07] tracking-[-0.022em]",
        className
      )}
    >
      {children}
    </Tag>
  );
}

function PrimaryCta({
  className,
  onDark,
  label = "Get your BOSS Score",
}: {
  className?: string;
  onDark?: boolean;
  label?: string;
}) {
  return (
    <Link
      href={LINK_SCORE}
      className={cx(
        "group inline-flex items-center justify-center gap-2.5 rounded-full px-7 py-3.5 text-[15px] font-semibold transition duration-200 active:scale-[0.98]",
        onDark
          ? "bg-white text-[#0c5290] shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)] hover:bg-[#eaf5ff]"
          : "text-white shadow-[0_16px_34px_-14px_rgba(26,163,224,0.65)] hover:brightness-110",
        className
      )}
      style={onDark ? undefined : { background: CTA_GRADIENT }}
    >
      {label}
      <ArrowRight
        className="size-4 transition-transform duration-200 group-hover:translate-x-1"
        strokeWidth={2.5}
      />
    </Link>
  );
}

function SecondaryCta({
  className,
  onDark,
  href = LINK_HOW,
  label = "See how it works",
}: {
  className?: string;
  onDark?: boolean;
  href?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full border px-7 py-3.5 text-[15px] font-semibold transition-colors duration-200 active:scale-[0.98]",
        onDark
          ? "border-white/35 text-white hover:border-white hover:bg-white/10"
          : "border-[#c6d8e8] bg-white text-[#0c5290] hover:border-[#0c5290]/45 hover:bg-[#f2f8fd]",
        className
      )}
    >
      {label}
    </Link>
  );
}

/* ── Custom marketing wheel (clean replacement for the app BossWheel) ─────── */

function annularSector(
  cxp: number,
  cyp: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number
): string {
  const p = (r: number, a: number) => ({
    x: cxp + r * Math.cos(a),
    y: cyp + r * Math.sin(a),
  });
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const s0 = p(r1, a0);
  const s1 = p(r1, a1);
  const s2 = p(r0, a1);
  const s3 = p(r0, a0);
  return [
    `M ${s0.x} ${s0.y}`,
    `A ${r1} ${r1} 0 ${large} 1 ${s1.x} ${s1.y}`,
    `L ${s2.x} ${s2.y}`,
    `A ${r0} ${r0} 0 ${large} 0 ${s3.x} ${s3.y}`,
    "Z",
  ].join(" ");
}

function MarketingWheel({ className }: { className?: string }) {
  const C = 170;
  const R_INNER = 62;
  const R_MAX = 158;
  const n = DEMO_AREA_SCORES.length;
  const gap = 0.045; // radians of breathing room between segments

  return (
    <svg
      viewBox="0 0 340 340"
      className={className}
      role="img"
      aria-label={`Sample BOSS wheel, overall score ${DEMO_TOTAL} out of 100`}
    >
      {DEMO_AREA_SCORES.map((score, i) => {
        const a0 = -Math.PI / 2 + (i / n) * 2 * Math.PI + gap;
        const a1 = -Math.PI / 2 + ((i + 1) / n) * 2 * Math.PI - gap;
        const rValue = R_INNER + (R_MAX - R_INNER) * (score / 10);
        return (
          <g key={i}>
            <path
              d={annularSector(C, C, R_INNER, R_MAX, a0, a1)}
              fill="#eef4fa"
            />
            <path
              d={annularSector(C, C, R_INNER, rValue, a0, a1)}
              fill={AREA_WHEEL_COLORS[i]}
              opacity={0.92}
            />
          </g>
        );
      })}
      <circle cx={C} cy={C} r={R_INNER - 8} fill="#ffffff" />
      <circle
        cx={C}
        cy={C}
        r={R_INNER - 8}
        fill="none"
        stroke="#dbe7f2"
        strokeWidth={1}
      />
      <text
        x={C}
        y={C - 4}
        textAnchor="middle"
        fill="#0b1c2c"
        fontSize="44"
        fontWeight={700}
        style={{ fontFamily: "var(--font-inter-tight), sans-serif" }}
      >
        {DEMO_TOTAL}
      </text>
      <text
        x={C}
        y={C + 18}
        textAnchor="middle"
        fill="#7d92a5"
        fontSize="13"
        fontWeight={600}
      >
        out of 100
      </text>
      <text
        x={C}
        y={C + 36}
        textAnchor="middle"
        fill="#0c5290"
        fontSize="11"
        fontWeight={600}
      >
        Level 3 · Organised
      </text>
    </svg>
  );
}

/* ── Levels: tabbed explorer with staircase ───────────────────────────────── */

function LevelsExplorer() {
  const [active, setActive] = useState(1); // Level 2, where most owners sit

  const level = OWNER_LEVELS[active];
  const detail = LEVEL_DETAILS[active];
  const Icon = LEVEL_ICONS[active];
  const color = LEVEL_COLORS[active];

  return (
    <div>
      {/* Tab rail */}
      <div
        className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] sm:justify-center [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="The 5 levels of business owner"
      >
        {OWNER_LEVELS.map((l, i) => {
          const isActive = i === active;
          return (
            <button
              key={l.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(i)}
              className={cx(
                "flex shrink-0 items-center gap-2.5 rounded-full border px-5 py-2.5 text-[14px] font-semibold transition-all duration-200",
                isActive
                  ? "border-transparent text-white shadow-[0_14px_30px_-14px_rgba(26,163,224,0.7)]"
                  : "border-[#dbe7f2] bg-white text-[#46586a] hover:border-[#42a1ee]/60 hover:text-[#0c5290]"
              )}
              style={isActive ? { background: CTA_GRADIENT } : undefined}
            >
              <span
                className={cx(
                  interTight.className,
                  "text-[15px] font-bold",
                  isActive ? "text-white/80" : "text-[#9db2c4]"
                )}
              >
                {l.id}
              </span>
              {l.name}
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div className="mt-6 overflow-hidden rounded-[24px] border border-[#dbe7f2] bg-white shadow-[0_40px_80px_-55px_rgba(12,82,144,0.55)]">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <div className="p-8 sm:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="flex size-11 items-center justify-center rounded-full"
                style={{ backgroundColor: `${color}1c` }}
              >
                <Icon className="size-5" style={{ color }} />
              </span>
              <p
                className={cx(
                  interTight.className,
                  "text-[13px] font-bold uppercase tracking-[0.12em]"
                )}
                style={{ color }}
              >
                Level {level.id} of 5
              </p>
              {level.id === 2 ? (
                <span className="rounded-full bg-[#0c5290] px-3 py-1 text-[11px] font-semibold text-white">
                  Most owners are here
                </span>
              ) : null}
            </div>
            <h3
              className={cx(
                interTight.className,
                "mt-4 text-[clamp(1.7rem,3vw,2.3rem)] font-semibold tracking-[-0.015em] text-[#0b1c2c]"
              )}
            >
              {level.name}
            </h3>
            <p className="mt-4 text-[17px] font-medium italic leading-snug text-[#0c5290]">
              &ldquo;{detail.soundsLike}&rdquo;
            </p>
            <p className="mt-4 max-w-[52ch] text-[15px] leading-[1.75] text-[#46586a]">
              {detail.body}
            </p>
            <div className="mt-6 flex items-start gap-3 rounded-[14px] bg-[#f5f9fd] p-4">
              <TrendingUp className="mt-0.5 size-5 shrink-0 text-[#1a8fd4]" />
              <p className="text-[14px] leading-relaxed text-[#0b1c2c]">
                <span className="font-semibold">The way up:</span>{" "}
                {detail.wayUp}
              </p>
            </div>
          </div>

          {/* Staircase */}
          <div className="flex items-end justify-center gap-3 bg-[#f5f9fd] px-8 pb-0 pt-12 sm:gap-4 lg:px-12">
            {OWNER_LEVELS.map((l, i) => {
              const isActive = i === active;
              const height = 22 + i * 18;
              return (
                <button
                  key={l.id}
                  onClick={() => setActive(i)}
                  aria-label={`Level ${l.id}: ${l.name}`}
                  className="group flex h-64 w-[15%] max-w-16 flex-col items-center justify-end gap-2 sm:h-72"
                >
                  {isActive ? (
                    <span className="whitespace-nowrap rounded-full bg-[#0b1c2c] px-3 py-1 text-[11px] font-semibold text-white shadow-md">
                      You are here
                    </span>
                  ) : null}
                  <span
                    className="w-full rounded-t-[10px] transition-all duration-500"
                    style={{
                      height: `${height}%`,
                      background: isActive
                        ? CTA_GRADIENT
                        : "#d5e4f0",
                      boxShadow: isActive
                        ? "0 18px 36px -16px rgba(26,163,224,0.7)"
                        : undefined,
                    }}
                  />
                  <span
                    className={cx(
                      interTight.className,
                      "pb-4 text-[13px] font-bold",
                      isActive ? "text-[#0c5290]" : "text-[#9db2c4]"
                    )}
                  >
                    {l.id}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <PrimaryCta label="Find your level" />
        <p className="text-[13px] text-[#7d92a5]">Free · 10 minutes · No obligation</p>
      </div>
    </div>
  );
}

/* ── How it works: connected journey ──────────────────────────────────────── */

function StepVisual({ step }: { step: (typeof STEPS)[number] }) {
  if (step.n === "1") {
    return <MarketingWheel className="h-32 w-32" />;
  }
  if (step.n === "2") {
    return (
      <div className="w-56 rounded-[14px] border border-[#dbe7f2] bg-white p-4 shadow-[0_16px_36px_-24px_rgba(12,82,144,0.5)]">
        <p className={cx(interTight.className, "text-[12px] font-bold text-[#0b1c2c]")}>
          90-day plan
        </p>
        {[
          { label: "Fix the cash rhythm", color: "#e55a4d" },
          { label: "Install the scoreboard", color: "#e0a33c" },
          { label: "Delegate delivery", color: "#2fa876" },
        ].map((item, i) => (
          <div key={item.label} className="mt-2.5 flex items-center gap-2.5">
            <CheckCircle2 className="size-4 shrink-0" style={{ color: item.color }} />
            <span className="text-[12px] font-medium text-[#46586a]">
              {i + 1}. {item.label}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-4">
      <span className="relative block size-24 overflow-hidden rounded-full border-4 border-white shadow-[0_18px_36px_-16px_rgba(12,82,144,0.5)]">
        {/* Slight zoom crops the wordmark baked into the portrait */}
        <Image
          src="/pam/pam-portrait.jpg"
          alt="Pam Woodford, certified Profit Coach"
          fill
          sizes="96px"
          className="origin-top scale-[1.32] object-cover object-top"
        />
      </span>
      <div className="rounded-[14px] border border-[#dbe7f2] bg-white px-4 py-3 shadow-[0_16px_36px_-24px_rgba(12,82,144,0.5)]">
        <p className={cx(interTight.className, "text-[13px] font-bold text-[#0b1c2c]")}>
          Quarterly re-score
        </p>
        <p className="text-[12px] font-semibold text-[#2fa876]">62 → 74 out of 100</p>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export function HomeV3Content() {
  return (
    <div
      className={cx(
        inter.className,
        interTight.variable,
        inter.variable,
        "pc-root min-h-screen scroll-smooth bg-white text-[#0b1c2c] antialiased"
      )}
    >
      <style>{`
        .pc-reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.7s cubic-bezier(0.22,1,0.36,1), transform 0.7s cubic-bezier(0.22,1,0.36,1); }
        .pc-reveal-in { opacity: 1; transform: none; }
        @keyframes pc-hero-rise { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        .pc-hero-rise { animation: pc-hero-rise 0.75s cubic-bezier(0.22,1,0.36,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .pc-reveal, .pc-hero-rise { animation: none !important; transition: none !important; opacity: 1 !important; transform: none !important; }
        }
        .pc-root ::selection { background: #0c5290; color: #ffffff; }
        .pc-root :focus-visible { outline: 2px solid #1a8fd4; outline-offset: 2px; }
      `}</style>

      <MarketingNav variant="overlay" />

      <main>
        {/* ── Hero (brand gradient, photography-led) ── */}
        <section
          className="relative overflow-hidden text-white"
          style={{ background: BRAND_GRADIENT }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 70% 55% at 12% 0%, rgba(255,255,255,0.10), transparent 55%), radial-gradient(ellipse 60% 50% at 95% 100%, rgba(126,200,255,0.22), transparent 60%)",
            }}
            aria-hidden
          />
          <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-5 pb-16 pt-32 md:px-8 md:pt-36 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:pb-24">
            <div className="pc-hero-rise" style={{ animationDelay: "60ms" }}>
              <Heading
                as="h1"
                className="max-w-[13ch] text-[clamp(2.5rem,5.3vw,4.1rem)] text-white"
              >
                If you stop, the business stops.
              </Heading>
              <p className="mt-6 max-w-[50ch] text-[16.5px] leading-[1.7] text-white/75 sm:text-[17.5px]">
                Most owners at this size don&apos;t own a business. They own a
                job that owns them. The free BOSS Score shows you why, in 10
                minutes. A certified Profit Coach helps you fix it, in the
                right order.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <PrimaryCta onDark />
                <SecondaryCta onDark href={LINK_COACHES} label="Meet the coaches" />
              </div>
              <p className="mt-8 text-[13px] font-medium text-white/65">
                For owner-led businesses doing £1M+ &nbsp;·&nbsp; 45+ years
                coaching experience &nbsp;·&nbsp; 250+ coaches trained worldwide
              </p>
            </div>

            <div className="pc-hero-rise relative" style={{ animationDelay: "180ms" }}>
              <div className="relative overflow-hidden rounded-[24px] border border-white/20 shadow-[0_50px_100px_-45px_rgba(2,16,30,0.9)]">
                {/* PLACEHOLDER photo: swap with a brand shoot of a coach and owner working together */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={HERO_PHOTO}
                  alt="A Profit Coach working through the numbers with a business owner"
                  className="h-[340px] w-full object-cover sm:h-[440px]"
                />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(5,30,54,0) 55%, rgba(5,30,54,0.55) 100%)",
                  }}
                  aria-hidden
                />
              </div>

              {/* Floating proof chips */}
              <div className="absolute -left-3 bottom-6 rounded-[16px] bg-white px-5 py-3.5 shadow-[0_24px_50px_-20px_rgba(2,16,30,0.55)] sm:-left-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7d92a5]">
                  Profit trend
                </p>
                <p className={cx(interTight.className, "text-[20px] font-bold text-[#0b1c2c]")}>
                  +61%{" "}
                  <span className="text-[13px] font-semibold text-[#2fa876]">
                    profit path
                  </span>
                </p>
              </div>
              <div className="absolute -right-2 top-6 rounded-[16px] bg-white px-5 py-3.5 shadow-[0_24px_50px_-20px_rgba(2,16,30,0.55)] sm:-right-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7d92a5]">
                  BOSS Score
                </p>
                <p className={cx(interTight.className, "text-[20px] font-bold text-[#0b1c2c]")}>
                  62<span className="text-[13px] font-semibold text-[#7d92a5]">/100</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Sound familiar? ── */}
        <section className="bg-white py-20 md:py-28">
          <div className="mx-auto max-w-[720px] px-5 md:px-8">
            <Reveal className="text-center">
              <Heading className="text-[clamp(1.9rem,3.6vw,2.85rem)] text-[#0b1c2c]">
                Your business should run without you. Right now, it can&apos;t.
              </Heading>
            </Reveal>
            <div className="mt-10 space-y-3">
              {SYMPTOMS.map((symptom, i) => (
                <Reveal key={symptom} delay={Math.min(i * 70, 280)}>
                  <div className="flex items-start gap-3.5 rounded-[14px] border border-[#dbe7f2] bg-[#fbfdff] px-5 py-4">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#1a8fd4]" />
                    <p className="text-[15px] leading-relaxed text-[#0b1c2c]">
                      {symptom}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={220}>
              <p className="mt-9 text-center text-[16px] leading-[1.75] text-[#46586a] md:text-[17px]">
                Nobody designed it this way. The business just grew around you,
                so the more you put in, the more it needs you. The way out
                starts with seeing exactly where it depends on you.
              </p>
              <div className="mt-6 text-center">
                <Link
                  href={LINK_SCORE}
                  className="group inline-flex items-center gap-2 text-[15px] font-semibold text-[#0c5290] transition-colors hover:text-[#0b1c2c]"
                >
                  See where your business depends on you
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── The 5 Levels (tabbed explorer) ── */}
        <section id="levels" className="scroll-mt-20 bg-[#f5f9fd] py-20 md:py-28">
          <div className="mx-auto max-w-[1100px] px-5 md:px-8">
            <Reveal className="mx-auto max-w-[680px] text-center">
              <Heading className="text-[clamp(1.9rem,3.6vw,2.85rem)] text-[#0b1c2c]">
                Every owner is at one of five levels.
              </Heading>
              <p className="mt-6 text-[16px] leading-[1.75] text-[#46586a] md:text-[17px]">
                The level explains the symptoms: the hours, the firefighting,
                the cash stress. Click through and find yours. Once you know
                your level, you know exactly what work comes next.
              </p>
            </Reveal>
            <Reveal delay={120} className="mt-10">
              <LevelsExplorer />
            </Reveal>
          </div>
        </section>

        {/* ── The Profit System (nine-step roadmap) ── */}
        <section id="profit-system" className="scroll-mt-20 bg-white py-20 md:py-28">
          <div className="mx-auto max-w-[1200px] px-5 md:px-8">
            <Reveal className="mx-auto max-w-[680px] text-center">
              <Heading className="text-[clamp(1.9rem,3.6vw,2.85rem)] text-[#0b1c2c]">
                Nine steps from today&apos;s business to your ideal business.
              </Heading>
              <p className="mt-6 text-[16px] leading-[1.75] text-[#46586a] md:text-[17px]">
                You can&apos;t fix everything at once, so the Profit System puts
                it in order. Nine steps, each one moving work off you and onto
                systems and people. Fifty playbooks behind them, so you never
                start from scratch.
              </p>
            </Reveal>

            <Reveal delay={100} className="mt-12">
              <NineStepRoadmap />
            </Reveal>

            <Reveal delay={140}>
              <div
                className="mt-6 flex flex-col items-center gap-4 rounded-[18px] p-6 text-white sm:flex-row sm:justify-between"
                style={{ background: BRAND_GRADIENT }}
              >
                <div className="flex items-center gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/12">
                    <FOUNDATION.icon className="size-5 text-white" />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9fd4ff]">
                      The foundation under all nine steps
                    </p>
                    <p className={cx(interTight.className, "text-[18px] font-semibold")}>
                      {FOUNDATION.name}
                    </p>
                  </div>
                </div>
                <p className="max-w-[42ch] text-center text-[13.5px] leading-snug text-white/70 sm:text-right">
                  It starts with you. A stretched, exhausted owner caps
                  everything else, so the system scores the owner first.
                </p>
              </div>
            </Reveal>

            <Reveal delay={160} className="text-center">
              <Link
                href={LINK_HOW}
                className="group mt-9 inline-flex items-center gap-2 text-[14.5px] font-semibold text-[#0c5290] transition-colors hover:text-[#0b1c2c]"
              >
                Explore the full Profit System
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Reveal>
          </div>
        </section>

        {/* ── How it works: connected journey ── */}
        <section className="bg-[#f5f9fd] py-20 md:py-28">
          <div className="mx-auto max-w-[1200px] px-5 md:px-8">
            <Reveal className="mx-auto max-w-[680px] text-center">
              <Heading className="text-[clamp(1.9rem,3.6vw,2.85rem)] text-[#0b1c2c]">
                Score. Plan. Coach.
              </Heading>
              <p className="mt-6 text-[16px] leading-[1.75] text-[#46586a] md:text-[17px]">
                No lectures, no hype. A score, a plan, and a coach who keeps it
                moving. Here&apos;s the whole journey.
              </p>
            </Reveal>

            <div className="relative mt-14">
              {/* Connector line behind the step badges */}
              <div
                className="absolute left-[16%] right-[16%] top-6 hidden h-0.5 lg:block"
                style={{
                  background:
                    "linear-gradient(90deg, #7cc0f4 0%, #1a8fd4 50%, #1ca0c2 100%)",
                }}
                aria-hidden
              />
              <div className="grid gap-10 lg:grid-cols-3 lg:gap-6">
                {STEPS.map((step, i) => (
                  <Reveal key={step.n} delay={i * 130} className="h-full">
                    <div className="relative flex h-full flex-col items-center">
                      <span
                        className={cx(
                          interTight.className,
                          "relative z-10 flex size-12 items-center justify-center rounded-full text-[18px] font-bold text-white ring-8 ring-[#f5f9fd]"
                        )}
                        style={{ background: CTA_GRADIENT }}
                      >
                        {step.n}
                      </span>
                      <div className="mt-6 flex w-full flex-1 flex-col overflow-hidden rounded-[20px] border border-[#dbe7f2] bg-white shadow-[0_30px_60px_-45px_rgba(12,82,144,0.6)]">
                        <div className="flex h-44 items-center justify-center border-b border-[#eef4fa] bg-[#fbfdff] px-6">
                          <StepVisual step={step} />
                        </div>
                        <div className="flex flex-1 flex-col p-7 text-center">
                          <h3
                            className={cx(
                              interTight.className,
                              "text-[21px] font-semibold tracking-[-0.01em] text-[#0b1c2c]"
                            )}
                          >
                            {step.title}
                          </h3>
                          <p className="mt-3 text-[14.5px] leading-[1.7] text-[#46586a]">
                            {step.body}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>

            <Reveal delay={120} className="mt-12 text-center">
              <PrimaryCta />
            </Reveal>
          </div>
        </section>

        {/* ── The BOSS Score (custom wheel) ── */}
        <section className="bg-white py-20 md:py-28">
          <div className="mx-auto max-w-[1200px] px-5 md:px-8">
            <div className="grid gap-12 lg:grid-cols-[0.96fr_1.04fr] lg:items-center lg:gap-16">
              <Reveal>
                <div className="relative mx-auto max-w-[420px]">
                  <div className="rounded-[28px] border border-[#dbe7f2] bg-white p-8 shadow-[0_44px_90px_-55px_rgba(12,82,144,0.6)]">
                    <MarketingWheel className="h-auto w-full" />
                  </div>
                  <div className="absolute -right-3 top-10 rounded-[14px] bg-white px-4 py-3 shadow-[0_20px_44px_-20px_rgba(12,82,144,0.5)] sm:-right-6">
                    <p className="flex items-center gap-2 text-[12px] font-semibold text-[#0b1c2c]">
                      <span className="size-2 rounded-full bg-[#e55a4d]" aria-hidden />
                      Fix first: Planning 4.9
                    </p>
                  </div>
                  <div className="absolute -left-3 bottom-12 rounded-[14px] bg-white px-4 py-3 shadow-[0_20px_44px_-20px_rgba(12,82,144,0.5)] sm:-left-6">
                    <p className="flex items-center gap-2 text-[12px] font-semibold text-[#0b1c2c]">
                      <span className="size-2 rounded-full bg-[#2fa876]" aria-hidden />
                      Strong: Strategy 7.1
                    </p>
                  </div>
                </div>
              </Reveal>
              <Reveal delay={130}>
                <Heading className="max-w-[16ch] text-[clamp(1.9rem,3.6vw,2.85rem)] text-[#0b1c2c]">
                  Coaching that starts from your data.
                </Heading>
                <p className="mt-6 max-w-[52ch] text-[16px] leading-[1.75] text-[#46586a] md:text-[17px]">
                  Fifty questions, ten areas, one score out of 100. The wheel
                  shows the shape of your business at a glance, so you and your
                  coach always know exactly where to focus. Retake it each
                  quarter and watch it fill out.
                </p>
                <div className="mt-8 rounded-[16px] border border-[#dbe7f2] bg-[#f5f9fd] p-6">
                  <p className="text-[15px] leading-relaxed text-[#0b1c2c]">
                    <span className="font-semibold">The maths matters too.</span>{" "}
                    Improve five funnel numbers by 10% each and revenue grows
                    61%. For a £2M business, that&apos;s £1.2M a year. Your
                    results page runs this with your numbers.
                  </p>
                </div>
                <PrimaryCta className="mt-8" />
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── The people behind it ── */}
        <section className="bg-[#f5f9fd] py-20 md:py-28">
          <div className="mx-auto max-w-[1200px] px-5 md:px-8">
            <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
              <Reveal>
                <Heading className="max-w-[16ch] text-[clamp(1.9rem,3.6vw,2.85rem)] text-[#0b1c2c]">
                  A framework is only as good as the coach beside you.
                </Heading>
                <p className="mt-6 max-w-[54ch] text-[16px] leading-[1.75] text-[#46586a] md:text-[17px]">
                  Every certified Profit Coach is trained in the full Profit
                  System and works from your score, your numbers, and your
                  priorities. We&apos;ve trained more than 250 coaches
                  worldwide, led by people who have built, sold, and turned
                  around real businesses.
                </p>
                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <PrimaryCta label="Find your coach" />
                  <SecondaryCta href={LINK_PAM} label="Book with Pam" />
                </div>
              </Reveal>

              <div className="grid gap-4">
                <Reveal delay={80}>
                  <Link
                    href={LINK_PAM}
                    className="group flex items-center gap-5 rounded-[18px] border border-[#dbe7f2] bg-white p-4 transition-colors hover:border-[#42a1ee]/60 sm:p-5"
                  >
                    <span className="relative block size-24 shrink-0 overflow-hidden rounded-full bg-[#eaf2f9] sm:size-28">
                      {/* Slight zoom crops the wordmark baked into the portrait */}
                      <Image
                        src="/pam/pam-portrait.jpg"
                        alt="Pam Woodford"
                        fill
                        sizes="112px"
                        className="origin-top scale-[1.32] object-cover object-top"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0c5290]">
                        Lead BOSS Facilitator
                      </span>
                      <span
                        className={cx(
                          interTight.className,
                          "mt-1 block text-[21px] font-semibold tracking-[-0.01em] text-[#0b1c2c]"
                        )}
                      >
                        Pam Woodford
                      </span>
                      <span className="mt-1 block text-[13.5px] leading-snug text-[#46586a]">
                        45+ years building, selling, and coaching businesses.
                      </span>
                    </span>
                    <ArrowUpRight className="ml-auto size-5 shrink-0 text-[#9db2c4] transition-colors group-hover:text-[#0c5290]" />
                  </Link>
                </Reveal>
                <Reveal delay={160}>
                  <div className="relative overflow-hidden rounded-[18px] border border-[#dbe7f2]">
                    <Image
                      src="/pam/pam-bca.png"
                      alt="Pam Woodford coaching business owners live on stage"
                      width={1024}
                      height={410}
                      className="h-56 w-full object-cover sm:h-64"
                    />
                    <span className="absolute bottom-3 left-3 rounded-full bg-[#051e36]/80 px-3.5 py-1.5 text-[11.5px] font-semibold text-white backdrop-blur">
                      250+ coaches trained worldwide
                    </span>
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* ── Resources ── */}
        <section className="bg-white py-20 md:py-24">
          <div className="mx-auto max-w-[1200px] px-5 md:px-8">
            <Reveal className="mx-auto max-w-[680px] text-center">
              <Heading className="text-[clamp(1.7rem,3vw,2.35rem)] text-[#0b1c2c]">
                Free tools for owners
              </Heading>
            </Reveal>
            <div className="mt-10 grid gap-4 md:grid-cols-2 md:gap-5">
              <Reveal delay={80} className="h-full">
                <Link
                  href={LINK_BLOG}
                  className="group flex h-full flex-col rounded-[18px] border border-[#dbe7f2] bg-white p-7 transition-colors hover:border-[#42a1ee]/60"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0c5290]">
                    The blog
                  </p>
                  <h3
                    className={cx(
                      interTight.className,
                      "mt-3 text-[21px] font-semibold tracking-[-0.01em] text-[#0b1c2c]"
                    )}
                  >
                    Latest from the Profit System
                  </h3>
                  <p className="mt-3 text-[14.5px] leading-[1.7] text-[#46586a]">
                    Owner-level thinking on profit, time, and teams. Including
                    the piece everyone shares: the 5 levels of business owner,
                    and why most get stuck at level 2.
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-[14px] font-semibold text-[#0c5290]">
                    Read the blog
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </Reveal>
              <Reveal delay={160} className="h-full">
                <div className="flex h-full flex-col rounded-[18px] border border-dashed border-[#b9cddd] bg-[#f5f9fd] p-7">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7d92a5]">
                    Free guide · Coming soon
                  </p>
                  <h3
                    className={cx(
                      interTight.className,
                      "mt-3 text-[21px] font-semibold tracking-[-0.01em] text-[#0b1c2c]"
                    )}
                  >
                    The Predictable Profit Blueprint
                  </h3>
                  <p className="mt-3 text-[14.5px] leading-[1.7] text-[#46586a]">
                    The three phases owners work through to make profit
                    predictable. Until it lands, the BOSS Score is the fastest
                    way to see where you stand.
                  </p>
                  <span className="mt-5 text-[13px] font-medium text-[#7d92a5]">
                    Opt-in opens shortly
                  </span>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── The next step (conversion card floating over a dark band) ── */}
        <section className="relative mt-6 md:mt-10">
          <div
            className="absolute inset-x-0 top-0 h-[54%]"
            style={{
              background:
                "linear-gradient(180deg, #051e36 0%, #0a3a63 70%, #0c4a82 100%)",
            }}
            aria-hidden
          />
          <div className="relative mx-auto max-w-[1080px] px-5 pb-6 pt-16 md:px-8 md:pt-24">
            <Reveal>
              <div className="grid overflow-hidden rounded-[22px] shadow-[0_70px_130px_-55px_rgba(2,16,30,0.85)] md:grid-cols-2">
                {/* Left: the ask */}
                <div
                  className="relative p-9 sm:p-12"
                  style={{
                    background:
                      "radial-gradient(ellipse 90% 70% at 0% 0%, rgba(66,161,238,0.14), transparent 55%), linear-gradient(160deg, #0b3257 0%, #051e36 100%)",
                  }}
                >
                  <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9fd4ff]">
                    <span className="h-px w-6 bg-[#9fd4ff]/50" aria-hidden />
                    The next step
                    <span className="h-px w-6 bg-[#9fd4ff]/50" aria-hidden />
                  </p>
                  <h2
                    className={cx(
                      fraunces.className,
                      "mt-6 text-balance text-[clamp(1.9rem,3.4vw,2.7rem)] font-medium leading-[1.15] text-white"
                    )}
                  >
                    Ready to find the profit{" "}
                    <em className="font-medium italic text-[#7ec8ff]">
                      your business is hiding?
                    </em>
                  </h2>
                  <p className="mt-6 max-w-[42ch] text-[15px] leading-[1.75] text-white/70">
                    Start with the free BOSS Score. Ten minutes, and you&apos;ll
                    see your level, your gaps, and what fixing them is worth.
                    Then decide what happens next.
                  </p>
                  <Link
                    href={LINK_SCORE}
                    className="group mt-8 inline-flex items-center gap-2.5 rounded-full bg-[#10b981] px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_18px_40px_-16px_rgba(16,185,129,0.65)] transition hover:brightness-110 active:scale-[0.98]"
                  >
                    Get your free BOSS Score
                    <ArrowRight
                      className="size-4 transition-transform duration-200 group-hover:translate-x-1"
                      strokeWidth={2.5}
                    />
                  </Link>
                </div>

                {/* Right: client story over photography */}
                <div className="relative min-h-[340px] sm:min-h-[400px]">
                  <Image
                    src="/pam/pam-bca.png"
                    alt="Pam Woodford coaching business owners live on stage"
                    fill
                    sizes="(min-width: 768px) 540px, 100vw"
                    className="object-cover object-[50%_42%]"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(5,30,54,0.5) 0%, rgba(5,30,54,0.3) 38%, rgba(5,30,54,0.93) 100%)",
                    }}
                    aria-hidden
                  />
                  <span className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-[#051e36]/70 px-3.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur">
                    <span className="size-1.5 rounded-full bg-[#10b981]" aria-hidden />
                    Client story
                  </span>
                  <figure className="absolute inset-x-0 bottom-0 p-7 sm:p-9">
                    <blockquote
                      className={cx(
                        interTight.className,
                        "text-[17px] font-medium leading-[1.5] tracking-[-0.01em] text-white sm:text-[19px]"
                      )}
                    >
                      &ldquo;The sessions we&apos;ve had fundamentally changed
                      the way I do business. I can point to{" "}
                      <strong className="font-bold">
                        huge amounts of profit
                      </strong>{" "}
                      in my companies that Pam and only Pam recognised.&rdquo;
                    </blockquote>
                    <figcaption className="mt-4">
                      <p className="text-[14px] font-semibold text-white">
                        John Davy
                      </p>
                      <p className="text-[12.5px] text-white/60">
                        Entrepreneur &amp; business owner
                      </p>
                    </figcaption>
                  </figure>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="bg-white py-20 md:py-28">
          <div className="mx-auto max-w-[760px] px-5 md:px-8">
            <Reveal className="text-center">
              <Heading className="text-[clamp(1.9rem,3.4vw,2.7rem)] text-[#0b1c2c]">
                Common questions
              </Heading>
            </Reveal>
            <Reveal delay={80}>
              <div className="mt-10 space-y-3">
                {FAQS.map((faq) => (
                  <details
                    key={faq.q}
                    className="group rounded-[16px] border border-[#dbe7f2] bg-[#f5f9fd] px-5 py-4 open:bg-white open:shadow-[0_14px_34px_-24px_rgba(12,82,144,0.4)]"
                  >
                    <summary className="cursor-pointer list-none text-[15px] font-semibold text-[#0b1c2c] [&::-webkit-details-marker]:hidden">
                      <span className="flex items-start justify-between gap-4">
                        {faq.q}
                        <span
                          className="mt-0.5 font-semibold text-[#0c5290] transition-transform group-open:rotate-45"
                          aria-hidden
                        >
                          +
                        </span>
                      </span>
                    </summary>
                    <p className="mt-4 text-[14.5px] leading-[1.75] text-[#46586a]">
                      {faq.a}
                    </p>
                  </details>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Final CTA (brand gradient) ── */}
        <section
          className="relative overflow-hidden py-24 text-white md:py-32"
          style={{ background: BRAND_GRADIENT }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 55% at 50% 0%, rgba(255,255,255,0.10), transparent 60%), radial-gradient(ellipse 55% 45% at 85% 100%, rgba(126,200,255,0.20), transparent 60%)",
            }}
            aria-hidden
          />
          <div className="relative mx-auto max-w-[820px] px-5 text-center md:px-8">
            <Reveal>
              <Heading className="text-[clamp(2.1rem,4.4vw,3.4rem)] text-white">
                Your next level starts with a score.
              </Heading>
              <p className="mx-auto mt-6 max-w-[52ch] text-[16px] leading-[1.75] text-white/75 md:text-[17px]">
                Take the free BOSS Score. See your level, your gaps, and what
                fixing them is worth. Bottlenecks compound, and they never pick
                a quiet season. The best day to see yours is today.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <PrimaryCta onDark />
                <SecondaryCta onDark href={LINK_COACHES} label="Speak to a coach" />
              </div>
              <p className="mt-7 text-[13px] font-medium text-white/60">
                Free · 10 minutes · 50 questions
              </p>
            </Reveal>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
