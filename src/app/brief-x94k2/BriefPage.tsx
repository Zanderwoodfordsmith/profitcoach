"use client";

import { useEffect, useState } from "react";

const GRADIENT =
  "linear-gradient(165deg, #051e36 0%, #0c5290 48%, #1a8fd4 100%)";

const SECTIONS = [
  { id: "brand", label: "The Brand" },
  { id: "story", label: "The Story" },
  { id: "avatar", label: "The Avatar" },
  { id: "language", label: "Their Language" },
  { id: "triggers", label: "Emotional Triggers" },
  { id: "methodology", label: "The Methodology" },
  { id: "voice", label: "Voice Rules" },
  { id: "sites", label: "Live Sites" },
  { id: "competitors", label: "Competitors" },
  { id: "docs", label: "Reference Docs" },
] as const;

function useActiveSection() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return active;
}

function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1a8fd4]">
        {kicker}
      </p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#051e36]">
        {title}
      </h2>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {title ? (
        <h3 className="mb-3 text-base font-semibold text-[#051e36]">{title}</h3>
      ) : null}
      <div className="space-y-3 text-[15px] leading-relaxed text-slate-700">
        {children}
      </div>
    </div>
  );
}

function Quote({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-xl bg-slate-50 px-4 py-3 text-[15px] italic text-slate-700">
      &ldquo;{children}&rdquo;
    </li>
  );
}

export function BriefPage() {
  const active = useActiveSection();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f7f9fb] font-sans text-slate-800 antialiased">
      {/* Hero */}
      <header
        className="px-6 pb-16 pt-14 text-white sm:px-10"
        style={{ background: GRADIENT }}
      >
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-200">
            Internal · Not for publication
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            The Profit Coach
            <span className="block text-sky-200">
              Story &amp; Emotional Copy Brief
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-sky-100">
            Everything you need to write the story and emotional side of the
            brand. Read the brand and avatar sections first. The voice rules
            are binding.
          </p>
          <p className="mt-6 text-sm text-sky-200">
            Last updated 24 August 2026 · Owner: Zander Woodford-Smith
          </p>
        </div>
      </header>

      {/* Mobile nav */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-3 text-sm font-medium text-[#051e36]"
        >
          <span>
            {SECTIONS.find((s) => s.id === active)?.label ?? "Sections"}
          </span>
          <span className="text-slate-400">{menuOpen ? "Close" : "Menu"}</span>
        </button>
        {menuOpen ? (
          <nav className="border-t border-slate-100 pb-2">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={() => setMenuOpen(false)}
                className="block px-6 py-2 text-sm text-slate-600 hover:text-[#0c5290]"
              >
                {s.label}
              </a>
            ))}
          </nav>
        ) : null}
      </div>

      <div className="mx-auto flex max-w-6xl gap-12 px-6 py-12 sm:px-10">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-10 space-y-1">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`block rounded-lg px-4 py-2 text-sm transition-colors ${
                  active === s.id
                    ? "bg-[#0c5290]/10 font-semibold text-[#0c5290]"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 space-y-20 pb-24">
          {/* THE BRAND */}
          <section id="brand" className="scroll-mt-24">
            <SectionHeading kicker="Section 01" title="The Brand in One Page" />
            <div className="space-y-5">
              <Card>
                <p>
                  <strong>The Profit Coach</strong> is a diagnostic-led business
                  coaching brand for UK business owners running owner-led
                  companies doing £1M+ revenue. The instrument at the centre is
                  the <strong>BOSS Diagnostic</strong> (Business Owner Strategy
                  System): 50 questions, 10 areas, scored out of 100, free,
                  about 10 minutes. It shows the owner exactly where money and
                  time are being lost, places them on 5 levels (Overwhelm to
                  Owner), and produces a 90-day plan. Certified Profit Coaches
                  deliver the fixes with the owner.
                </p>
                <p>
                  <strong>The core idea:</strong> most business coaching sells a
                  person and their opinions. There is usually no framework
                  behind it and no measurement at all. The Profit Coach sells
                  coaching built on an instrument. Data before advice.
                </p>
                <p>
                  <strong>Market position:</strong> the premium tier of the
                  category. Aston Martin over Ford. The Apple of business
                  coaching.
                </p>
                <p>
                  <strong>Tagline:</strong> Less chaos. More profit. Real
                  freedom.
                </p>
              </Card>
              <Card title="The funnel">
                <p>
                  Homepage → free BOSS Score at /score → results page (this IS
                  the sales page) → £495 strategy call → 6-month programme.
                </p>
              </Card>
              <Card title="Names to use exactly">
                <ul className="list-disc space-y-1 pl-5">
                  <li>The Profit Coach (brand)</li>
                  <li>
                    BOSS Diagnostic (instrument), BOSS Score (output), BOSS
                    Wheel (visual)
                  </li>
                  <li>
                    The Profit System (framework: 3 pillars, 9 steps, 50
                    playbooks)
                  </li>
                  <li>
                    The 5 Levels: Overwhelm, Overworked, Organised, Overseer,
                    Owner
                  </li>
                </ul>
              </Card>
            </div>
          </section>

          {/* THE STORY */}
          <section id="story" className="scroll-mt-24">
            <SectionHeading kicker="Section 02" title="The Story" />
            <div className="space-y-5">
              <Card>
                <p>
                  The founding story is cleared for use in outline, but the
                  details must come from Zander directly.{" "}
                  <strong>Do not invent specifics.</strong> What is cleared:
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    The Pam and Zander story, including a near-death chapter in
                    Pam&rsquo;s life. Pam Featherstone nearly died from
                    overwork, then built a £1 million coaching business in
                    under three years and became a world-renowned,
                    multi-award-winning business coach who has coached owners
                    in 69 countries.
                  </li>
                  <li>
                    The arc of sharing the system with other coaches, who then
                    made their own transformations. 250+ coaches trained
                    worldwide through Business Coach Academy (BCA).
                  </li>
                  <li>
                    45+ years of combined coaching experience behind the
                    methodology.
                  </li>
                  <li>
                    Zander mapped the best thinking of 25+ business thought
                    leaders (Hormozi, Gerber, Michalowicz, Newport, Harnish,
                    Deiss and others) into one integrated framework, then built
                    the diagnostic software that quantifies what is broken.
                  </li>
                </ul>
              </Card>
              <Card title="Founder positioning (important)">
                <p>
                  Zander is <strong>not</strong> a coach. Never call him a
                  coach, mentor, or expert who will &ldquo;help you.&rdquo; He
                  is the founder and builder of the system. His label:
                  &ldquo;The Life Architect.&rdquo; Credibility path: built
                  BCA, mapped 25+ thinkers into one framework, designed the
                  diagnostic.
                </p>
                <p>
                  Pam is the coaching proof. Zander is the system builder. The
                  diagnostic is the hero.
                </p>
              </Card>
            </div>
          </section>

          {/* THE AVATAR */}
          <section id="avatar" className="scroll-mt-24">
            <SectionHeading kicker="Section 03" title="The Avatar" />
            <div className="space-y-5">
              <Card title="Who we write for">
                <p>
                  Owner-operator, founder or MD of an owner-led UK business
                  doing £1M+ (public copy always prints &ldquo;£1M+&rdquo;;
                  internally the core is £1M-£10M). Trades, engineering,
                  manufacturing, construction, services. Age 35-60, team of
                  5-50, majority male. Years into the business. This is not a
                  startup dreamer. This is someone who built something real and
                  is now trapped inside it.
                </p>
              </Card>
              <Card title="Their emotional reality (the gold for your copy)">
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    The whole week is reactive. No strategic time. They are the
                    superhero with the underpants outside the trousers, fixing
                    everything because nobody else can.
                  </li>
                  <li>
                    They do more than half the sales and most of the important
                    decisions. If they stepped away for two weeks the business
                    would fall down. They know it. It terrifies them.
                  </li>
                  <li>
                    Feast or famine cash flow. Busy but margins shrinking. They
                    do not really know their numbers, so every decision is made
                    in the dark.
                  </li>
                  <li>
                    They hurt inside. Years of effort with not enough to show
                    for it. Sometimes it takes everything not to cry.
                    &ldquo;What is the point of doing this?&rdquo;
                  </li>
                  <li>
                    They cannot walk away. They feel unemployable now. The
                    business was meant to give freedom and gave the opposite.
                  </li>
                  <li>Their family gets the worst version of them.</li>
                  <li>
                    Learned helplessness: tried things, nothing stuck, started
                    doubting themselves. Alone, scared, hopeless, stressed.
                    Nobody to talk to. People think they are &ldquo;so
                    lucky&rdquo; to own a business.
                  </li>
                </ul>
              </Card>
              <Card title="The critical psychological insight">
                <p>
                  They buy mathematically, but they search emotionally. They
                  look for help because they hurt. They say yes because the
                  maths makes sense. So copy acknowledges the emotional reality
                  (that is why they stop scrolling), then moves fast to data,
                  score, gap, and plan (that is why they act). Lead with data,
                  use emotion as the doorway.
                </p>
              </Card>
            </div>
          </section>

          {/* THEIR LANGUAGE */}
          <section id="language" className="scroll-mt-24">
            <SectionHeading
              kicker="Section 04"
              title="Their Language (Mirror These)"
            />
            <Card>
              <p>
                Real phrases from real owners. Use them so prospects think
                &ldquo;that&rsquo;s me.&rdquo;
              </p>
              <ul className="grid gap-3 sm:grid-cols-2">
                <Quote>I never switch off.</Quote>
                <Quote>
                  I feel like I&rsquo;m doing everything and still dropping
                  balls.
                </Quote>
                <Quote>Everything lives in my head.</Quote>
                <Quote>
                  Cash flow is always tight. One bad month and I&rsquo;m in
                  trouble.
                </Quote>
                <Quote>We&rsquo;re busy but the margins are shrinking.</Quote>
                <Quote>Employees are the hardest part.</Quote>
                <Quote>What got us here isn&rsquo;t working anymore.</Quote>
                <Quote>I&rsquo;ve tried everything. Nothing changed.</Quote>
                <Quote>It&rsquo;s lonely. No one really understands.</Quote>
                <Quote>People think I&rsquo;m so lucky.</Quote>
              </ul>
            </Card>
          </section>

          {/* TRIGGERS */}
          <section id="triggers" className="scroll-mt-24">
            <SectionHeading
              kicker="Section 05"
              title="Emotional Triggers, In Order"
            />
            <div className="space-y-4">
              {[
                {
                  n: "1",
                  t: "Frustration (primary)",
                  d: "Working harder than ever, business not growing. Use in headlines and hooks.",
                },
                {
                  n: "2",
                  t: "Fear of stagnation",
                  d: "What if next year looks exactly like this year? Use for urgency.",
                },
                {
                  n: "3",
                  t: "Time resentment",
                  d: "60-hour weeks, family gets the leftovers, £10/hour tasks. Use for contrast and \u201cimagine instead\u201d sections.",
                },
                {
                  n: "4",
                  t: "Hopelessness",
                  d: "Handle with care. Acknowledge, never exploit, then show the way out. Deep empathy moments in long-form only.",
                },
                {
                  n: "5",
                  t: "Intellectual curiosity",
                  d: "They WANT to see their score. The pull emotion for CTAs.",
                },
                {
                  n: "6",
                  t: "Desire for control",
                  d: "A dashboard and a plan, not someone\u2019s opinion. The aspiration emotion.",
                },
              ].map((item) => (
                <div
                  key={item.n}
                  className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{ background: GRADIENT }}
                  >
                    {item.n}
                  </span>
                  <div>
                    <p className="font-semibold text-[#051e36]">{item.t}</p>
                    <p className="mt-1 text-[15px] leading-relaxed text-slate-700">
                      {item.d}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* METHODOLOGY */}
          <section id="methodology" className="scroll-mt-24">
            <SectionHeading
              kicker="Section 06"
              title="The Methodology (Enough To Write With)"
            />
            <div className="space-y-5">
              <Card>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    <strong>BOSS Diagnostic:</strong> 50 questions, 9 business
                    areas plus Owner Performance as the foundation, scored
                    0-100. Nobody else starts with the owner. That is the
                    differentiator.
                  </li>
                  <li>
                    <strong>The 5 Levels:</strong> Overwhelm → Overworked →
                    Organised → Overseer → Owner. The self-identification
                    device. Owners must see themselves on the page.
                  </li>
                  <li>
                    <strong>The 3 Pillars:</strong> Control (visibility,
                    structure), Velocity (cash flow, quick wins), Value (growth
                    beyond the owner).
                  </li>
                  <li>
                    <strong>Wheel vs Grid:</strong> the Wheel sells (radar
                    chart, emotional, shareable), the Grid solves (working
                    detail). Always lead with the Wheel.
                  </li>
                </ul>
              </Card>
              <Card title="The maths that carries the proof">
                <p>
                  Five funnel inputs improved 10% each is 1.1
                  <sup>5</sup> = 1.61, a 61% revenue increase. An owner at
                  £500K finds £305K. Always their own numbers where possible.
                </p>
                <p>
                  Margin one-liner: &ldquo;You run a 10% margin. Reduce
                  expenses by 11% and you&rsquo;ve doubled your profit.&rdquo;
                </p>
              </Card>
            </div>
          </section>

          {/* VOICE */}
          <section id="voice" className="scroll-mt-24">
            <SectionHeading kicker="Section 07" title="Voice Rules (Binding)" />
            <div className="space-y-5">
              <Card title="Non-negotiables">
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    <strong>Never use an em dash.</strong> Use a hyphen, comma,
                    full stop, or restructure.
                  </li>
                  <li>
                    Operational, not therapeutic. It is a system, not a
                    relationship. Never &ldquo;sessions&rdquo;,
                    &ldquo;mentoring&rdquo;, &ldquo;accountability
                    partner&rdquo;.
                  </li>
                  <li>
                    Short human sentences. Simple words. Present tense. Active
                    voice.
                  </li>
                  <li>
                    Precision builds trust: 50 questions, 10 areas, 6 months,
                    scored to 100.
                  </li>
                  <li>
                    No forced negation hooks (&ldquo;It&rsquo;s not X,
                    it&rsquo;s Y&rdquo;). No AI vocabulary
                    (&ldquo;unlock&rdquo;, &ldquo;elevate&rdquo;,
                    &ldquo;seamless&rdquo;, &ldquo;dive deep&rdquo;).
                  </li>
                </ul>
                <p>
                  <strong>The owner test before publishing:</strong> would a
                  busy owner of a £500K company with 10 staff read this and
                  think &ldquo;finally, something practical&rdquo;, or
                  &ldquo;another coaching programme selling me feelings&rdquo;?
                  If the latter, rewrite.
                </p>
              </Card>
              <Card title="Never do">
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Countdown timers, fake scarcity, invented testimonials or
                    case studies.
                  </li>
                  <li>
                    The retired claim &ldquo;Unlock 30-130% more profit.&rdquo;
                  </li>
                  <li>
                    Lifestyle or beach imagery. These owners are trying to
                    survive Monday.
                  </li>
                  <li>
                    Publish prices on marketing pages (undecided) or benchmark
                    medians (dataset not built).
                  </li>
                </ul>
              </Card>
              <Card title="Evidence cleared for use">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Real testimonial: the John Davy quote (live on /pam).</li>
                  <li>
                    Stats: 45+ years coaching experience, 250+ coaches trained
                    worldwide, 25+ business methods mapped, 50 playbooks across
                    10 areas.
                  </li>
                  <li>
                    Founding member framing: first 20 members, exclusive not
                    discounted, locked-in pricing for life.
                  </li>
                </ul>
              </Card>
            </div>
          </section>

          {/* SITES */}
          <section id="sites" className="scroll-mt-24">
            <SectionHeading kicker="Section 08" title="Live Sites To Review" />
            <Card>
              <ul className="space-y-3">
                {[
                  ["Main site", "https://www.theprofitcoach.com"],
                  [
                    "Pam\u2019s page (story-led, John Davy testimonial)",
                    "https://www.theprofitcoach.com/pam",
                  ],
                  ["Homepage draft", "https://www.theprofitcoach.com/home"],
                  [
                    "Newer homepage draft",
                    "https://www.theprofitcoach.com/new-home",
                  ],
                  [
                    "Free diagnostic opt-in",
                    "https://www.theprofitcoach.com/score",
                  ],
                ].map(([label, url]) => (
                  <li key={url}>
                    <span className="font-medium text-[#051e36]">{label}</span>
                    <br />
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#0c5290] underline decoration-sky-300 underline-offset-4 hover:text-[#1a8fd4]"
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-slate-500">
                Note: the V3 homepage (the current design direction) is built
                but not deployed to the live site yet. Zander can share a
                preview when ready.
              </p>
            </Card>
          </section>

          {/* COMPETITORS */}
          <section id="competitors" className="scroll-mt-24">
            <SectionHeading
              kicker="Section 09"
              title="Competitors To Study"
            />
            <Card>
              <p>
                Study these for positioning, language, and what the market
                already hears. In priority order.
              </p>
              <ul className="space-y-4">
                <li>
                  <span className="font-medium text-[#051e36]">
                    EOS (Entrepreneurial Operating System)
                  </span>
                  <br />
                  <a
                    href="https://www.eosworldwide.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#0c5290] underline decoration-sky-300 underline-offset-4 hover:text-[#1a8fd4]"
                  >
                    eosworldwide.com
                  </a>
                  <span className="text-slate-400"> · </span>
                  <a
                    href="https://docs.google.com/document/d/1L0dgHCD5Su36IdLKfzC3BYOd7gOOCiJjfONxmEBzty4/edit"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#0c5290] underline decoration-sky-300 underline-offset-4 hover:text-[#1a8fd4]"
                  >
                    EOS swipe file (Google Doc)
                  </a>
                </li>
                {[
                  [
                    "Consulting Success",
                    "https://www.consultingsuccess.com",
                  ],
                  ["Scalable (Ryan Deiss)", "https://scalable.co"],
                  ["E-Myth", "https://www.emyth.com"],
                  ["ActionCOACH", "https://www.actioncoach.com"],
                  [
                    "Fix This Next (Mike Michalowicz)",
                    "https://fixthisnext.com",
                  ],
                ].map(([label, url]) => (
                  <li key={url}>
                    <span className="font-medium text-[#051e36]">{label}</span>
                    <br />
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#0c5290] underline decoration-sky-300 underline-offset-4 hover:text-[#1a8fd4]"
                    >
                      {url.replace("https://", "").replace("www.", "")}
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          {/* DOCS */}
          <section id="docs" className="scroll-mt-24">
            <SectionHeading
              kicker="Section 10"
              title="Full Reference Documents"
            />
            <Card>
              <p>
                The full brand documents live in the shared Google Drive folder
                (Business Coach Academy → _brand → Profit Coach). Ask Zander for
                access.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Avatar Profile</strong> - ICP deep dive: pains mapped
                  to all 10 areas, psychology, segments, their language. The
                  richest source for emotional copy.
                </li>
                <li>
                  <strong>ICP</strong> - compact ICP.
                </li>
                <li>
                  <strong>Business Profile</strong> - what the brand is, the
                  team, the model, strategy.
                </li>
                <li>
                  <strong>Methodology</strong> - the full BOSS system.
                </li>
                <li>
                  <strong>Offer Stack</strong> - pricing and offers (internal,
                  do not publish prices).
                </li>
                <li>
                  <strong>Copywriter Knowledge</strong> - copy angles, proof
                  arsenal, funnel-stage guidance.
                </li>
                <li>
                  <strong>Writing Rules</strong> - binding rules for all copy.
                </li>
              </ul>
            </Card>
          </section>
        </main>
      </div>

      <footer
        className="px-6 py-8 text-center text-sm text-sky-100"
        style={{ background: GRADIENT }}
      >
        The Profit Coach · Internal brief · Please treat as confidential
      </footer>
    </div>
  );
}
