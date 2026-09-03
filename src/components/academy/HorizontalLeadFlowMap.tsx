"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  HeartHandshake,
  Info,
  ListFilter,
  MailPlus,
  MessageSquareText,
  Newspaper,
  Repeat,
  Search,
  Share2,
  SlidersHorizontal,
  Target,
  X,
  Minus,
  Plus,
} from "lucide-react";
import "./funnelRange.css";

type FlowTone = "blue" | "sky" | "teal" | "green" | "amber" | "red" | "slate" | "muted";
type Anchor = "top" | "right" | "bottom" | "left";

type Point = {
  x: number;
  y: number;
};

type HoverExample = {
  label: string;
  body: string;
};

type DiagramNode = {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: "rect" | "diamond" | "pill";
  tone: FlowTone;
  /** Short overview. Use \n\n between paragraphs. */
  description: string;
  /** Optional callout under the overview (one strong line). */
  note?: string;
  /** Optional bullets — use only when a list is clearer than prose. */
  details?: string[];
  /** Optional expandable example / wording sample. */
  example?: HoverExample;
  dotted?: boolean;
  /** Classroom lesson path when this node has a matching lesson. */
  href?: string | null;
};

type DiagramConnection = {
  id: string;
  from: string;
  to: string;
  fromAnchor: Anchor;
  toAnchor: Anchor;
  tone?: FlowTone;
  label?: string;
  labelPoint?: Point;
  via?: Point[];
  fromPoint?: Point;
  toPoint?: Point;
  curve?: {
    control1: Point;
    control2: Point;
  };
  dotted?: boolean;
};

type SetupCard = {
  id: string;
  title: string;
  description: string;
  details?: string[];
  icon: LucideIcon;
  href: string | null;
};

type SetupRow = {
  id: string;
  step: number;
  title: string;
  purpose: string;
  cards: SetupCard[];
};

const CLASSROOM_BASE_ADMIN = "/admin/academy/classroom";
const CLASSROOM_BASE_COACH = "/coach/academy/classroom";

function classroomLesson(courseId: string, lessonId: string) {
  // Stored against the admin base; remapped to coach/admin at render time.
  return `${CLASSROOM_BASE_ADMIN}/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`;
}

function resolveClassroomHref(classroomBase: string, href: string | null | undefined): string | null {
  if (!href) return null;
  if (href.startsWith(CLASSROOM_BASE_ADMIN)) {
    return `${classroomBase}${href.slice(CLASSROOM_BASE_ADMIN.length)}`;
  }
  if (href.startsWith(CLASSROOM_BASE_COACH)) {
    return `${classroomBase}${href.slice(CLASSROOM_BASE_COACH.length)}`;
  }
  return href;
}

const LEFT = 4;
const COL_STEP = 217;
const RECT_W = 150;
const RECT_H = 52;
const DIAMOND = 106;
const NEW_CLIENT_W = 72;
const NEW_CLIENT_H = 52;
const TOP_Y = 16;
const MID_Y = 130;
const BOTTOM_Y = 306;
const VIEW_W = 1120;
const VIEW_H = 380;
/** Shared YES band: slightly above the old bottom-entry Won pill. */
const YES_LABEL_Y = Math.round((TOP_Y + NEW_CLIENT_H + MID_Y + DIAMOND / 2) / 2) - 12;
/** Sit NO a bit above the midpoint of the down-arrow. */
const NO_LABEL_Y = Math.round(MID_Y + DIAMOND + (BOTTOM_Y - MID_Y - DIAMOND) * 0.36) + 5;
const RETURN_CURVE_Y = Math.round(MID_Y + DIAMOND + (BOTTOM_Y - MID_Y - DIAMOND) * 0.5);

function colRectX(col: number) {
  return LEFT + col * COL_STEP;
}

function colDiamondX(col: number) {
  return LEFT + Math.round((RECT_W - DIAMOND) / 2) + col * COL_STEP;
}

function colCenterX(col: number) {
  return colRectX(col) + RECT_W / 2;
}

function yesViaX(fromCol: number) {
  const diamondRight = colDiamondX(fromCol) + DIAMOND;
  const nextRectLeft = colRectX(fromCol + 1);
  return Math.round((diamondRight + nextRectLeft) / 2);
}

function newClientX() {
  return colRectX(4) + RECT_W + 22;
}

function returnFromPoint(col: number): Point {
  // Leave near the left edge of the bottom card (not the column centre).
  return { x: colRectX(col) + 18, y: BOTTOM_Y };
}

function returnToPoint(col: number): Point {
  // Aim near the middle of the diamond's bottom-left edge, with a small gap so it doesn't touch.
  return {
    x: colDiamondX(col) + Math.round(DIAMOND * 0.28) - 8,
    y: MID_Y + Math.round(DIAMOND * 0.78) + 8,
  };
}

function returnCurveX(col: number) {
  // Soft left bow between the bottom card and the diamond.
  return colDiamondX(col) - 6;
}

type FunnelRates = {
  reachable: number;
  interested: number;
  booked: number;
  qualified: number;
  won: number;
};

type FunnelSettings = {
  clientsWanted: number;
  rates: FunnelRates;
};

type FunnelCounts = {
  prospects: number;
  reachable: number;
  interested: number;
  booked: number;
  qualified: number;
  clients: number;
};

const FUNNEL_STORAGE_KEY = "horizontal-lead-flow-funnel-v1";

const DEFAULT_FUNNEL: FunnelSettings = {
  clientsWanted: 1,
  rates: {
    reachable: 20,
    interested: 5,
    booked: 50,
    qualified: 80,
    won: 25,
  },
};

function clampRate(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function rateFraction(percent: number) {
  return Math.max(0.01, percent / 100);
}

/** Work backward from clients wanted using conversion rates.
 *  Each stage is derived from clients ÷ product of later rates (independent floats),
 *  then rounded **up** for display — so % tweaks move the list smoothly, while
 *  1 client @ 75% close still needs 2 value sessions (not 1).
 */
function computeFunnelCounts(settings: FunnelSettings): FunnelCounts {
  const { clientsWanted, rates } = settings;
  const clients = Math.max(1, Math.round(clientsWanted));
  const won = rateFraction(rates.won);
  const qualifiedRate = rateFraction(rates.qualified);
  const bookedRate = rateFraction(rates.booked);
  const interestedRate = rateFraction(rates.interested);
  const reachableRate = rateFraction(rates.reachable);

  const qualified = Math.max(clients, Math.ceil(clients / won - 1e-9));
  const booked = Math.max(clients, Math.ceil(clients / (won * qualifiedRate) - 1e-9));
  const interested = Math.max(clients, Math.ceil(clients / (won * qualifiedRate * bookedRate) - 1e-9));
  const reachable = Math.max(
    clients,
    Math.ceil(clients / (won * qualifiedRate * bookedRate * interestedRate) - 1e-9),
  );
  const prospects = Math.max(
    clients,
    Math.ceil(clients / (won * qualifiedRate * bookedRate * interestedRate * reachableRate) - 1e-9),
  );

  return {
    prospects,
    reachable: Math.max(reachable, interested),
    interested: Math.max(interested, booked),
    booked: Math.max(booked, qualified),
    qualified,
    clients,
  };
}

function formatFunnelCount(n: number) {
  return n.toLocaleString("en-US");
}

function yesLabel(count: number, rate: number) {
  return `YES · ${formatFunnelCount(count)} (${rate}%)`;
}

function loadFunnelSettings(): FunnelSettings {
  if (typeof window === "undefined") return DEFAULT_FUNNEL;
  try {
    const raw = window.localStorage.getItem(FUNNEL_STORAGE_KEY);
    if (!raw) return DEFAULT_FUNNEL;
    const parsed = JSON.parse(raw) as Partial<FunnelSettings>;
    return {
      clientsWanted: clampRate(Number(parsed.clientsWanted) || DEFAULT_FUNNEL.clientsWanted, 1, 50),
      rates: {
        reachable: clampRate(Number(parsed.rates?.reachable) || DEFAULT_FUNNEL.rates.reachable, 1, 90),
        interested: clampRate(Number(parsed.rates?.interested) || DEFAULT_FUNNEL.rates.interested, 1, 50),
        booked: clampRate(Number(parsed.rates?.booked) || DEFAULT_FUNNEL.rates.booked, 5, 95),
        qualified: clampRate(Number(parsed.rates?.qualified) || DEFAULT_FUNNEL.rates.qualified, 10, 95),
        won: clampRate(Number(parsed.rates?.won) || DEFAULT_FUNNEL.rates.won, 5, 90),
      },
    };
  } catch {
    return DEFAULT_FUNNEL;
  }
}

function saveFunnelSettings(settings: FunnelSettings) {
  try {
    window.localStorage.setItem(FUNNEL_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota / private mode
  }
}

const TONES: Record<FlowTone, { stroke: string; fill: string; text: string; line: string }> = {
  blue: {
    stroke: "#b9cbd4",
    fill: "#ffffff",
    text: "#475b67",
    line: "#6d9bb1",
  },
  sky: {
    stroke: "#b9cbd4",
    fill: "#ffffff",
    text: "#475b67",
    line: "#7faecc",
  },
  teal: {
    stroke: "#1ca0c2",
    fill: "#ffffff",
    text: "#087890",
    line: "#2f8f9f",
  },
  green: {
    stroke: "#3c9b70",
    fill: "#effaf3",
    text: "#24764f",
    line: "#3c9b70",
  },
  amber: {
    stroke: "#d19a22",
    fill: "#fffaf0",
    text: "#96620d",
    line: "#c79d4a",
  },
  red: {
    stroke: "#c2414e",
    fill: "#fff7f7",
    text: "#a9323d",
    line: "#c87982",
  },
  slate: {
    stroke: "#b9cbd4",
    fill: "#ffffff",
    text: "#475b67",
    line: "#9caeb9",
  },
  muted: {
    stroke: "#d2dae2",
    fill: "#f0f3f6",
    text: "#7a8794",
    line: "#c0cad1",
  },
};

const SETUP_ROWS: SetupRow[] = [
  {
    id: "choose-market",
    step: 1,
    title: "Find Your Ideal Clients",
    purpose: "Who you serve, the problem you solve, and where to find them.",
    cards: [
      {
        id: "ideal-client",
        title: "Choose Your\nIdeal Client",
        description: "Lock one core client so every message, list, and offer points the same way.",
        details: [
          "Write one sentence: industry, size (e.g. 10–50 staff), and revenue band.",
          "Pick where you have the strongest proof — career or client results.",
          "Check: real pain, growing market, findable on Sales Nav, and can pay.",
          "Commit ~6 months. Niche focuses marketing; it does not ban other clients.",
        ],
        icon: Target,
        href: classroomLesson("get-calls", "get-calls-ideal-clients-how-to-choose-your-core-client"),
      },
      {
        id: "problem",
        title: "Define the Problem\nYou Solve",
        description: "Capture the pains, outcomes, and language your ideal client already uses.",
        details: [
          "Map their current day vs ideal day in their words, not yours.",
          "Run the mentor rant: “How can I help?” then “What specifically?”",
          "Save pains, vocabulary, and openers for hooks and outreach.",
          "Package what they need inside what they already want.",
        ],
        icon: Search,
        href: classroomLesson("get-calls", "get-calls-ideal-clients-understand-your-ideal-client"),
      },
      {
        id: "prospect-list",
        title: "Build Your\nProspect List",
        description: "Build the pool from four sources, then refine until most names are good fits.",
        details: [
          "Base search: 2nd+3rd, geo, headcount, owner/CEO titles; exclude coaches.",
          "Narrow with company name + industry variants until ~8/10 look right.",
          "Add your network and existing relationships into the same wider pool.",
          "Blacklist bad fits and aim for ~600+ names so testing has enough volume.",
        ],
        icon: ListFilter,
        href: classroomLesson(
          "get-calls",
          "get-calls-ideal-clients-linkedin-sales-navigator-build-your-prospect-list",
        ),
      },
    ],
  },
  {
    id: "call-pipeline",
    step: 2,
    title: "Set Up Your Pipeline",
    purpose: "Profile, capture asset, and booking — ready before outreach.",
    cards: [
      {
        id: "profile-message",
        title: "Optimise Your\nLinkedIn Profile",
        description: "Make your market message obvious the moment someone lands on your profile.",
        details: [
          "Lead the headline with “{Industry} Profit/Business Coach | …” for previews.",
          "Add benefit, proof, and a clear CTA after the industry opener.",
          "Use a recent smiling headshot and an action banner; customise your URL.",
          "Write About to them: pain → mechanism → proof → next step.",
        ],
        icon: MessageSquareText,
        href: classroomLesson("get-calls", "get-calls-linkedin-optimization-set-up-your-linkedin-profile"),
      },
      {
        id: "lead-capture",
        title: "Create Your\nLead Capture",
        description: "Use BOSS as the simple next step that turns interest into a lead.",
        details: [
          "Use the BOSS Scorecard as the opt-in (~3 minutes, score out of 100).",
          "Put your assessment link in outreach and VIP replies.",
          "A completed scorecard counts as Interested — then book the review.",
          "One clear CTA only: diagnostic first, programme second.",
        ],
        icon: BadgeCheck,
        href: classroomLesson(
          "get-calls",
          "get-calls-boss-assessment-marketing-how-to-use-the-boss-score-assessment",
        ),
      },
      {
        id: "calendar",
        title: "Set Up Your\nCall Booking",
        description: "Make it easy for an Interested person to book a conversation.",
        details: [
          "One booking link for discovery/value — no back-and-forth on times.",
          "Reply goal is a calendar event, not “here’s my link” alone.",
          "Sync so Booked means it is actually on the diary.",
          "Add reminders and a simple no-show follow-up.",
        ],
        icon: CalendarDays,
        href: classroomLesson(
          "get-calls",
          "get-calls-calendar-setup-how-to-simplify-scheduling-meetins-with-prospects",
        ),
      },
    ],
  },
];

const AUTHORITY_ROW: SetupRow = {
  id: "build-authority",
  step: 4,
  title: "Build Authority",
  purpose: "Owned channels that warm prospects and support the outreach above.",
  cards: [
    {
      id: "newsletter",
      title: "Run Your\nNewsletter",
      description: "Keep showing up with a regular newsletter your ideal clients actually open.",
      details: [
        "Pick a cadence you can keep (weekly or bi-weekly) and protect it.",
        "Write to the locked ideal client’s pains — not generic business tips.",
        "One CTA per issue: scorecard, reply, or book a call.",
        "Treat it as trust for outreach, not your main client engine.",
      ],
      icon: Newspaper,
      href: null,
    },
    {
      id: "list-building",
      title: "Email Your\nList",
      description: "Stay in touch with the people who already opted in — not just collect names.",
      details: [
        "Email people who opted in (scorecard, content, events) on a rhythm.",
        "Lead with a useful next step, not a hard pitch every time.",
        "Segment hot (replied / booked) from cold so follow-up stays relevant.",
        "Same rule as social: one clear ask per email.",
      ],
      icon: MailPlus,
      href: null,
    },
    {
      id: "social-content",
      title: "Post on\nSocial",
      description: "Publish regularly on LinkedIn and social so trust and reach compound.",
      details: [
        "Post consistently on LinkedIn so Connector and VIP trust compounds.",
        "Talk about the problem you solve in their language.",
        "Use posts to warm cold outreach — commenters can enter the list.",
        "One CTA when you ask: scorecard, DM, or book — not a menu.",
      ],
      icon: Share2,
      href: null,
    },
  ],
};

const COACHING_ROW: SetupRow = {
  id: "coach-clients",
  step: 5,
  title: "Coach Clients",
  purpose:
    "Most of the business is getting clients in — this is the delivery that keeps them and creates results.",
  cards: [
    {
      id: "onboard",
      title: "Onboard New\nClients",
      description: "Set up payment, access, and first-session clarity so momentum starts immediately.",
      details: [
        "Take payment, confirm access, and set expectations before Session 1.",
        "Copy the client folder / tools so everything has a home.",
        "Invite them and share the alignment / prep materials.",
        "First goal: quick wins in the opening weeks, not a giant plan dump.",
      ],
      icon: ClipboardList,
      href: classroomLesson("coach-clients", "coach-clients-client-onboarding-how-to-setup-a-new-client"),
    },
    {
      id: "deliver-coaching",
      title: "Deliver\nCoaching",
      description: "Run sessions with a clear structure so clients feel progress every time.",
      details: [
        "Use the Coaching Sheet — start and end with a fixed structure.",
        "Early weeks: more frequent for quick wins; then settle into a rhythm.",
        "Typical cadence ~2×90 min/month once foundations are in.",
        "Sessions 1–4 often: systems → leverage → 3-year → 90-day.",
      ],
      icon: Repeat,
      href: classroomLesson(
        "coach-clients",
        "coach-clients-coachiing-session-structure-how-to-use-the-coaching-sheet-in-sessions",
      ),
    },
    {
      id: "retain-clients",
      title: "Retain &\nRenew",
      description: "Spot quiet clients early, rescue at risk, and keep the relationship compounding.",
      details: [
        "Watch for overwhelm, distraction, and lost ownership early.",
        "Rescue at-risk clients with a clear next win, not more content.",
        "Keep belief and results visible so renewal is earned, not hoped for.",
        "Quiet clients need a check-in before they drift — don’t wait for renew.",
      ],
      icon: HeartHandshake,
      href: classroomLesson("coach-clients", "coach-clients-retention-prevent-overwhelm"),
    },
  ],
};

const NODES: DiagramNode[] = [
  {
    id: "prospect-lists",
    title: "Prospect\nLists",
    x: colRectX(0),
    y: TOP_Y,
    width: RECT_W,
    height: RECT_H,
    shape: "rect",
    tone: "slate",
    description: "The wider pool of good-fit people before the active interest sequence.",
    details: [
      "Four sources: base search, narrowed ideal search, your network, existing relationships.",
      "Refine until most names look like a fit (~8/10 on sample pages).",
      "Aim for enough volume (~600+) so A/B testing has room to work.",
      "This list feeds Reachable? — only some will already be contactable.",
    ],
    href: classroomLesson(
      "get-calls",
      "get-calls-ideal-clients-linkedin-sales-navigator-build-your-prospect-list",
    ),
  },
  {
    id: "interest-sequence",
    title: "Interest\nSequence",
    x: colRectX(1),
    y: TOP_Y,
    width: RECT_W,
    height: RECT_H,
    shape: "rect",
    tone: "blue",
    description:
      "Also called the VIP 200 / Two Week Sequence. Four messages. Fourteen days. Each one has a different job.\n\n" +
      "Run reachable people through it (about 200). A positive reply or a completed BOSS Scorecard counts as Interested.",
    note: "If you only send message one, you will conclude LinkedIn is dead. Most meetings come from messages three and four.",
    details: [
      "New LinkedIn connection — they accept, then see your posts for ~48 hours (about 30–40% accept).",
      "Day 2 — Problem opener: name a problem they feel, reframe it, soft ask. Under 75 words. One question. No link, no calendar, no word “coaching”.",
      "Day 5 — Forgot to mention: one proof line, then hand over the asset (this is where the V in RSVP lands).",
      "Day 8 — The nudge: their first name and a question mark only. Highest reply of the four.",
      "Day 14 — Loose breakup: take the pressure off. This pulls replies nothing else pulls.",
    ],
    example: {
      label: "Show sample messages",
      body:
        "Day 2 — Hi Sarah, most owners running an engineering business your size tell me revenue is growing but profit isn’t following it. The issue is rarely sales — it’s that nobody has scored the nine areas underneath. Worth a chat? I’ve got two ideas for a business your size.\n\n" +
        "Day 5 — Forgot to mention, the last engineering owner I did this with found £180K in his pricing, not his pipeline. Would it help to see what we changed?\n\n" +
        "Day 8 — Sarah?\n\n" +
        "Day 14 — Totally get it if the timing’s off. When getting profit to move without adding headcount becomes the priority, I’d be glad to help. All the best either way.\n\n" +
        "Change every time: name, sector, size, which opener fits their profile. Leave the four-line shape alone when a version is working — put volume behind it.",
    },
    href: classroomLesson("get-calls", "get-calls-lead-generation-run-your-vip-nurture"),
  },
  {
    id: "reply-sequence",
    title: "Reply\nSequence",
    x: colRectX(2),
    y: TOP_Y,
    width: RECT_W,
    height: RECT_H,
    shape: "rect",
    tone: "blue",
    description: "Respond to an Interested person and move them toward a booked conversation.",
    details: [
      "Use the positive-reply or completed-scorecard reply path — don’t freestyle every time.",
      "Keep replies warm and short; aim for a clear next step (book), not another pitch.",
      "Start in Co-Pilot (approve drafts); Auto-Pilot only after messages are proven.",
      "Booked means a calendar event — a link alone does not count.",
    ],
    href: classroomLesson("get-calls", "get-calls-replying-to-leads-set-up-connector-co-pilot"),
  },
  {
    id: "discovery-call",
    title: "Discovery\nCall",
    x: colRectX(3),
    y: TOP_Y,
    width: RECT_W,
    height: RECT_H,
    shape: "rect",
    tone: "sky",
    description: "An optional short conversation before the Value Session.",
    details: [
      "Use only when fit or readiness is still unclear after booking.",
      "Confirm they match your ideal client and want help now.",
      "If they are already clear and qualified, skip straight to Value Session.",
      "Wrong fit here → Nurture / Revisit, not free ongoing advice.",
    ],
    href: classroomLesson("win-clients", "win-clients-book-and-run-value-sessions"),
  },
  {
    id: "value",
    title: "Value\nSession",
    x: colRectX(4),
    y: TOP_Y,
    width: RECT_W,
    height: RECT_H,
    shape: "rect",
    tone: "sky",
    description: "Show the gap and the route forward — then move to a decision.",
    details: [
      "This is the main conversion conversation after they qualify.",
      "Show the gap (BOSS Pro helps) and a clear route to close it.",
      "End by moving toward a yes/no — don’t leave them in “interesting chat.”",
      "Won? YES → New Client. NO → Follow-up in ~90 days, not endless chasing.",
    ],
    href: classroomLesson("win-clients", "win-clients-book-and-run-value-sessions"),
  },
  {
    id: "reachable",
    title: "Reachable?",
    x: colDiamondX(0),
    y: MID_Y,
    width: DIAMOND,
    height: DIAMOND,
    shape: "diamond",
    tone: "amber",
    description: "Do we already have a legitimate way to contact this person?",
    details: [
      "YES: phone, email, or LinkedIn DM (already connected / 1st degree).",
      "NO: run Connector Campaign first — never scrape emails.",
      "Only reachable people enter the Interest Sequence.",
      "This gate protects deliverability and keeps outreach legitimate.",
    ],
  },
  {
    id: "interested",
    title: "Interested?",
    x: colDiamondX(1),
    y: MID_Y,
    width: DIAMOND,
    height: DIAMOND,
    shape: "diamond",
    tone: "amber",
    description: "Is there a positive reply or completed BOSS Scorecard?",
    details: [
      "Interested is the KPI to watch — protect this number weekly.",
      "Count positive replies and completed scorecards unless they said no.",
      "Not right now → Nurture List with a revisit date.",
      "Not interested → stop. No response → park on nurture longer-term.",
    ],
  },
  {
    id: "booked",
    title: "Booked?",
    x: colDiamondX(2),
    y: MID_Y,
    width: DIAMOND,
    height: DIAMOND,
    shape: "diamond",
    tone: "amber",
    description: "Has the reply sequence led to a booked conversation?",
    details: [
      "YES: Discovery (optional) or straight into qualification / Value Session.",
      "NO: Personal Follow-up, then try booking again.",
      "A booking link alone is not enough — it must be on the calendar.",
      "This is where Win Clients starts to take over from Lead Generation.",
    ],
  },
  {
    id: "qualified",
    title: "Qualified?",
    x: colDiamondX(3),
    y: MID_Y,
    width: DIAMOND,
    height: DIAMOND,
    shape: "diamond",
    tone: "amber",
    description: "Is this the right person for a Value Session?",
    details: [
      "Use the booked conversation to confirm fit and readiness.",
      "YES: book or run the Value Session.",
      "NO: Nurture / Revisit when timing or fit changes.",
      "Qualify hard — wrong-fit Value Sessions waste both sides’ time.",
    ],
  },
  {
    id: "won",
    title: "Won?",
    x: colDiamondX(4),
    y: MID_Y,
    width: DIAMOND,
    height: DIAMOND,
    shape: "diamond",
    tone: "amber",
    description: "Has the person decided to become a client?",
    details: [
      "YES: take payment, confirm onboarding, and start coaching.",
      "NO: schedule a later follow-up (~90 days) instead of chasing cold.",
      "A clear no is healthier than an endless maybe.",
      "Won is the bridge into Coach Clients delivery.",
    ],
  },
  {
    id: "connector-campaign",
    title: "Connector\nCampaign",
    x: colRectX(0),
    y: BOTTOM_Y,
    width: RECT_W,
    height: RECT_H,
    shape: "rect",
    tone: "blue",
    description: "Create a legitimate LinkedIn connection so they become Reachable.",
    details: [
      "Paste your Sales Nav list into Connector and run the proven sequence.",
      "Typical path: connect → Msg1 (~30m) → day1 → day2 → day4 → 2-week close.",
      "Personalise connection + Msg1 with industry, pain/desire, and one proof.",
      "Do not scrape emails — connection first, then Interest Sequence.",
    ],
    href: classroomLesson("get-calls", "get-calls-lead-generation-get-started-with-connector"),
  },
  {
    id: "nurture-list",
    title: "Nurture\nList",
    x: colRectX(1),
    y: BOTTOM_Y,
    width: RECT_W,
    height: RECT_H,
    shape: "rect",
    tone: "muted",
    description: "Park people who are not ready — stay useful without chasing.",
    details: [
      "“Not right now”: note a revisit date and keep light value touchpoints.",
      "No response: park longer-term instead of burning the relationship.",
      "Keep them on VIP / newsletter / social so trust compounds quietly.",
      "When timing changes, pull them back into Interest or Reply Sequence.",
    ],
    href: classroomLesson("get-calls", "get-calls-lead-generation-run-your-vip-nurture"),
  },
  {
    id: "personal-follow-up",
    title: "Personal\nFollow-up",
    x: colRectX(2),
    y: BOTTOM_Y,
    width: RECT_W,
    height: RECT_H,
    shape: "rect",
    tone: "muted",
    description: "Recover when interest was there but the booking did not happen.",
    details: [
      "Use the personal follow-up sequence — don’t invent a new pitch each time.",
      "Goal is a clear next step (book or honest “not now”), not pressure.",
      "Stay short and human; reference the prior interest.",
      "If they still won’t book, move them to nurture with a revisit date.",
    ],
    href: classroomLesson("get-calls", "get-calls-replying-to-leads-set-up-connector-co-pilot"),
  },
  {
    id: "nurture-revisit",
    title: "Nurture /\nRevisit",
    x: colRectX(3),
    y: BOTTOM_Y,
    width: RECT_W,
    height: RECT_H,
    shape: "rect",
    tone: "muted",
    description: "Not ready for a Value Session yet — keep the door open.",
    details: [
      "Wrong timing or soft fit after Discovery / qualification lands here.",
      "Stay useful via nurture; set a date to check readiness again.",
      "Do not keep giving free Value Sessions to unqualified prospects.",
      "When fit returns, re-enter at Qualified? / Value Session.",
    ],
    href: classroomLesson("get-calls", "get-calls-lead-generation-run-your-vip-nurture"),
  },
  {
    id: "won-follow-up",
    title: "Follow-up\nin 90 Days",
    x: colRectX(4),
    y: BOTTOM_Y,
    width: RECT_W,
    height: RECT_H,
    shape: "rect",
    tone: "muted",
    description: "A later follow-up for someone who has not bought yet.",
    details: [
      "After a clear no or delay, diary a ~90-day check-in.",
      "Come back with value and a clean ask — not weekly chasing.",
      "If still no, leave the relationship warm and stop pushing.",
      "Protects your time and keeps the door open for later timing.",
    ],
  },
  {
    id: "new-client",
    title: "New\nClient",
    x: newClientX(),
    y: TOP_Y,
    width: NEW_CLIENT_W,
    height: NEW_CLIENT_H,
    shape: "rect",
    tone: "green",
    description: "Payment cleared — start onboarding and coaching immediately.",
    details: [
      "Take payment, confirm access, and set Session 1 expectations.",
      "Get tools / folder / invite set up the same day if you can.",
      "First weeks: quick wins so belief and momentum stick.",
      "This is the handoff into Coach Clients (step 5).",
    ],
    href: classroomLesson("coach-clients", "coach-clients-client-onboarding-how-to-setup-a-new-client"),
  },
];


const CONNECTIONS: DiagramConnection[] = [
  {
    id: "list-reachable",
    from: "prospect-lists",
    to: "reachable",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "slate",
    labelPoint: {
      x: colCenterX(0),
      y: Math.round((TOP_Y + RECT_H + MID_Y) / 2) - 5,
    },
  },
  {
    id: "reachable-yes",
    from: "reachable",
    to: "interest-sequence",
    fromAnchor: "right",
    toAnchor: "left",
    tone: "teal",
    labelPoint: { x: yesViaX(0), y: YES_LABEL_Y },
    via: [
      { x: yesViaX(0), y: MID_Y + DIAMOND / 2 },
      { x: yesViaX(0), y: TOP_Y + RECT_H / 2 },
    ],
  },
  {
    id: "reachable-no",
    from: "reachable",
    to: "connector-campaign",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "slate",
    label: "NO",
    labelPoint: { x: colCenterX(0), y: NO_LABEL_Y },
  },
  {
    id: "connector-reachable",
    from: "connector-campaign",
    to: "reachable",
    fromAnchor: "top",
    toAnchor: "bottom",
    tone: "muted",
    fromPoint: returnFromPoint(0),
    toPoint: returnToPoint(0),
    curve: {
      control1: { x: returnCurveX(0), y: RETURN_CURVE_Y },
      control2: { x: returnCurveX(0), y: RETURN_CURVE_Y },
    },
    dotted: true,
  },
  {
    id: "sequence-interested",
    from: "interest-sequence",
    to: "interested",
    fromAnchor: "bottom",
    toAnchor: "top",
  },
  {
    id: "interested-yes",
    from: "interested",
    to: "reply-sequence",
    fromAnchor: "right",
    toAnchor: "left",
    tone: "teal",
    labelPoint: { x: yesViaX(1), y: YES_LABEL_Y },
    via: [
      { x: yesViaX(1), y: MID_Y + DIAMOND / 2 },
      { x: yesViaX(1), y: TOP_Y + RECT_H / 2 },
    ],
  },
  {
    id: "interested-no",
    from: "interested",
    to: "nurture-list",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "slate",
    label: "NO",
    labelPoint: { x: colCenterX(1), y: NO_LABEL_Y },
  },
  {
    id: "nurture-interested",
    from: "nurture-list",
    to: "interested",
    fromAnchor: "top",
    toAnchor: "bottom",
    tone: "muted",
    fromPoint: returnFromPoint(1),
    toPoint: returnToPoint(1),
    curve: {
      control1: { x: returnCurveX(1), y: RETURN_CURVE_Y },
      control2: { x: returnCurveX(1), y: RETURN_CURVE_Y },
    },
    dotted: true,
  },
  {
    id: "reply-booked",
    from: "reply-sequence",
    to: "booked",
    fromAnchor: "bottom",
    toAnchor: "top",
  },
  {
    id: "booked-yes",
    from: "booked",
    to: "discovery-call",
    fromAnchor: "right",
    toAnchor: "left",
    tone: "teal",
    labelPoint: { x: yesViaX(2), y: YES_LABEL_Y },
    via: [
      { x: yesViaX(2), y: MID_Y + DIAMOND / 2 },
      { x: yesViaX(2), y: TOP_Y + RECT_H / 2 },
    ],
  },
  {
    id: "booked-no",
    from: "booked",
    to: "personal-follow-up",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "slate",
    label: "NO",
    labelPoint: { x: colCenterX(2), y: NO_LABEL_Y },
  },
  {
    id: "follow-up-booked",
    from: "personal-follow-up",
    to: "booked",
    fromAnchor: "top",
    toAnchor: "bottom",
    tone: "muted",
    fromPoint: returnFromPoint(2),
    toPoint: returnToPoint(2),
    curve: {
      control1: { x: returnCurveX(2), y: RETURN_CURVE_Y },
      control2: { x: returnCurveX(2), y: RETURN_CURVE_Y },
    },
    dotted: true,
  },
  {
    id: "discovery-qualified",
    from: "discovery-call",
    to: "qualified",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "teal",
  },
  {
    id: "qualified-yes",
    from: "qualified",
    to: "value",
    fromAnchor: "right",
    toAnchor: "left",
    tone: "teal",
    labelPoint: { x: yesViaX(3), y: YES_LABEL_Y },
    via: [
      { x: yesViaX(3), y: MID_Y + DIAMOND / 2 },
      { x: yesViaX(3), y: TOP_Y + RECT_H / 2 },
    ],
  },
  {
    id: "qualified-no",
    from: "qualified",
    to: "nurture-revisit",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "slate",
    label: "NO",
    labelPoint: { x: colCenterX(3), y: NO_LABEL_Y },
  },
  {
    id: "revisit-qualified",
    from: "nurture-revisit",
    to: "qualified",
    fromAnchor: "top",
    toAnchor: "bottom",
    tone: "muted",
    fromPoint: returnFromPoint(3),
    toPoint: returnToPoint(3),
    curve: {
      control1: { x: returnCurveX(3), y: RETURN_CURVE_Y },
      control2: { x: returnCurveX(3), y: RETURN_CURVE_Y },
    },
    dotted: true,
  },
  {
    id: "value-won",
    from: "value",
    to: "won",
    fromAnchor: "bottom",
    toAnchor: "top",
  },
  {
    id: "won-yes",
    from: "won",
    to: "new-client",
    fromAnchor: "right",
    toAnchor: "bottom",
    tone: "teal",
    labelPoint: {
      x: newClientX() + NEW_CLIENT_W / 2,
      y: YES_LABEL_Y,
    },
    via: [{ x: newClientX() + NEW_CLIENT_W / 2, y: MID_Y + DIAMOND / 2 }],
  },
  {
    id: "won-no",
    from: "won",
    to: "won-follow-up",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "slate",
    label: "NO",
    labelPoint: { x: colCenterX(4), y: NO_LABEL_Y },
  },
  {
    id: "follow-up-won",
    from: "won-follow-up",
    to: "won",
    fromAnchor: "top",
    toAnchor: "bottom",
    tone: "muted",
    fromPoint: returnFromPoint(4),
    toPoint: returnToPoint(4),
    curve: {
      control1: { x: returnCurveX(4), y: RETURN_CURVE_Y },
      control2: { x: returnCurveX(4), y: RETURN_CURVE_Y },
    },
    dotted: true,
  },
];

const NODE_BY_ID = Object.fromEntries(NODES.map((node) => [node.id, node])) as Record<string, DiagramNode>;

const SECTION_SHELL =
  "rounded-xl border border-white/80 bg-white/45 shadow-[0_10px_32px_rgba(15,23,42,0.08)]";

export function HorizontalLeadFlowMap({
  classroomBase = CLASSROOM_BASE_ADMIN,
}: {
  classroomBase?: string;
}) {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [funnelOpen, setFunnelOpen] = useState(false);
  const [funnel, setFunnel] = useState<FunnelSettings>(DEFAULT_FUNNEL);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counts = useMemo(() => computeFunnelCounts(funnel), [funnel]);

  const setupRows = useMemo(
    () =>
      SETUP_ROWS.map((row) => ({
        ...row,
        cards: row.cards.map((card) => ({
          ...card,
          href: resolveClassroomHref(classroomBase, card.href),
        })),
      })),
    [classroomBase],
  );

  const authorityRow = useMemo(
    () => ({
      ...AUTHORITY_ROW,
      cards: AUTHORITY_ROW.cards.map((card) => ({
        ...card,
        href: resolveClassroomHref(classroomBase, card.href),
      })),
    }),
    [classroomBase],
  );

  const coachingRow = useMemo(
    () => ({
      ...COACHING_ROW,
      cards: COACHING_ROW.cards.map((card) => ({
        ...card,
        href: resolveClassroomHref(classroomBase, card.href),
      })),
    }),
    [classroomBase],
  );

  const nodes = useMemo(
    () =>
      NODES.map((node) => ({
        ...node,
        href: resolveClassroomHref(classroomBase, node.href),
      })),
    [classroomBase],
  );

  const nodeById = useMemo(
    () => Object.fromEntries(nodes.map((node) => [node.id, node])) as Record<string, DiagramNode>,
    [nodes],
  );

  const activeNode = activeNodeId ? nodeById[activeNodeId] : null;
  const hoveredNode = hoveredNodeId ? nodeById[hoveredNodeId] : null;

  /** Gap between Booked (col 2) and Discovery / Qualified (col 3). */
  const connections = useMemo(() => {
    const labels: Record<string, string> = {
      "list-reachable": `~${formatFunnelCount(counts.prospects)}`,
      "reachable-yes": yesLabel(counts.reachable, funnel.rates.reachable),
      "interested-yes": yesLabel(counts.interested, funnel.rates.interested),
      "booked-yes": yesLabel(counts.booked, funnel.rates.booked),
      "qualified-yes": yesLabel(counts.qualified, funnel.rates.qualified),
      "won-yes": yesLabel(counts.clients, funnel.rates.won),
    };
    return CONNECTIONS.map((connection) =>
      labels[connection.id] ? { ...connection, label: labels[connection.id] } : connection,
    );
  }, [counts, funnel.rates]);

  useEffect(() => {
    setFunnel(loadFunnelSettings());
  }, []);

  useEffect(() => {
    saveFunnelSettings(funnel);
  }, [funnel]);

  function updateClientsWanted(value: number) {
    setFunnel((current) => ({ ...current, clientsWanted: clampRate(value, 1, 50) }));
  }

  function updateRate(key: keyof FunnelRates, value: number) {
    setFunnel((current) => ({
      ...current,
      rates: { ...current.rates, [key]: value },
    }));
  }

  function resetFunnel() {
    setFunnel(DEFAULT_FUNNEL);
  }

  function selectNode(nodeId: string) {
    setActiveNodeId((current) => (current === nodeId ? null : nodeId));
  }

  function showHoverCard(nodeId: string) {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
    setHoveredNodeId(nodeId);
  }

  function hideHoverCard() {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
    }
    hoverTimeout.current = setTimeout(() => {
      setHoveredNodeId(null);
      hoverTimeout.current = null;
    }, 120);
  }

  function keepHoverCard() {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
  }

  function handleNodeKeyDown(event: KeyboardEvent<SVGGElement>, nodeId: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectNode(nodeId);
    }
  }

  return (
    <div className="flex w-full flex-col gap-4 pb-1 pt-2.5">
      <section
        aria-label="Get Calls setup"
        className="relative z-20 grid grid-cols-1 gap-4 overflow-visible lg:grid-cols-2 lg:gap-5"
      >
        {setupRows.map((row) => (
          <SetupRowView key={row.id} row={row} />
        ))}
      </section>

      <section
        aria-label="Lead generation and win clients"
        className={`${SECTION_SHELL} relative overflow-visible ${hoveredNode ? "z-40" : ""}`}
      >
        <StepSectionHeader
          step={3}
          title="Lead Generation & Win Clients"
          purpose="Lead generation runs through booked conversations; Win Clients starts at discovery and value sessions."
          actions={
            <button
              type="button"
              onClick={() => setFunnelOpen((open) => !open)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 ${
                funnelOpen
                  ? "bg-[#0c5290] text-white"
                  : "bg-[#0c5290]/12 text-[#063056] hover:bg-[#0c5290]/20"
              }`}
              aria-expanded={funnelOpen}
              aria-controls="lead-flow-funnel-panel"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Customise funnel
            </button>
          }
        />
        {funnelOpen ? (
          <FunnelCustomisePanel
            settings={funnel}
            onClientsChange={updateClientsWanted}
            onRateChange={updateRate}
            onReset={resetFunnel}
            onClose={() => setFunnelOpen(false)}
          />
        ) : null}
        <div className="relative overflow-visible px-3.5 py-1.5">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            role="img"
            aria-labelledby="horizontal-flow-map-title horizontal-flow-map-description"
            className="h-auto w-full"
          >
            <title id="horizontal-flow-map-title">Lead generation and win clients workflow</title>
            <desc id="horizontal-flow-map-description">
              A horizontal workflow from prospect lists through reachability, interest generation,
              reply handling, qualification, value session, and new client.
            </desc>
            <defs>
              <filter id="horizontal-flow-shadow" x="-20%" y="-30%" width="140%" height="160%">
                <feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#15324f" floodOpacity="0.11" />
              </filter>
              <marker id="horizontal-arrow-blue" markerHeight="6" markerWidth="6" refX="5.5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#5b7d99" />
              </marker>
              <marker id="horizontal-arrow-teal" markerHeight="6" markerWidth="6" refX="5.5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#087890" />
              </marker>
              <marker id="horizontal-arrow-sky" markerHeight="6" markerWidth="6" refX="5.5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#287fc1" />
              </marker>
              <marker id="horizontal-arrow-slate" markerHeight="6" markerWidth="6" refX="5.5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#7b8b98" />
              </marker>
              <marker id="horizontal-arrow-muted" markerHeight="6" markerWidth="6" refX="5.5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#c0cad1" />
              </marker>
            </defs>
            <g aria-hidden="true">
              {connections.map((connection) => (
                <HorizontalConnectionLine key={connection.id} connection={connection} />
              ))}
            </g>
            {nodes.map((node) => (
              <HorizontalDiagramNode
                key={node.id}
                node={node}
                active={activeNodeId === node.id}
                onSelect={() => selectNode(node.id)}
                onKeyDown={(event) => handleNodeKeyDown(event, node.id)}
                onHoverStart={() => showHoverCard(node.id)}
                onHoverEnd={hideHoverCard}
              />
            ))}
          </svg>
          {hoveredNode ? (
            <HorizontalHoverCard
              node={hoveredNode}
              onMouseEnter={keepHoverCard}
              onMouseLeave={hideHoverCard}
            />
          ) : null}
        </div>
        {activeNode ? <HorizontalNodeDetails node={activeNode} onClose={() => setActiveNodeId(null)} /> : null}
      </section>

      <section
        aria-label="Authority and coaching"
        className="relative z-30 grid grid-cols-1 gap-4 overflow-visible lg:grid-cols-2 lg:gap-5"
      >
        <SetupRowView row={authorityRow} hoverPlacement="above" />
        <SetupRowView row={coachingRow} hoverPlacement="above" />
      </section>
    </div>
  );
}

function FunnelCustomisePanel({
  settings,
  onClientsChange,
  onRateChange,
  onReset,
  onClose,
}: {
  settings: FunnelSettings;
  onClientsChange: (value: number) => void;
  onRateChange: (key: keyof FunnelRates, value: number) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const rateRows: Array<{
    key: keyof FunnelRates;
    label: string;
    min: number;
    max: number;
  }> = [
    { key: "reachable", label: "Reachable", min: 1, max: 90 },
    { key: "interested", label: "Interested", min: 1, max: 50 },
    { key: "booked", label: "Booked", min: 5, max: 95 },
    { key: "qualified", label: "Qualified", min: 10, max: 95 },
    { key: "won", label: "Won", min: 5, max: 90 },
  ];

  return (
    <div
      id="lead-flow-funnel-panel"
      className="border-b border-[#0c5290]/20 bg-white/70 px-3.5 py-3.5 backdrop-blur-[1px]"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#063056]">Customise funnel</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">
            Conversion rates update the stage counts on the map.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close funnel settings"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex items-stretch gap-2.5">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2.5 self-stretch sm:grid-cols-3 lg:grid-cols-5 lg:grid-rows-1">
          {rateRows.map((row) => (
            <div
              key={row.key}
              className="flex h-full flex-col justify-center rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-sm"
            >
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={`funnel-rate-${row.key}`} className="text-[14px] font-semibold text-slate-700">
                  {row.label}
                </label>
                <span className="text-sm font-semibold tabular-nums text-[#087890]">
                  {settings.rates[row.key]}%
                </span>
              </div>
              <FunnelRangeInput
                id={`funnel-rate-${row.key}`}
                min={row.min}
                max={row.max}
                value={settings.rates[row.key]}
                fill="#3f9aa8"
                onChange={(value) => onRateChange(row.key, clampRate(value, row.min, row.max))}
              />
            </div>
          ))}
        </div>

        <ClientsWantedControl value={settings.clientsWanted} onChange={onClientsChange} />
      </div>
    </div>
  );
}

function ClientsWantedControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit(raw: string) {
    const parsed = Number.parseInt(raw.replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    onChange(clampRate(parsed, 1, 50));
  }

  return (
    <div className="flex w-[6.5rem] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-[#0c5290]/25 bg-[#0c5290]/[0.06] px-1.5 py-2 shadow-sm">
      <label
        htmlFor="funnel-clients-wanted"
        className="whitespace-nowrap text-[12px] font-semibold tracking-tight text-slate-700"
      >
        New clients
      </label>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onChange(clampRate(value - 1, 1, 50))}
          disabled={value <= 1}
          className="grid h-6 w-6 place-items-center rounded-md text-[#0c5290] transition hover:bg-[#0c5290]/12 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Decrease new clients"
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
        </button>
        <input
          id="funnel-clients-wanted"
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          className="h-7 w-9 rounded-md border border-transparent bg-white text-center text-sm font-semibold tabular-nums text-[#0c5290] outline-none ring-[#0c5290]/30 focus:border-[#0c5290]/30 focus:ring-2"
          aria-label="New clients wanted"
        />
        <button
          type="button"
          onClick={() => onChange(clampRate(value + 1, 1, 50))}
          disabled={value >= 50}
          className="grid h-6 w-6 place-items-center rounded-md text-[#0c5290] transition hover:bg-[#0c5290]/12 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Increase new clients"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function FunnelRangeInput({
  id,
  min,
  max,
  value,
  fill,
  onChange,
}: {
  id: string;
  min: number;
  max: number;
  value: number;
  fill: string;
  onChange: (value: number) => void;
}) {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  const track = `linear-gradient(to right, ${fill} 0%, ${fill} ${pct}%, #e8eef3 ${pct}%, #e8eef3 100%)`;

  return (
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={1}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="funnel-range mt-0.5 w-full"
      style={{ ["--funnel-track" as string]: track, ["--funnel-thumb" as string]: fill }}
    />
  );
}

function StepSectionHeader({
  step,
  title,
  purpose,
  actions,
}: {
  step: number;
  title: string;
  purpose: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-t-xl border-b border-[#0c5290]/35 bg-[#0c5290]/[0.28] px-3.5 py-2.5 backdrop-blur-[1px]">
      <span
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#0c5290] text-[11px] font-bold text-white shadow-sm"
        aria-hidden
      >
        {step}
      </span>
      <h2 className="min-w-0 flex-1 text-sm font-semibold tracking-[-0.01em] text-[#063056]">
        {title}
      </h2>
      {actions}
      <button
        type="button"
        className="group relative grid h-6 w-6 shrink-0 place-items-center rounded-full text-[#0c5290]/65 transition hover:bg-[#0c5290]/15 hover:text-[#063056] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
        aria-label={purpose}
        title={purpose}
      >
        <Info className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        <span
          role="tooltip"
          className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium leading-4 text-slate-600 shadow-lg group-hover:block group-focus-within:block"
        >
          {purpose}
        </span>
      </button>
    </div>
  );
}

function SetupRowView({
  row,
  hoverPlacement = "below",
}: {
  row: SetupRow;
  hoverPlacement?: "above" | "below";
}) {
  return (
    <div className={`${SECTION_SHELL} overflow-visible`}>
      <StepSectionHeader step={row.step} title={row.title} purpose={row.purpose} />
      <div className="grid grid-cols-3 gap-3 px-3.5 py-4">
        {row.cards.map((card, index) => {
          const Icon = card.icon;
          const titleLines = card.title.split("\n");
          const cardClassName =
            "group relative z-0 flex items-start gap-2 rounded-lg border border-slate-200/70 bg-white px-2.5 py-3 shadow-[0_4px_14px_rgba(15,23,42,0.10)] transition hover:z-40 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_22px_rgba(15,23,42,0.12)] focus:outline-none focus-visible:z-40 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2";
          const content = (
            <>
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#0c5290]/10 text-[#0c5290]">
                <Icon className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
              </span>
              <span className="min-w-0 text-[13px] font-semibold leading-[1.25] text-slate-800">
                {titleLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
              <SetupCardHover card={card} placement={hoverPlacement} columnIndex={index} />
            </>
          );

          if (!card.href) {
            return (
              <div key={card.id} className={cardClassName} aria-disabled="true">
                {content}
              </div>
            );
          }

          return (
            <Link key={card.id} href={card.href} className={cardClassName}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function SetupCardHover({
  card,
  placement,
  columnIndex,
}: {
  card: SetupCard;
  placement: "above" | "below";
  columnIndex: number;
}) {
  const title = card.title.replace(/\n/g, " ");
  const vertical =
    placement === "above" ? "bottom-full mb-2.5" : "top-full mt-2.5";
  const horizontal =
    columnIndex === 2
      ? "right-0"
      : columnIndex === 1
        ? "left-1/2 -translate-x-1/2"
        : "left-0";

  return (
    <span
      className={`pointer-events-none absolute ${vertical} ${horizontal} z-40 hidden w-[min(22rem,78vw)] rounded-2xl border border-slate-200/90 bg-white/95 p-5 text-left shadow-[0_18px_50px_rgba(21,50,79,0.18)] backdrop-blur-md group-hover:block group-focus-within:block`}
      role="tooltip"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-[22px] font-semibold leading-snug text-slate-900">{title}</span>
        {card.href ? (
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-[#0c5290] px-2.5 py-1 text-[11px] font-semibold text-white">
            Open lesson
            <ArrowRight className="h-3 w-3" aria-hidden />
          </span>
        ) : null}
      </span>
      <span className="mt-2.5 block h-1 w-12 rounded-full bg-gradient-to-r from-[#0c5290] to-[#1a8fd4]" />
      <span className="mt-3 block">
        <HoverProse text={card.description} />
      </span>
      {card.details && card.details.length > 0 ? <HoverDetailsList details={card.details} /> : null}
      {!card.href ? (
        <span className="mt-3.5 block text-sm font-medium text-slate-400">Lesson coming soon.</span>
      ) : null}
    </span>
  );
}

function anchorPoint(node: DiagramNode, anchor: Anchor): Point {
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;

  switch (anchor) {
    case "top":
      return { x: centerX, y: node.y };
    case "right":
      return { x: node.x + node.width, y: centerY };
    case "bottom":
      return { x: centerX, y: node.y + node.height };
    case "left":
      return { x: node.x, y: centerY };
  }
}

function HorizontalConnectionLine({ connection }: { connection: DiagramConnection }) {
  const from = NODE_BY_ID[connection.from];
  const to = NODE_BY_ID[connection.to];
  const start = connection.fromPoint ?? anchorPoint(from, connection.fromAnchor);
  const end = connection.toPoint ?? anchorPoint(to, connection.toAnchor);
  const tone = TONES[connection.tone ?? "slate"];
  const points = [start, ...(connection.via ?? []), end];
  const path = connection.curve
    ? `M ${start.x},${start.y} C ${connection.curve.control1.x},${connection.curve.control1.y} ${connection.curve.control2.x},${connection.curve.control2.y} ${end.x},${end.y}`
    : points.map((point) => `${point.x},${point.y}`).join(" ");
  const marker =
    connection.tone === "teal"
      ? "url(#horizontal-arrow-teal)"
      : connection.tone === "sky"
        ? "url(#horizontal-arrow-sky)"
        : connection.tone === "blue"
          ? "url(#horizontal-arrow-blue)"
          : connection.tone === "muted"
            ? "url(#horizontal-arrow-muted)"
            : "url(#horizontal-arrow-slate)";
  const sharedProps = {
    fill: "none",
    stroke: tone.line,
    strokeDasharray: connection.dotted || (connection.tone === "slate" && connection.label === "NO") ? "5 4" : undefined,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: connection.tone === "teal" || connection.tone === "green" ? 2.6 : 2.1,
    markerEnd: marker,
  };

  return (
    <g>
      {connection.curve ? <path d={path} {...sharedProps} /> : <polyline points={path} {...sharedProps} />}
      {connection.label && connection.labelPoint ? (
        <HorizontalFlowLabel
          point={connection.labelPoint}
          text={connection.label}
          tone={connection.label.startsWith("YES") ? "teal" : connection.label === "NO" ? "red" : "slate"}
        />
      ) : null}
    </g>
  );
}

function HorizontalDiagramNode({
  node,
  active,
  onSelect,
  onKeyDown,
  onHoverStart,
  onHoverEnd,
}: {
  node: DiagramNode;
  active: boolean;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<SVGGElement>) => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}) {
  const tone = TONES[node.tone];
  const titleLines = node.title.split("\n");
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;
  const lineHeight = node.shape === "diamond" ? 16 : 17;
  const firstLineY = centerY + 4 - ((titleLines.length - 1) * lineHeight) / 2;

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${node.title.replace("\n", " ")}: ${node.description}`}
      aria-pressed={active}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocus={onHoverStart}
      onBlur={onHoverEnd}
      className="cursor-pointer outline-none"
    >
      <title>{node.description}</title>
      {node.shape === "diamond" ? (
        <polygon
          points={`${centerX},${node.y} ${node.x + node.width},${centerY} ${centerX},${node.y + node.height} ${node.x},${centerY}`}
          fill={tone.fill}
          stroke={tone.stroke}
          fillOpacity={node.tone === "muted" ? 0.88 : 0.94}
          strokeDasharray={node.dotted ? "5 4" : undefined}
          strokeOpacity={node.tone === "muted" ? 0.55 : 0.82}
          strokeWidth={active ? 2 : 1.25}
          filter={node.tone === "muted" ? undefined : "url(#horizontal-flow-shadow)"}
        />
      ) : (
        <rect
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          rx={node.shape === "pill" ? node.height / 2 : 10}
          fill={tone.fill}
          stroke={tone.stroke}
          fillOpacity={node.tone === "muted" ? 0.88 : 0.94}
          strokeDasharray={node.dotted ? "5 4" : undefined}
          strokeOpacity={node.tone === "muted" ? 0.55 : 0.82}
          strokeWidth={active ? 2 : 1.25}
          filter={node.tone === "muted" ? undefined : "url(#horizontal-flow-shadow)"}
        />
      )}
      <text
        x={centerX}
        y={firstLineY}
        fill={node.tone === "muted" ? tone.text : "#172433"}
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize="13"
        fontWeight="600"
        textAnchor="middle"
      >
        {titleLines.map((line, index) => (
          <tspan key={`${node.id}-${line}`} x={centerX} dy={index === 0 ? 0 : lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function HoverProse({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
  return (
    <div className="space-y-2.5">
      {paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 48)} className="text-[15px] leading-6 text-slate-600">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function HoverDetailsList({ details }: { details: string[] }) {
  if (details.length === 0) return null;
  return (
    <ul className="mt-3.5 space-y-2.5 border-t border-slate-100 pt-3.5 text-[14px] leading-5 text-slate-700">
      {details.map((detail) => (
        <li key={detail} className="flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4b9bb3]" />
          <span>{detail}</span>
        </li>
      ))}
    </ul>
  );
}

function HoverExampleBlock({ example }: { example: HoverExample }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3.5 border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left text-[13px] font-semibold text-[#0c5290] transition hover:bg-[#0c5290]/8"
        aria-expanded={open}
      >
        <span>{example.label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="mt-2 max-h-56 space-y-2.5 overflow-y-auto rounded-lg bg-slate-50/90 px-3 py-2.5 text-[14px] leading-5 text-slate-700">
          {example.body.split(/\n\n+/).map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function HorizontalHoverCard({
  node,
  onMouseEnter,
  onMouseLeave,
}: {
  node: DiagramNode;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const placement = hoverCardPlacement(node);
  const details = node.details ?? [];
  const tooltipId = `horizontal-node-tooltip-${node.id}`;
  const title = node.title.replace(/\n/g, " ");
  const wide = Boolean(node.example || (details.length > 3));

  return (
    <div
      role="tooltip"
      id={tooltipId}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`absolute z-50 max-h-[min(32rem,70vh)] overflow-y-auto rounded-2xl border border-slate-200/90 bg-white/95 p-5 text-left shadow-[0_18px_50px_rgba(21,50,79,0.18)] backdrop-blur-md ${
        wide ? "w-[min(26rem,86vw)]" : "w-[min(22rem,78vw)]"
      }`}
      style={{
        left: `${(placement.x / VIEW_W) * 100}%`,
        top: `${(placement.y / VIEW_H) * 100}%`,
        transform: placement.anchor === "above" ? "translate(-50%, calc(-100% - 10px))" : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-[22px] font-semibold leading-snug text-slate-900">{title}</h3>
        {node.href ? (
          <a
            href={node.href}
            className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-[#0c5290] px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-[#0a4580]"
          >
            Open lesson
            <ArrowRight className="h-3 w-3" aria-hidden />
          </a>
        ) : null}
      </div>
      <div className="mt-2.5 h-1 w-12 rounded-full bg-gradient-to-r from-[#0c5290] to-[#1a8fd4]" />
      <div className="mt-3">
        <HoverProse text={node.description} />
      </div>
      {node.note ? (
        <p className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[13px] font-medium leading-5 text-amber-950/80">
          {node.note}
        </p>
      ) : null}
      <HoverDetailsList details={details} />
      {node.example ? <HoverExampleBlock example={node.example} /> : null}
    </div>
  );
}

/** Place beside / above the node in SVG space — HTML overlay can spill outside the SVG. */
function hoverCardPlacement(node: DiagramNode): { x: number; y: number; anchor: "start" | "above" } {
  const cardWidth = node.example || (node.details && node.details.length > 3) ? 416 : 380;
  const gap = 14;
  const edge = 8;

  if (node.y >= BOTTOM_Y - 20) {
    return {
      x: node.x + node.width / 2,
      y: node.y,
      anchor: "above",
    };
  }

  // Top row + diamonds: open to the side so the card never runs under the step header.
  let x = node.x + node.width + gap;
  if (x + cardWidth > VIEW_W - edge) {
    x = Math.max(edge, node.x - cardWidth - gap);
  }
  const y = Math.max(0, node.y - 4);
  return { x, y, anchor: "start" };
}

function HorizontalFlowLabel({
  point,
  text,
  tone,
}: {
  point: Point;
  text: string;
  tone: "teal" | "red" | "slate";
}) {
  const colors = {
    teal: { text: "#ffffff", fill: "#3f9aa8" },
    red: { text: "#b23b47", fill: "#fff0f1" },
    slate: { text: "#5b6b78", fill: "#f1f5f8" },
  };
  const color = colors[tone];
  const approxCount = text.startsWith("~");
  const labelFill = approxCount ? "#3a4654" : color.fill;
  const labelText = approxCount ? "#ffffff" : color.text;
  const yesMetric = /^YES\s*·\s*([\d,]+)\s*\((\d+)%\)$/.exec(text);

  if (yesMetric) {
    const [, count, rate] = yesMetric;
    const width = Math.max(54, `${count}${rate}`.length * 6.2 + 28);
    const height = 34;
    return (
      <g>
        <rect
          x={point.x - width / 2}
          y={point.y - height / 2}
          width={width}
          height={height}
          rx={8}
          fill={color.fill}
        />
        <text
          x={point.x}
          y={point.y - 4}
          fill={color.text}
          fontSize="10"
          fontWeight="700"
          letterSpacing="0"
          textAnchor="middle"
        >
          <tspan x={point.x} dy="0">
            YES
          </tspan>
          <tspan x={point.x} dy="13" fontSize="11" fontWeight="700">
            {count}{" "}
            <tspan fontSize="9" fontWeight="700" opacity="0.88">
              {rate}%
            </tspan>
          </tspan>
        </text>
      </g>
    );
  }

  const width = text.length * 6.2 + 18;

  return (
    <g>
      <rect x={point.x - width / 2} y={point.y - 12} width={width} height={24} rx={12} fill={labelFill} />
      <text
        x={point.x}
        y={point.y + 4}
        fill={labelText}
        fontSize="11"
        fontWeight="700"
        letterSpacing="0"
        textAnchor="middle"
      >
        {text}
      </text>
    </g>
  );
}

function HorizontalNodeDetails({ node, onClose }: { node: DiagramNode; onClose: () => void }) {
  return (
    <aside className="relative mt-4 rounded-2xl border border-slate-200/80 bg-white/85 p-5 shadow-[0_14px_45px_rgba(21,50,79,0.08)] backdrop-blur-sm">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
      >
        Close
      </button>
      <p className="pr-20 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Node detail</p>
      <h2 className="mt-1 text-xl font-semibold text-slate-900">{node.title.replace("\n", " ")}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{node.description}</p>
      {node.details ? (
        <ul className="mt-4 grid max-w-4xl gap-2 text-sm leading-5 text-slate-600 md:grid-cols-2">
          {node.details.map((detail) => (
            <li key={detail} className="rounded-xl bg-slate-50 px-3 py-2">
              {detail}
            </li>
          ))}
        </ul>
      ) : null}
      {node.href ? (
        <Link
          href={node.href}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#0c5290] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#0a4580]"
        >
          Open lesson
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ) : null}
    </aside>
  );
}
