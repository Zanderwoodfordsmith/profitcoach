"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  LineChart,
  Menu,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { useState } from "react";
import { BossWheel } from "@/components/BossCharts/BossWheel";
import { ProfitSystemTriadDiagram } from "@/components/marketing/ProfitSystemTriadDiagram";
import { AREAS, LEVELS } from "@/lib/bossData";

const LINK_DIAGNOSTIC = "/assessment";
const LINK_COACH = "/directory";
const LINK_HOME = "/new-home";

const DEMO_AREA_SCORES = [6.2, 5.4, 7.1, 4.9, 6.8, 5.6, 6.3, 6.9, 5.2, 6.5];
const DEMO_TOTAL = 62;

const LEVEL_COPY: Record<string, string> = {
  Overwhelm:
    "Not knowing what to do next. Too many fires — it’s hard to run even day-to-day operations.",
  Overworked:
    "Exhausted from micromanaging because the team isn’t yet trained or systemised.",
  Organised:
    "Processes and training are in place so things can run without you — at least for a while.",
  Overseer:
    "You’re managing overall performance and working on the business, not only in it.",
  Owner:
    "Leadership runs the operation; you steer with minimal day-to-day involvement.",
};

const stages = [
  {
    kicker: "Stage one",
    title: "See the truth",
    body: "Start with the free BOSS Diagnostic — ten areas, five performance levels, and a clear picture of where the business really stands. No guesswork: your coach works from the same score you see.",
  },
  {
    kicker: "Stage two",
    title: "Install the priorities",
    body: "Your Profit Coach turns the diagnostic into a 90-day plan using the right playbooks from the Profit System. You fix what matters most first — margin, revenue rhythm, team, systems — in the right order.",
  },
  {
    kicker: "Stage three",
    title: "Measure and compound",
    body: "Every 90 days you revisit the score, adjust the plan, and lock in what’s working. The goal isn’t a one-off sprint — it’s a business that keeps getting stronger after you leave the room.",
  },
];

const nineByPillar = {
  vision: AREAS.filter((a) => a.pillar === "vision"),
  velocity: AREAS.filter((a) => a.pillar === "velocity"),
  value: AREAS.filter((a) => a.pillar === "value"),
};

function cx(...p: (string | false | undefined)[]) {
  return p.filter(Boolean).join(" ");
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
        background: "linear-gradient(135deg, #0c5290 0%, #063056 100%)",
        boxShadow: "0 12px 40px -12px #0c529088",
      }}
    >
      Take the BOSS Diagnostic
      <ArrowRight className="h-4 w-4 opacity-90" strokeWidth={2} />
    </Link>
  );
}

function SecondaryCta({
  className,
  inverted,
}: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <Link
      href={LINK_COACH}
      className={cx(
        "inline-flex items-center justify-center rounded-full border px-7 py-3.5 text-[0.9375rem] font-semibold transition duration-300 active:scale-[0.98]",
        inverted
          ? "border-white/30 bg-white/10 text-white backdrop-blur-md hover:bg-white/15"
          : "border-slate-200/90 bg-white/60 text-[#0c5290] backdrop-blur-md hover:bg-white/90",
        className
      )}
    >
      Speak to a Coach
    </Link>
  );
}

export function HowItWorksContent() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen scroll-smooth bg-[#f5f8fc] font-sans text-slate-800 antialiased">
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute -left-[18%] top-0 h-[min(72vh,640px)] w-[min(72vw,640px)] rounded-full opacity-[0.12] blur-3xl"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, #42a1ee, transparent 65%)",
          }}
        />
        <div
          className="absolute -right-[12%] top-[18%] h-[min(64vh,520px)] w-[min(64vw,520px)] rounded-full opacity-[0.1] blur-3xl"
          style={{
            background:
              "radial-gradient(circle at 70% 40%, #0d9488, transparent 60%)",
          }}
        />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/40 bg-[#f5f8fc]/78 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <Link
            href={LINK_HOME}
            className="text-lg font-semibold tracking-tight text-[#0c5290] md:text-xl"
          >
            The Profit Coach
          </Link>
          <nav className="hidden items-center gap-7 text-[0.8125rem] font-medium text-slate-600 lg:flex">
            <Link href={`${LINK_HOME}#profit-system`} className="hover:text-[#0c5290]">
              The Profit System
            </Link>
            <span className="text-[#0c5290]">How It Works</span>
            <Link href="/blog" className="hover:text-[#0c5290]">
              Blog
            </Link>
            <Link href={LINK_COACH} className="hover:text-[#0c5290]">
              Find a Coach
            </Link>
            <Link href={`${LINK_HOME}#resources`} className="hover:text-[#0c5290]">
              Resources
            </Link>
          </nav>
          <div className="hidden lg:block">
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
              <Link href={LINK_HOME} onClick={() => setMobileOpen(false)}>
                Home
              </Link>
              <Link href={LINK_COACH} onClick={() => setMobileOpen(false)}>
                Find a Coach
              </Link>
              <Link href="/blog" onClick={() => setMobileOpen(false)}>
                Blog
              </Link>
              <PrimaryCta className="mt-2 w-full" />
              <SecondaryCta className="w-full" />
            </nav>
          </div>
        ) : null}
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pb-14 pt-12 md:px-8 md:pb-20 md:pt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0c5290]/90 md:text-sm">
            How it works
          </p>
          <h1 className="mt-4 max-w-4xl text-[2.25rem] font-light leading-[1.08] tracking-[-0.035em] text-slate-900 md:text-5xl lg:text-[3.35rem]">
            A complete system to transform your business —{" "}
            <span className="text-[#0c5290]">one priority at a time.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 md:text-xl">
            The Profit System connects diagnosis, playbooks, and coaching into a single
            methodology. You always know what to fix first, why it matters, and how to
            make it stick — with a certified Profit Coach at your side.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <PrimaryCta />
            <SecondaryCta />
          </div>
        </section>

        {/* Stages — EMyth-style three chapters */}
        <section className="border-y border-white/60 bg-white/45 py-16 backdrop-blur-sm md:py-20">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <h2 className="max-w-2xl text-3xl font-light tracking-[-0.03em] text-slate-900 md:text-4xl">
              Here for you and your business — every step of the way.
            </h2>
            <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
              {stages.map((s) => (
                <article
                  key={s.title}
                  className="rounded-3xl border border-slate-200/50 bg-white/65 p-8 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.1)] backdrop-blur-xl"
                >
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[#0c5290]">
                    {s.kicker}
                  </p>
                  <h3 className="mt-3 text-xl font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600 md:text-[0.9375rem]">
                    {s.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Interactive triad + nine modules */}
        <section
          id="methodology"
          className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24"
        >
          <div className="max-w-2xl">
            <h2 className="text-3xl font-light tracking-[-0.03em] text-slate-900 md:text-4xl">
              Three pillars. Nine modules. One connected system.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 md:text-lg">
              Think of it like a compass for the business:{" "}
              <strong className="font-semibold text-slate-800">Vision</strong>{" "}
              clarifies direction, <strong className="font-semibold text-slate-800">Velocity</strong>{" "}
              drives profit and growth, and{" "}
              <strong className="font-semibold text-slate-800">Value</strong> builds
              the infrastructure and team that make it last. Tap a module to see how it
              fits.
            </p>
          </div>
          <div className="mt-12 lg:grid lg:grid-cols-[1fr_min(280px,32vw)] lg:items-start lg:gap-12">
            <ProfitSystemTriadDiagram />
            <figure className="mt-10 overflow-hidden rounded-3xl border border-slate-200/50 bg-white/50 p-4 backdrop-blur-xl lg:mt-0">
              <Image
                src="/how-it-works/three-pillars.png"
                alt="Diagram: Vision, Value, and Velocity as three connected pillars"
                width={520}
                height={520}
                className="h-auto w-full rounded-2xl object-contain"
              />
              <figcaption className="mt-3 text-center text-xs text-slate-500">
                Three-pillar model
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Nine-step roadmap image */}
        <section className="border-t border-slate-200/50 bg-white/35 py-14 backdrop-blur-sm md:py-16">
          <div className="mx-auto max-w-5xl px-5 md:px-8">
            <h2 className="text-center text-2xl font-light text-slate-900 md:text-3xl">
              The journey across nine business modules
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-600 md:text-base">
              Vision, then Velocity, then Value — the same sequence your coach uses to
              prioritise work so the business builds momentum in the right order.
            </p>
            <div className="mt-10 overflow-hidden rounded-[1.75rem] border border-slate-200/55 bg-white/60 p-4 shadow-inner backdrop-blur-xl md:p-6">
              <Image
                src="/how-it-works/nine-step-roadmap.png"
                alt="Nine-step Profit System roadmap: Vision, Velocity, and Value phases with connected steps"
                width={1200}
                height={680}
                className="h-auto w-full rounded-xl object-contain"
                priority
              />
            </div>
          </div>
        </section>

        {/* Five owner levels */}
        <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
          <h2 className="max-w-2xl text-3xl font-light tracking-[-0.03em] text-slate-900 md:text-4xl">
            Five levels of business ownership
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
            Every owner sits somewhere on this ladder. The BOSS Diagnostic places you on
            it — area by area — so improvement isn’t abstract.
          </p>
          <div className="mt-10 overflow-hidden rounded-[1.75rem] border border-slate-200/55 bg-white/60 p-4 backdrop-blur-xl md:p-6">
            <Image
              src="/how-it-works/five-levels.png"
              alt="Five levels from Overwhelm to Owner with descriptions and bar chart"
              width={1200}
              height={640}
              className="h-auto w-full rounded-xl object-contain"
            />
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...LEVELS].reverse().map((lvl) => (
              <div
                key={lvl.id}
                className="rounded-2xl border border-slate-200/45 bg-white/55 px-5 py-4 backdrop-blur-sm"
              >
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#0c5290]">
                  Level {lvl.id} · {lvl.name}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {LEVEL_COPY[lvl.name] ?? ""}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Owner pyramid graphic */}
        <section className="border-y border-slate-200/50 bg-white/40 py-14 md:py-16">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-2 md:items-center md:gap-14 md:px-8">
            <div>
              <h2 className="text-2xl font-light text-slate-900 md:text-3xl">
                Owner stage and business depth — together
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600 md:text-base">
                As you climb from Overworked toward Owner, the work in each of the ten
                areas deepens. Your coach matches playbooks to your stage so you’re not
                running advanced tools before the foundations hold.
              </p>
            </div>
            <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/55 bg-white/60 p-4 backdrop-blur-xl">
              <Image
                src="/how-it-works/owner-pyramid.png"
                alt="Pyramid of business areas mapped to owner performance levels"
                width={720}
                height={560}
                className="h-auto w-full rounded-xl object-contain"
              />
            </div>
          </div>
        </section>

        {/* Nine “essential systems” grid — EMyth parallel */}
        <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
          <h2 className="max-w-3xl text-3xl font-light tracking-[-0.03em] text-slate-900 md:text-4xl">
            Nine interconnected areas — so the company works as a whole.
          </h2>
          <p className="mt-4 max-w-2xl text-base text-slate-600 md:text-lg">
            Like the essential systems in a mature business, each area affects the
            others. The Profit System is built to connect them — not optimise one in
            isolation.
          </p>

          <div className="mt-10 rounded-2xl border border-slate-200/50 bg-[#0c5290]/[0.06] p-6 backdrop-blur-sm md:p-8">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[#0c5290]">
              Foundation
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">Owner Performance</h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 md:text-[0.9375rem]">
              The tenth area in the BOSS model — how you think, decide, and show up as the
              owner. It sits at the centre of the diagnostic because nothing else sustains if
              this foundation is ignored.
            </p>
          </div>

          {(
            [
              ["vision", "Vision", nineByPillar.vision],
              ["velocity", "Velocity", nineByPillar.velocity],
              ["value", "Value", nineByPillar.value],
            ] as const
          ).map(([key, title, areas]) => (
            <div key={key} className="mt-12">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[#0c5290]">
                {title}
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {areas.map((a) => (
                  <article
                    key={a.id}
                    className="rounded-2xl border border-slate-200/45 bg-white/55 p-6 backdrop-blur-sm"
                  >
                    <h3 className="font-semibold text-slate-900">{a.name}</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Part of the BOSS map — scored in your diagnostic and supported by
                      focused playbooks with your coach.
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* BOSS wheel preview */}
        <section className="bg-[#071525] py-16 text-white md:py-20">
          <div
            className="mx-auto max-w-6xl px-5 md:px-8"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 70% 50% at 50% -30%, rgba(12,82,144,0.45), transparent)",
            }}
          >
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="text-3xl font-light md:text-4xl">
                  Your BOSS wheel — the shape of the business at a glance
                </h2>
                <p className="mt-5 text-base leading-relaxed text-white/75 md:text-lg">
                  After the diagnostic you see every area on one visual — strengths,
                  gaps, and the unevenness that quietly costs profit. Your coach uses the
                  same view in sessions so conversations stay grounded in your data.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-white/80">
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
                    Ten areas, five levels, fifty playbooks — one language across the
                    engagement.
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
                    Retake the diagnostic to prove what moved — no vanity metrics.
                  </li>
                </ul>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={LINK_DIAGNOSTIC}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-[0.9375rem] font-semibold text-[#0c5290] shadow-lg shadow-black/20 transition hover:bg-white/90"
                  >
                    Take the BOSS Diagnostic
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </Link>
                  <SecondaryCta inverted />
                </div>
              </div>
              <div
                className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl md:p-10 [&_.text-slate-500]:!text-white/85"
              >
                <div className="[&>div]:justify-center">
                  <BossWheel
                    areaScores={DEMO_AREA_SCORES}
                    totalScore={DEMO_TOTAL}
                    showLegend={false}
                    aria-label="Sample BOSS wheel across ten business areas"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Outcomes — inspired by EMyth stats strip, without hard claims */}
        <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
          <h2 className="text-center text-2xl font-light text-slate-900 md:text-3xl">
            What owners tell us they want from coaching
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-600">
            Every business is different — but the themes repeat. The Profit System is
            built around outcomes like these.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                Icon: Target,
                title: "A clearer top three",
                body: "Less noise, more focus — you know what to fix first and what to ignore for now.",
              },
              {
                Icon: LineChart,
                title: "Numbers that drive decisions",
                body: "Margin, cash, pipeline, and KPIs tied to actions — not gut feel alone.",
              },
              {
                Icon: Sparkles,
                title: "A business that runs cleaner",
                body: "Systems, roles, and accountability so you’re not the bottleneck forever.",
              },
            ].map(({ Icon, title, body }) => (
              <div
                key={title}
                className="rounded-3xl border border-slate-200/50 bg-white/60 px-8 py-10 text-center backdrop-blur-xl"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0c5290]/10 text-[#0c5290]">
                  <Icon className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <h3 className="mt-5 font-semibold text-slate-900">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Coach band */}
        <section className="border-t border-slate-200/60 bg-gradient-to-b from-white/50 to-[#f5f8fc] py-16 md:py-20">
          <div className="mx-auto max-w-3xl px-5 text-center md:px-8">
            <h2 className="text-3xl font-light text-slate-900 md:text-4xl">
              Your Profit Coach — your personal business advisor.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-600 md:text-lg">
              Every certified coach is trained in the full Profit System. They’re not
              selling a personality-led programme — they’re implementing a complete
              methodology with you, session by session, from your BOSS data.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryCta />
              <SecondaryCta />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/80 bg-[#061018] py-12 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 text-center text-sm text-white/70 md:flex-row md:px-8 md:text-left">
          <Link href={LINK_HOME} className="font-semibold text-white hover:underline">
            ← Back to home
          </Link>
          <p>© {new Date().getFullYear()} The Profit Coach</p>
          <Link href={LINK_COACH} className="hover:text-white">
            Find a Coach
          </Link>
        </div>
      </footer>
    </div>
  );
}
