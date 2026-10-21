/**
 * Words for a coach's before-our-call explainer: the owner-facing version of
 * BCA's before-your-call brochure (bca-website app/before-your-call/brochure).
 * Same three-phase shape as Alex's done-for-you pitch, turned into advisory:
 * the coach does it with the owner, not for them. The phases are the three
 * BOSS pillars, so the brochure, the wheel and the playbooks share one map.
 * Coach-specific lines come from the Blueprint (see fromBlueprint.ts).
 */

/** How long the coach sells: month to month, a fixed 90 days, or 90 days then month to month. */
export type ExplainerLength = "ongoing" | "ninety" | "blend";

export const EXPLAINER_LENGTHS: { value: ExplainerLength; label: string }[] = [
  { value: "ongoing", label: "Ongoing" },
  { value: "ninety", label: "90 days" },
  { value: "blend", label: "90 days, then ongoing" },
];

export function parseExplainerLength(raw: string | undefined): ExplainerLength {
  return raw === "ninety" || raw === "blend" ? raw : "ongoing";
}

export const FOOT = "Read this before our call";

export const cover = {
  kicker: "Read this before our call",
  light: "From running everything",
  bold: "to running the business.",
  fallbackStandfirst:
    "I help owners see where the business stands, fix what matters most, and get their time back.",
  together: "We do it together, one 90-day plan at a time.",
  fallbackStats: [
    { value: "50", label: "questions in the BOSS Diagnostic, across every part of the business" },
    { value: "10", label: "areas scored, starting with you, the owner" },
    { value: "90 days", label: "per plan, with three priorities and the numbers to prove them" },
  ],
};

export function welcome(showFee: boolean) {
  return {
    label: "Welcome",
    light: "Before we speak,",
    bold: "here’s the plan.",
    lead: `I want you to know how I work and what we’d do together${
      showFee ? ", and what it costs" : ""
    }. Then our call can be about your business.`,
    outcomesHeading: "In our call, we’ll work out",
    outcomes: [
      { title: "Where the business stands", text: "Your BOSS Score, area by area." },
      { title: "What’s holding it back most", text: "The one or two areas costing you the most time and money." },
      { title: "What the next 90 days could look like", text: "Three priorities, and the numbers that show they’re working." },
      { title: "An honest yes or no", text: "Whether I’m the right person to help. If I’m not, I’ll tell you." },
    ],
    oneLineHeading: "The whole thing in one line",
    readTime: "About 8 minutes to read",
  };
}

export const now = {
  label: "01 · Where you are now",
  light: "You built a business that works.",
  bold: "It still runs through you.",
  lead: "Most owners I speak to tell me the same three things.",
  fallbackPains: [
    "Every decision still comes back to you, so the week runs you.",
    "Turnover grows, but profit and cash don’t keep up.",
    "You can’t step away without things slipping.",
  ],
  cost: "That means long days, a team that waits on you, and a business worth less than it should be.",
  tableHeading: "Two ways to run it",
  gapColumns: ["Today", "Where we’re heading"],
  fallbackRows: [
    ["Your week", "Reacting to whatever lands", "Planned around what matters"],
    ["Decisions", "All come through you", "Your team makes most of them"],
    ["The numbers", "Seen at month end, if at all", "A weekly scoreboard you trust"],
    ["Cash", "A worry", "Planned and in hand"],
    ["Time away", "Things slip", "The business keeps running"],
  ],
  levelsHeading: "The five levels every owner moves through",
  levelsNote: "Your BOSS Score places you on one of these. The work is moving up, one level at a time.",
};

export const LEVELS = [
  { name: "Overwhelm", text: "Firefighting. The business runs you.", color: "#EF4444" },
  { name: "Overworked", text: "Holding it together, at a cost.", color: "#F97316" },
  { name: "Organised", text: "Systems working, you’re still the bottleneck.", color: "#EAB308" },
  { name: "Overseer", text: "Managing rather than doing.", color: "#22C55E" },
  { name: "Owner", text: "The business works. You choose what’s next.", color: "#238BF7" },
];

export const score = {
  label: "02 · Data before advice",
  light: "Most advice starts with an opinion.",
  bold: "Mine starts with your score.",
  lead: "Before I suggest anything, we score the whole business, including you. Then we both know where to start.",
  stats: [
    { value: "50", text: "questions" },
    { value: "10", text: "areas" },
    { value: "5", text: "levels" },
    { value: "100", text: "the top score" },
  ],
  foundation: { name: "Owner Performance", text: "You first: your time, energy and focus." },
  pillars: [
    {
      name: "Vision",
      text: "Where the business is going",
      areas: ["Aligned Vision", "Defined Strategy", "Disciplined Planning"],
    },
    {
      name: "Velocity",
      text: "What brings in profit and cash",
      areas: ["Profit & Cash Flow", "Revenue & Marketing", "Operations & Delivery"],
    },
    {
      name: "Value",
      text: "What makes it last without you",
      areas: ["Financials & Metrics", "Infrastructure & Systems", "Team & Leadership"],
    },
  ],
  close: "The score shows where you are and what to fix first.",
  line: "Data first. Then advice.",
};

type Phase = { n: number; pillar: string; name: string; text: string; you: string };

export const PHASES: Phase[] = [
  {
    n: 1,
    pillar: "Vision",
    name: "Set the direction",
    text: "We score the business, find the biggest lever and build your 90-day plan.",
    you: "Honest answers, and your numbers.",
  },
  {
    n: 2,
    pillar: "Velocity",
    name: "Get it moving",
    text: "We fix profit, cash, sales and delivery, in the order your score says.",
    you: "Make the changes between sessions.",
  },
  {
    n: 3,
    pillar: "Value",
    name: "Make it last",
    text: "We build the numbers, systems and team so the business runs without you.",
    you: "Lead, and let your team carry more.",
  },
];

export type TimelineRow = {
  label: string;
  tone: "phase1" | "phase2" | "phase3" | "you" | "support";
  start: number;
  end: number;
  /** Runs on past the last column. */
  on?: boolean;
  note?: string;
};

export function timing(length: ExplainerLength): {
  when: [string, string, string];
  heading: string;
  columns: string[];
  rows: TimelineRow[];
} {
  if (length === "ninety") {
    return {
      when: ["Month 1", "Months 2 and 3", "Month 3"],
      heading: "Your 90 days",
      columns: ["Month 1", "Month 2", "Month 3", "Day 90"],
      rows: [
        { label: "Phase 1: set the direction", tone: "phase1", start: 0, end: 0 },
        { label: "Phase 2: get it moving", tone: "phase2", start: 1, end: 2 },
        { label: "Phase 3: make it last", tone: "phase3", start: 2, end: 2 },
        { label: "You make the changes", tone: "you", start: 0, end: 2 },
        { label: "Re-score, then you decide", tone: "support", start: 3, end: 3, note: "Your call" },
      ],
    };
  }
  if (length === "blend") {
    return {
      when: ["Month 1", "Months 2 and 3", "From month 4"],
      heading: "Your first 90 days, and after",
      columns: ["Month 1", "Month 2", "Month 3", "Month 4", "Month 5", "Month 6 on"],
      rows: [
        { label: "Phase 1: set the direction", tone: "phase1", start: 0, end: 0 },
        { label: "Phase 2: get it moving", tone: "phase2", start: 1, end: 2 },
        { label: "Phase 3: make it last", tone: "phase3", start: 3, end: 5, on: true },
        { label: "You make the changes", tone: "you", start: 0, end: 5, on: true },
        { label: "Your first 90 days", tone: "support", start: 0, end: 2, note: "Then month to month" },
      ],
    };
  }
  return {
    when: ["Month 1", "Months 2 to 6", "From month 6"],
    heading: "Your first six months, and after",
    columns: ["Month 1", "Month 2", "Month 3", "Month 4", "Month 5", "Month 6 on"],
    rows: [
      { label: "Phase 1: set the direction", tone: "phase1", start: 0, end: 0 },
      { label: "Phase 2: get it moving", tone: "phase2", start: 1, end: 5, on: true },
      { label: "Phase 3: make it last", tone: "phase3", start: 4, end: 5, on: true },
      { label: "You make the changes", tone: "you", start: 0, end: 5, on: true },
      { label: "Re-score and a new 90-day plan", tone: "support", start: 0, end: 5, on: true, note: "Every 90 days" },
    ],
  };
}

export const how = {
  label: "03 · How it works",
  light: "Three phases.",
  bold: "We do it together.",
  lead: "I bring the questions, the tools and the plan. You make the changes. That’s what makes them stick.",
  note: "Every 90 days we re-score the business and set the next plan. Every business is different, so we map your own timeline in our first month.",
};

export const phaseOne = {
  heading: "See where you stand and set the direction.",
  lead: "Most owners have never seen their whole business on one page. So we start there. It takes four sessions.",
  sessions: [
    {
      title: "Your BOSS review",
      text: "We go through your score area by area, so you see where the business stands and where it leaks time and money.",
    },
    {
      title: "Your biggest lever",
      text: "We find the one or two issues costing you the most, and agree what to tackle first.",
    },
    {
      title: "Your three-year direction",
      text: "Where you want the business, and your life, to be in three years. Then everything lines up behind it.",
    },
    {
      title: "Your 90-day plan",
      text: "Three priorities, who owns each one, and the weekly numbers that show they’re working.",
    },
  ],
  systemHeading: "What you leave month one with",
  system: ["Your BOSS Score", "Your BOSS Wheel", "Your 90-day plan", "Your weekly scoreboard"],
  systemNote: "One picture of the business, one plan, one set of numbers.",
  result: "By the end of month one you know where you stand, what matters most, and what the next 90 days hold.",
};

export const phaseTwo = {
  heading: "Get profit, cash and sales moving.",
  lead: "With the plan set, we go after the areas that move money and time fastest. Your score decides the order.",
  areas: [
    {
      name: "Profit & Cash Flow",
      items: ["Pricing that holds its margin", "Costs under control", "A cash forecast you trust"],
    },
    {
      name: "Revenue & Marketing",
      items: ["A clear offer and positioning", "Sales calls that convert", "Follow-up that brings customers back"],
    },
    {
      name: "Operations & Delivery",
      items: ["Systems for the work you repeat", "The same service, whoever delivers it", "Jobs that run without you"],
    },
  ],
  coachHeading: (firstName: string) => `Where ${firstName} usually starts`,
  playbooksHeading: "A playbook for every fix",
  playbooksText:
    "50 playbooks across the 10 areas. Each one sets out the problem, the steps, the template and the result to expect, so nothing rests on guesswork.",
  /** Velocity playbooks at levels 2 and 3, the ones most owners start with. */
  playbooks: [
    { name: "Cost Control", level: 2 },
    { name: "Sales & Conversion", level: 2 },
    { name: "Customer Experience", level: 2 },
    { name: "Profit & Pricing", level: 3 },
    { name: "Positioning", level: 3 },
    { name: "Customer Retention", level: 3 },
  ],
  multiplierHeading: "Small gains add up",
  multiplierText:
    "Improve five numbers by 10% each: leads, calls booked, sales closed, the average sale, and how often customers buy again.",
  multiplierResult: "61% more revenue",
  multiplierNote: "This shows the maths, not a promise. Your own numbers go in during month one.",
  result: "The business makes more, keeps more cash, and needs you less.",
};

export function phaseThree(length: ExplainerLength) {
  return {
    heading: "Build a business that runs without you.",
    lead: "This is where the business grows in value, because it no longer depends on you for everything.",
    areas: [
      { name: "Financials & Metrics", items: ["Dashboards your team keeps up to date", "Numbers you read in minutes"] },
      { name: "Infrastructure & Systems", items: ["Tools and processes that let you grow", "Automation where it saves time"] },
      { name: "Team & Leadership", items: ["The right people in the right seats", "Leaders who decide without you"] },
    ],
    keepHeading: "Built in, every 90 days",
    keep: ["We re-score the business, so you see the change", "We set the next 90-day plan", "We review the scoreboard every month"],
    stay:
      length === "ninety"
        ? "At day 90 we re-score. You can keep going with me, or run the plan yourself."
        : length === "blend"
          ? "After the first 90 days we go month to month, one 90-day plan at a time."
          : "This is where many owners keep working with me for years, one 90-day plan at a time.",
  };
}

export const coach = {
  label: "04 · Who you’ll work with",
  light: "You’ll work with",
  role: "Profit Coach",
  systemHeading: "Behind every session",
  systemName: "The Profit System",
  systemText:
    "50 playbooks across 10 areas, built from more than 25 business methods and Pam Woodford’s 45 years of coaching owners.",
  whyHeading: (firstName: string) => `Why ${firstName}`,
};

export function investment(length: ExplainerLength) {
  const then =
    length === "ninety"
      ? "For 90 days. Then you choose whether to keep going."
      : length === "blend"
        ? "For the first 90 days, then month to month."
        : "Month to month. Stop with 30 days’ notice.";
  const last =
    length === "ninety"
      ? { when: "After day 90", what: "Your choice" }
      : length === "blend"
        ? { when: "After that", what: "Month to month" }
        : { when: "After that", what: "Month to month" };
  return {
    label: "Your investment",
    then,
    scheduleHeading: "When you pay",
    months: ["Month 1", "Month 2", "Month 3"],
    last,
    paidHeading: "How you pay",
    paid: "Monthly in advance, by direct debit.",
    rhythmHeading: "How it runs",
    includedHeading: "Every month you get",
    included: [
      "Your sessions with me, and my eyes on your numbers",
      "Your BOSS Score, re-scored every 90 days",
      "Your 90-day plan and weekly scoreboard",
      "The Profit System playbooks for every fix",
    ],
    oneLine: "One price, and no surprises.",
  };
}

export function questions(input: {
  length: ExplainerLength;
  showFee: boolean;
  fee: string | null;
  rhythm: string | null;
  guarantee: string | null;
  whoIHelp: string | null;
}) {
  const howLong =
    input.length === "ninety"
      ? "We start with 90 days. At day 90 we re-score, and you decide whether to keep going."
      : input.length === "blend"
        ? "We start with 90 days. After that it’s month to month, with a new 90-day plan each quarter."
        : "As long as it’s useful. We work in 90-day plans and review at the end of each one.";
  return {
    label: "05 · Your questions",
    heading: "What owners ask before every call",
    items: [
      {
        q: "Is this consulting?",
        a: "Consultants do the work for you and leave. I work with you and your team, so the changes stay when I’m not in the room.",
      },
      {
        q: "How much time does it take?",
        a:
          input.rhythm ??
          "Weekly sessions in the first month, then two 90-minute sessions a month. Between sessions you make the changes we agreed.",
      },
      {
        q: "Do I need to take the BOSS Score first?",
        a: "It helps. It takes about 3 minutes and gives us a head start on the call. The full BOSS Diagnostic comes in month one.",
      },
      { q: "How long do owners work with you?", a: howLong },
      ...(input.whoIHelp
        ? [{ q: "Do you know businesses like mine?", a: `I work with ${lowerFirst(input.whoIHelp.replace(/\.$/, ""))}.` }]
        : []),
      {
        q: "Will my team be involved?",
        a: "As much as you want. Phases 2 and 3 work best when your managers join the sessions that cover their areas.",
      },
      {
        q: "What happens between sessions?",
        a: "You make the changes we agreed, and your scoreboard shows whether they’re working before we next speak.",
      },
      {
        q: "What does it cost?",
        a:
          input.showFee && input.fee
            ? `${input.fee}. One price, and no surprises.`
            : "We’ll cover it on the call, once we both know it fits.",
      },
      {
        q: "What if it isn’t right for us?",
        a:
          input.guarantee ??
          (input.length === "ninety"
            ? "Tell me. We review as we go, and at day 90 you decide."
            : "Tell me. We review every 90 days, and you can stop with 30 days’ notice."),
      },
    ],
  };
}

export const yourCall = {
  label: "06 · Before our call",
  heading: "How to get the most from our call",
  bringHeading: "Bring these with you",
  bring: (scoreLink: string | null) => [
    { title: "Your numbers", text: "Last year’s turnover and profit, roughly, and where cash sits today." },
    {
      title: "Your BOSS Score",
      text: scoreLink ? `About 3 minutes at ${scoreLink}.` : "About 3 minutes. Ask me for the link.",
    },
    { title: "The one thing", text: "The problem that costs you the most time or sleep." },
    { title: "Your questions", text: "Especially the awkward ones. Nothing is off the table." },
  ],
  practical: "Somewhere quiet, on a laptop, is ideal. Your calendar invite has the link.",
  nextHeading: "If we go ahead",
  next: [
    { title: "Your agreement and welcome pack", text: "Everything in writing, with your first sessions booked." },
    { title: "The full BOSS Diagnostic", text: "50 questions, about 10 minutes, before our first session." },
    { title: "Your BOSS review", text: "Phase 1 starts. You see the whole business on one page." },
  ],
};

function lowerFirst(text: string): string {
  return /^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

export const back = {
  qrHeading: "Take your BOSS Score before we speak",
  qrText: "About 3 minutes. Point your phone camera at the code.",
  heading: "See you on the call.",
  close: "Less chaos. More profit. Real freedom.",
  scoreLabel: "Take your BOSS Score",
  websiteLabel: "My website",
  linkedinLabel: "Find me on LinkedIn",
};
