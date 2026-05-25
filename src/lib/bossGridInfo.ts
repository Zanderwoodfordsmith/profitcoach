/** Coaching copy for BOSS grid info tooltips. */

export type BossGridInfoSection = {
  label: string;
  body: string;
};

export const BOSS_AREA_IMPORTANCE: Record<number, string> = {
  0: "Sits beneath every other part of the Profit System. If you burn out or lose focus, progress in marketing, operations or finance cannot stick.",
  1: "Without alignment here, teams pull in different directions and every tactical decision feels harder than it should.",
  2: "Weak strategy means busy work without leverage. Strong strategy makes marketing, sales and delivery compound.",
  3: "Plans that never land create chaos. Reliable planning cadence is what converts ambition into measurable progress.",
  4: "Revenue without profit and cash control is a treadmill. This area protects runway and owner reward.",
  5: "Growth depends on a predictable pipeline. Gaps here show up as feast-or-famine revenue and discounting.",
  6: "Marketing can fill the funnel, but delivery builds reputation. Breakdowns here erode margin and referrals.",
  7: "You cannot steer what you cannot see. Clear financials turn guesswork into confident leadership.",
  8: "What lives only in your head does not scale. Documented systems reduce errors and owner dependency.",
  9: "Every other area eventually depends on people. Strong team foundations multiply everything else you fix.",
};

export const BOSS_LEVEL_INFO: Record<number, BossGridInfoSection[]> = {
  1: [
    {
      label: "What it feels like",
      body: "Everything is urgent. You are reacting all day, doing the work yourself, and still falling behind.",
    },
    {
      label: "Common issues",
      body: "No clear focus, cash stress, an unclear offer, and delivery chaos — the basics are not in place yet.",
    },
    {
      label: "What to focus on",
      body: "Stop trying to fix everything at once. Nail focus, cash flow, your core offer, and simple fulfilment before anything else.",
    },
  ],
  2: [
    {
      label: "What it feels like",
      body: "You are holding it together through effort. Busy and tired, but not sure you are actually building something that gets easier.",
    },
    {
      label: "Common issues",
      body: "Still the main doer, weak delegation, marketing that does not convert reliably, and numbers you cannot fully trust.",
    },
    {
      label: "What to focus on",
      body: "Create leverage — get time back, make your first key hires, build simple systems, and establish repeatable lead flow.",
    },
  ],
  3: [
    {
      label: "What it feels like",
      body: "Momentum is returning. You can see what is working, but the business still leans on you most days.",
    },
    {
      label: "Common issues",
      body: "Processes live in people's heads, KPIs are patchy, and planning happens in bursts instead of a steady rhythm.",
    },
    {
      label: "What to focus on",
      body: "Document what works, measure what matters, and build a planning cadence the team can follow without you driving every move.",
    },
  ],
  4: [
    {
      label: "What it feels like",
      body: "You are leading more than doing. The team runs much of the operation — but the big calls still land on you.",
    },
    {
      label: "Common issues",
      body: "Decision bottlenecks, leaders not fully empowered, and strategy that does not always reach the front line.",
    },
    {
      label: "What to focus on",
      body: "Develop leaders, clarify who owns what, and install review rhythms that keep alignment without you in every detail.",
    },
  ],
  5: [
    {
      label: "What it feels like",
      body: "The business can run without you for stretches. You think in years — legacy, wealth, and genuine freedom.",
    },
    {
      label: "Common issues",
      body: "Optimisation over innovation, succession gaps, and wealth still heavily tied to the company itself.",
    },
    {
      label: "What to focus on",
      body: "Enterprise value, succession, culture at scale, and building personal wealth beyond the business.",
    },
  ],
};

export const BOSS_PILLAR_IMPORTANCE: Record<
  "foundation" | "vision" | "velocity" | "value",
  string
> = {
  foundation:
    "Your personal capacity limits every business outcome. Strategy and systems cannot fix burnout or chaos at the top.",
  vision:
    "Direction has to be clear before tactics compound. Misalignment here wastes team effort and marketing spend.",
  velocity:
    "Cash and delivery keep the engine running. Problems here create stress long before they show cleanly on the P&L.",
  value:
    "Numbers, systems and people turn a job into an asset. This is where the business becomes transferable and valuable.",
};

export function getBossAreaImportance(areaId: number): string | null {
  return BOSS_AREA_IMPORTANCE[areaId] ?? null;
}

export function getBossAreaInfoSections(areaId: number): BossGridInfoSection[] | null {
  const body = getBossAreaImportance(areaId);
  return body ? [{ label: "Why it matters", body }] : null;
}

export function getBossLevelInfoSections(levelId: number): BossGridInfoSection[] | null {
  return BOSS_LEVEL_INFO[levelId] ?? null;
}

export function getBossPillarImportance(
  pillar: "foundation" | "vision" | "velocity" | "value"
): string | null {
  return BOSS_PILLAR_IMPORTANCE[pillar] ?? null;
}

export function getBossPillarInfoSections(
  pillar: "foundation" | "vision" | "velocity" | "value"
): BossGridInfoSection[] | null {
  const body = getBossPillarImportance(pillar);
  return body ? [{ label: "Why it matters", body }] : null;
}
