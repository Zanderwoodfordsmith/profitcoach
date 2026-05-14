"use client";

import { useId } from "react";
import { Outfit } from "next/font/google";
import { ArrowUpRight, Sparkles, TrendingUp } from "lucide-react";
import {
  DashboardStyleLevelBarCard,
  LANDING_C_LEVEL_DEMO,
} from "@/components/landing/DashboardStyleLevelBars";
import type { LandingContent } from "@/lib/landingCopy";

const landingOutfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const DEMO_TOTAL = 47;

/** Semicircular gauge aligned with Figma / Insight dashboard dial (node 233:1665). */
function describeArc(
  startAngle: number,
  endAngle: number,
  radius: number,
  cx: number,
  cy: number
): string {
  const polarToCart = (angle: number, r: number) => ({
    x: cx + r * Math.cos((angle * Math.PI) / 180),
    y: cy - r * Math.sin((angle * Math.PI) / 180),
  });
  const s = polarToCart(startAngle, radius);
  const e = polarToCart(endAngle, radius);
  const large = startAngle - endAngle > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
}

function BossScoreArcGauge({ percent, size = 236 }: { percent: number; size?: number }) {
  const gradId = `landing-arc-grad-${useId().replace(/:/g, "")}`;
  const radius = (size - 24) / 2;
  const cx = size / 2;
  const cy = size / 2 + 8;
  const startAngle = 225;
  const endAngle = -45;
  const totalArc = 270;
  const strokeW = 14;
  const fillAngle = startAngle - (Math.min(100, Math.max(0, percent)) / 100) * totalArc;

  return (
    <div className="relative mx-auto flex h-[200px] w-[236px] shrink-0 items-center justify-center">
      <svg
        width={size}
        height={size * 0.72}
        viewBox={`0 0 ${size} ${size * 0.72}`}
        className="shrink-0"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#052745" />
            <stop offset="45%" stopColor="#0a5291" />
            <stop offset="100%" stopColor="#36adf4" />
          </linearGradient>
        </defs>
        <path
          d={describeArc(startAngle, endAngle, radius, cx, cy)}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        <path
          d={describeArc(startAngle, Math.max(fillAngle, endAngle), radius, cx, cy)}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeW}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-4">
        <span className="text-[47px] font-semibold leading-none tracking-tight text-[#050708]">
          {percent}%
        </span>
        <span className="mt-1 text-[19px] font-light uppercase tracking-wide text-[#809fb8]">
          Total
        </span>
      </div>
    </div>
  );
}

/** Light-section eyebrow — cool slate + brand blue accent (matches BOSS marketing UI). */
function EyebrowLight({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#b8c9d9] bg-[linear-gradient(180deg,#ffffff_0%,#f0f6fb_100%)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#3d566b] shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_1px_2px_rgba(10,82,145,0.06)]">
      <Sparkles className="size-3 shrink-0 text-[#0a7bc4]" strokeWidth={2.25} aria-hidden />
      {children}
    </span>
  );
}

/** Dark-banner eyebrow — frosted pill on navy. */
function EyebrowDark({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#5a9fd4]/35 bg-[#0a3a66]/55 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#e8f4ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-[6px]">
      <Sparkles className="size-3 shrink-0 text-[#7ec8ff]" strokeWidth={2.25} aria-hidden />
      {children}
    </span>
  );
}

/** Figma-style section intro: small label + large light headline + supporting line. */
function SectionIntro(props: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  align?: "center" | "left";
  /** Overrides default headline size / leading / tracking (base styles stay: balance, light, colour). */
  titleClassName?: string;
  /** Wider column for long headlines (default 720px when center). */
  introMaxWidthClass?: string;
}) {
  const align = props.align ?? "center";
  const titleClass =
    props.titleClassName ??
    "text-[clamp(34px,4.8vw,56px)] leading-[1.1] tracking-[-0.05em]";
  const centerWrap =
    props.introMaxWidthClass ?? "max-w-[720px]";
  return (
    <div
      className={
        align === "center"
          ? `mx-auto flex ${centerWrap} flex-col items-center text-center`
          : "flex max-w-3xl flex-col items-start text-left"
      }
    >
      <EyebrowLight>{props.eyebrow}</EyebrowLight>
      <h2 className={`mt-6 text-balance font-light text-[#364153] ${titleClass}`}>
        {props.title}
      </h2>
      {props.subtitle ? (
        <p className="mt-4 max-w-xl text-[19px] font-normal leading-relaxed text-[#17181a]/58 sm:text-[21px]">
          {props.subtitle}
        </p>
      ) : null}
    </div>
  );
}

/** How it works — image uses intrinsic aspect from source files (no forced crop ratio). */
function HowRow(props: { step: string; imageSrc: string; title: string; description: string; isLast?: boolean }) {
  return (
    <div
      className={`flex flex-col gap-10 border-[#e2e8f0] py-10 sm:flex-row sm:items-start sm:gap-16 sm:py-12 lg:gap-20 ${props.isLast ? "" : "border-b"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={props.imageSrc}
        alt=""
        width={324}
        height={301}
        className="mx-auto h-auto w-full max-w-[min(100%,400px)] shrink-0 rounded-2xl shadow-[0_12px_40px_-12px_rgba(15,23,42,0.12)] sm:mx-0 sm:max-w-[420px]"
      />
      <div className="min-w-0 flex-1 pt-0 sm:pt-1">
        <p className="inline-flex items-center gap-2 text-[14px] font-semibold uppercase tracking-[0.16em] text-[#0a5291]">
          <Sparkles className="size-3.5 shrink-0 text-[#2a8fd6]" strokeWidth={2.25} aria-hidden />
          {props.step}
        </p>
        <h3 className="mt-2 text-[clamp(27px,3.5vw,38px)] font-light leading-[1.15] tracking-[-0.03em] text-[#364153]">
          {props.title}
        </h3>
        <p className="mt-4 text-[19px] leading-[1.55] text-[#17181a]/68 sm:text-[20px]">{props.description}</p>
      </div>
    </div>
  );
}

export type LandingVariantCProps = {
  landingContent: LandingContent;
  prospectCompany: string | null;
  prospectName: string | null;
  scrollToForm: () => void;
  form: React.ReactNode;
  /** Default: centered headline + description above hero. `split`: headline + copy left, dashboard visual right (lg+). */
  heroLayout?: "stack" | "split";
};

export function LandingVariantC({
  landingContent,
  prospectCompany,
  prospectName,
  scrollToForm,
  form,
  heroLayout = "stack",
}: LandingVariantCProps) {
  const bottomCtaLabel = "Get My BOSS Score";
  const splitHero = heroLayout === "split";
  const heroDashboardSrc = "/landing/c/hero-dashboard.png";

  return (
    <div
      className={`min-h-screen bg-[#f5f8fc] text-[#17181a] antialiased ${landingOutfit.className}`}
    >
      <main>
        {/* Hero — Figma node 158:2136 “Content”: centered headline + subcopy + dashboard */}
        <section
          className={`relative z-0 overflow-hidden rounded-b-[2rem] bg-[#031a2e] px-4 pt-20 text-white sm:rounded-b-[2.75rem] sm:pt-24 ${
            splitHero ? "pb-[70px]" : "pb-0 sm:pb-0"
          }`}
        >
          <div className="pointer-events-none absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/c/hero-section.png"
              alt=""
              width={1024}
              height={700}
              className="absolute inset-0 h-full w-full object-cover object-top"
            />
            {/* Light legibility scrim only — keeps exported Figma art visible */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#031a2e]/25 via-transparent to-[#020c18]/35" />
          </div>

          <div
            className={
              splitHero
                ? "relative z-10 mx-auto w-full max-w-[1280px]"
                : "relative z-10 mx-auto flex max-w-[920px] flex-col items-center text-center"
            }
          >
            {splitHero ? (
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center lg:gap-12 xl:gap-16">
                <div className="flex min-w-0 flex-col items-start text-left">
                  <EyebrowDark>{landingContent.eyebrow}</EyebrowDark>
                  <h1 className="mt-5 text-balance text-[clamp(40px,6.2vw,62px)] font-light leading-[1.08] tracking-[-0.08em] text-white [text-shadow:0_2px_28px_rgba(0,0,0,0.35)] lg:text-[clamp(42px,5.4vw,68px)] xl:text-[clamp(44px,4.8vw,76px)]">
                    Are You Running Your Business{" "}
                    <span
                      className="bg-clip-text font-semibold text-transparent"
                      style={{
                        backgroundImage:
                          "linear-gradient(81deg, rgb(0, 112, 178) 0.6%, rgb(54, 173, 244) 54%, rgb(188, 126, 250) 91%)",
                      }}
                    >
                      Or Is It Running You?
                    </span>
                  </h1>
                  {prospectCompany || prospectName ? (
                    <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#d9e1e7] sm:text-xl">
                      {prospectCompany ? (
                        <>
                          For{" "}
                          <span className="font-semibold text-white">{prospectCompany}</span>
                          {prospectName ? (
                            <>
                              {" "}
                              · <span className="font-semibold text-white">{prospectName}</span>
                            </>
                          ) : null}
                        </>
                      ) : prospectName ? (
                        <>
                          Prepared for{" "}
                          <span className="font-semibold text-white">{prospectName}</span>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                  <p className="mt-6 max-w-xl text-pretty text-[clamp(18px,2.2vw,22px)] font-normal leading-[1.55] text-[#eef2f6]">
                    Successful business owners master all 5 &quot;Owner Levels&quot; across profit,
                    systems, team, and strategy. How many have you nailed? Take the Free BOSS Scorecard
                    and find out where you really stand.
                  </p>
                </div>
                <div className="flex min-w-0 justify-center lg:justify-end">
                  <div className="w-full max-w-[min(100%,560px)] lg:max-w-[min(100%,620px)]">
                    <div className="overflow-hidden rounded-[22.661px] bg-transparent shadow-[0_28px_80px_-24px_rgba(0,0,0,0.45)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={heroDashboardSrc}
                        alt=""
                        className="block h-auto w-full max-w-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-balance text-[clamp(36px,7vw,64px)] font-light leading-[1.1] tracking-[-0.08em] text-white [text-shadow:0_2px_28px_rgba(0,0,0,0.35)]">
                  Are You Running Your Business{" "}
                  <span
                    className="bg-clip-text font-semibold text-transparent"
                    style={{
                      backgroundImage:
                        "linear-gradient(81deg, rgb(0, 112, 178) 0.6%, rgb(54, 173, 244) 54%, rgb(188, 126, 250) 91%)",
                    }}
                  >
                    Or Is It Running You?
                  </span>
                </h1>
                {prospectCompany || prospectName ? (
                  <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#d9e1e7] sm:text-xl">
                    {prospectCompany ? (
                      <>
                        For{" "}
                        <span className="font-semibold text-white">{prospectCompany}</span>
                        {prospectName ? (
                          <>
                            {" "}
                            · <span className="font-semibold text-white">{prospectName}</span>
                          </>
                        ) : null}
                      </>
                    ) : prospectName ? (
                      <>
                        Prepared for{" "}
                        <span className="font-semibold text-white">{prospectName}</span>
                      </>
                    ) : null}
                  </p>
                ) : null}
                <p className="mt-6 max-w-[min(100%,1180px)] text-pretty text-[clamp(18px,2.5vw,22px)] font-normal leading-[1.55] text-[#eef2f6]">
                  Successful business owners master all 5 &quot;Owner Levels&quot; across profit, systems,
                  team, and strategy. How many have you nailed? Take the Free BOSS Scorecard and find out
                  where you really stand.
                </p>

                <div className="mt-10 w-full max-w-[min(100%,920px)] sm:mt-12">
                  <div className="overflow-hidden rounded-[22.661px] bg-transparent shadow-[0_28px_80px_-24px_rgba(0,0,0,0.45)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={heroDashboardSrc}
                      alt=""
                      className="block h-auto w-full max-w-none"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Figma node 158:2738 “Future Section” — frosted bridge, tucked under hero image */}
        <div className="relative z-30 -mt-6 px-4 sm:-mt-7">
          <div
            className="mx-auto max-w-[883px] border-[0.75px] border-solid border-white/[0.56] bg-white/40 px-[26px] py-[26px] shadow-[0_15px_18.75px_rgba(10,82,145,0.08)] backdrop-blur-md sm:px-[42px]"
            style={{ borderRadius: "20px" }}
          >
            {form}
          </div>
        </div>

        <section className="relative z-10 -mt-6 px-4 pb-16 pt-20 sm:-mt-8 sm:pb-20 sm:pt-24">
          <div className="mx-auto max-w-6xl">
            <SectionIntro
              eyebrow="Your Scorecard"
              introMaxWidthClass="max-w-[min(100%,1120px)]"
              titleClassName="text-[64px] leading-[1.2] tracking-[-0.02em] max-lg:text-[clamp(34px,5vw,52px)]"
              title={
                <>
                  Know exactly which levels are{" "}
                  <span
                    className="bg-clip-text text-transparent [font-weight:400]"
                    style={{
                      backgroundImage:
                        "linear-gradient(92deg, #0a5291 0%, #36adf4 45%, #7c5cdb 100%)",
                    }}
                  >
                    holding your business back
                  </span>
                </>
              }
              subtitle="You will be scored across all 5 business owner levels."
            />

            <div className="mt-14 grid gap-8 lg:mt-16 lg:grid-cols-[minmax(0,518px)_minmax(0,518px)] lg:items-start lg:justify-center lg:gap-10">
              <div className="mx-auto flex w-full max-w-[518px] flex-col gap-5 lg:mx-0">
                {LANDING_C_LEVEL_DEMO.map((row) => (
                  <DashboardStyleLevelBarCard key={row.level} {...row} />
                ))}
              </div>

              <div className="mx-auto w-full max-w-[518px] lg:sticky lg:top-8 lg:mx-0">
                <div
                  className="flex flex-col items-stretch justify-between border-[1.266px] border-solid border-white/[0.56] bg-white/80 p-[25px] shadow-[0_25.3px_33.29px_rgba(10,82,145,0.26)] backdrop-blur-sm sm:p-[26px]"
                  style={{ borderRadius: "22.786px" }}
                >
                  <div className="flex flex-col gap-5">
                    <div
                      className="flex size-[42px] items-center justify-center rounded-xl"
                      style={{
                        backgroundImage:
                          "linear-gradient(239deg, rgb(83, 197, 222) 5.6%, rgb(18, 175, 240) 38%, rgb(10, 69, 125) 108%)",
                      }}
                    >
                      <TrendingUp className="size-6 text-white" strokeWidth={2} aria-hidden />
                    </div>
                    <div>
                      <p className="text-[32px] font-medium tracking-[0.015em] text-[#364153]">BOSS Score</p>
                      <p className="mt-3 text-[20px] font-normal leading-snug tracking-[0.015em] text-[#17181a]/52">
                        Find the key areas to focus on.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col items-center justify-center py-6">
                    <BossScoreArcGauge percent={DEMO_TOTAL} />
                  </div>
                  <p className="text-center text-base leading-relaxed text-[#17181a]/48">
                    Complete the steps above — your live score replaces this preview.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#fafbfd] px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-5xl">
            <SectionIntro
              eyebrow="Three steps"
              title="How it works"
              subtitle="From quick questions to a clear, fix-first view of your business."
            />
            <div className="mt-4">
              <HowRow
                step="Step 1"
                imageSrc="/landing/v2/how-1.png"
                title="Answer a few questions about how your business is doing"
                description="No prep, no spreadsheets, no calculators. Just honest answers about what is working and what is not — about 10 minutes."
              />
              <HowRow
                step="Step 2"
                imageSrc="/landing/v2/how-2.png"
                title="Get your BOSS Score out of 100"
                description="One number that tells you how strong your business really is. Plus a visual breakdown across all 10 areas, so you can see where you are strong and where you are exposed."
              />
              <HowRow
                step="Step 3"
                imageSrc="/landing/v2/how-3.png"
                title="See what to fix first"
                description="Your top priorities for the next 90 days — the highest-leverage changes most likely to increase profit, reduce chaos, and free up your time."
                isLast
              />
            </div>
          </div>
        </section>

        <section className="bg-[#f5f8fc] px-4 pb-16 pt-2 sm:pb-20 sm:pt-4">
          <div className="relative mx-auto max-w-[1312px] min-h-[280px] overflow-hidden rounded-[28px] shadow-[0_28px_80px_-24px_rgba(6,48,84,0.45)] ring-1 ring-black/[0.06] sm:min-h-[320px] sm:rounded-[32px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/c/cta-banner.png"
              alt=""
              width={1024}
              height={465}
              className="pointer-events-none absolute inset-0 size-full object-cover object-center"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020c18]/45 via-transparent to-[#031a2e]/20" />

            <div className="relative z-10 flex flex-col items-center px-6 py-14 text-center sm:px-12 sm:py-20">
              <EyebrowDark>Start Your BOSS Now</EyebrowDark>
              <h2 className="mt-7 max-w-[min(100%,920px)] text-balance text-[clamp(38px,6vw,72px)] font-light leading-[1.06] tracking-[-0.055em] text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.35)]">
                Ready to build a{" "}
                <span
                  className="bg-clip-text font-light text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(92deg, #b8e6ff 0%, #62b9f7 22%, #2f8fe6 52%, #1a6ec9 78%, #2563a8 100%)",
                  }}
                >
                  rewarding business?
                </span>
              </h2>
              <p className="mx-auto mt-7 max-w-[min(100%,52rem)] text-pretty text-[clamp(19px,2.1vw,22px)] font-normal leading-snug text-[#e8f1f8]/92">
                Join 1,000+ businesses that have used the BOSS Score to turn chaos into control, earn more
                profit and build real freedom through business ownership.
              </p>

              <div className="mt-10 flex w-full max-w-[334px] flex-col items-stretch">
                <div className="flex h-[63px] w-full items-center justify-center rounded-[24px] bg-[#3283d9] px-4 shadow-[0_4px_4px_rgba(0,0,0,0.25)] backdrop-blur-[30px]">
                  <button
                    type="button"
                    onClick={scrollToForm}
                    className="flex w-full items-center justify-center gap-4 bg-transparent text-[18px] font-medium text-white outline-none transition hover:opacity-95"
                  >
                    {bottomCtaLabel}
                    <ArrowUpRight className="size-4 shrink-0 opacity-95" strokeWidth={2.25} aria-hidden />
                  </button>
                </div>
                <p className="mt-6 text-center text-[20px] font-normal leading-[1.5] tracking-normal text-[#d9e1e7]/75">
                  It only takes 10 minutes
                </p>
              </div>
            </div>

            <footer className="relative z-10 border-t border-white/10 bg-[#020c18]/55 px-6 py-6 backdrop-blur-[2px] sm:py-7">
              <div className="mx-auto flex max-w-lg flex-col items-center gap-2.5 text-center">
                <span className="inline-flex rounded-full border border-white/18 bg-white/[0.06] px-3.5 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/88">
                  BOSS OS
                </span>
                <p className="text-[13px] font-normal leading-snug text-white/48">Powered by The Profit Coach</p>
              </div>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}
