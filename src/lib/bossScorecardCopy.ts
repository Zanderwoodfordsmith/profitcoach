import type {
  BossLevel,
  CtaTier,
  ScorecardScore,
  ScoreRag,
} from "./bossScorecardScores";
import { scoreToRag } from "./bossScorecardScores";
import {
  SCORE_PASTEL_COLORS,
  SMILEY_LABELS,
} from "./bossScorecardQuestions";

export const LEVEL_DESCRIPTIONS: Record<BossLevel, string> = {
  Overwhelmed: "You are firefighting. The business is running you.",
  Overworked: "You are holding it together, but it costs you everything.",
  Organised: "Systems are starting to work, but you are still the bottleneck.",
  Overseer: "You are managing rather than doing. The next step is stepping back.",
  Owner: "Your business works. Now the question is what you want it to do next.",
};

export const LEVEL_IMAGES: Record<BossLevel, string> = {
  Overwhelmed: "/levels/overwhelm.png",
  Overworked: "/levels/overworked.png",
  Organised: "/levels/organised.png",
  Overseer: "/levels/overseer.png",
  Owner: "/levels/owner.png",
};

const LEVEL_DETAIL: Record<BossLevel, string[]> = {
  Overwhelmed: [
    "You are in survival mode. The business is running you more than you are running it. Too many fires, too many decisions flowing through you, and not enough structure to step back with confidence.",
    "At this level, most owners are doing everything themselves. The business cannot run for more than a few days without you, and growth often creates more chaos rather than more freedom.",
    "That is honest, and it is where most owners start. The priority is locking in the basics: clear direction, simple systems, and one or two areas fixed properly, before trying to scale anything else.",
  ],
  Overworked: [
    "You have built something real, but you are carrying the entire business on your shoulders. Every important decision, problem, and sale still flows through you.",
    "You are likely working long hours, often 50 to 60 or more per week, and the business struggles to run for long without you. You are busy, but not yet efficient.",
    "The shift at this level is from heroics to repeatable systems. You do not need to work harder; you need a few core playbooks installed so the business stops depending on your constant attention.",
  ],
  Organised: [
    "Systems are starting to work and you have real clarity in places, but you remain the bottleneck. Processes exist, yet consistency is what is missing.",
    "Things can run without you for a while, but when pressure hits, you are still pulled back in. You are moving from doing the work to building the machine, but the transition is not complete.",
    "Your focus now is tightening what already works and fixing the gaps that pull you back in. A few disciplined upgrades, done in the right order, will unlock noticeably more time and headspace.",
  ],
  Overseer: [
    "You are leading the team and working on the business, not only in it. Management cadence is emerging and you can see performance across the operation.",
    "Most of the day-to-day runs through others, but you still carry the weight of the big decisions and the areas that are not yet systemised. Leadership quality is now the multiplier.",
    "The next step is stepping back further without things slipping. That means building management rhythm, clearer accountability, and stronger systems in the areas that still depend on you.",
  ],
  Owner: [
    "Your business runs well without you in the day-to-day. Leadership handles operations and you steer with minimal involvement. This is what true ownership looks like.",
    "You have moved past firefighting and micromanagement. The foundations, commercial engine, and team are largely in place. The business creates value beyond your personal effort.",
    "The question now is what you want the business to do for you next, whether that is more profit, more time, a bigger team, or an exit. Your BOSS Compass below shows where to fine-tune rather than rebuild.",
  ],
};

export function getScorecardLevelDetail(bossLevel: BossLevel): string[] {
  return LEVEL_DETAIL[bossLevel];
}

export const SCORE_LEGEND = [
  { score: 1 as const, label: SMILEY_LABELS[1], color: SCORE_PASTEL_COLORS[1] },
  { score: 2 as const, label: SMILEY_LABELS[2], color: SCORE_PASTEL_COLORS[2] },
  { score: 3 as const, label: SMILEY_LABELS[3], color: SCORE_PASTEL_COLORS[3] },
  { score: 4 as const, label: SMILEY_LABELS[4], color: SCORE_PASTEL_COLORS[4] },
  { score: 5 as const, label: SMILEY_LABELS[5], color: SCORE_PASTEL_COLORS[5] },
];

/** Assessment intro screen (before question 1). */
export const SCORECARD_INTRO = {
  titleAssessment: "Assessment",
  subtitle:
    "Score how your business runs across 15 questions in under 5 minutes and get your score out of 100.",
  instruction: "Tap the face that matches reality on each question.",
  whatYouGetDetailsLabel: "What you'll get",
  whatYouGetBullets: [
    "One score out of 100 and your owner level.",
    "Your top focus areas and what to work on first.",
    "A clear starting point on the biggest bottlenecks in your business.",
  ],
  startCta: "Start assessment",
} as const;

/** BOSS Focus card styling by score (1–5): dark → light gradient per colour. */
export const SCORE_FOCUS_STYLE: Record<
  1 | 2 | 3 | 4 | 5,
  { label: string; gradient: string; accent: string; lightBadgeText: boolean }
> = {
  1: {
    label: SMILEY_LABELS[1],
    gradient: "linear-gradient(135deg, #991b1b 0%, #dc2626 40%, #f87171 100%)",
    accent: "rgba(255,255,255,0.28)",
    lightBadgeText: true,
  },
  2: {
    label: SMILEY_LABELS[2],
    gradient: "linear-gradient(135deg, #c2410c 0%, #f97316 40%, #fdba74 100%)",
    accent: "rgba(255,255,255,0.28)",
    lightBadgeText: true,
  },
  3: {
    label: SMILEY_LABELS[3],
    gradient: "linear-gradient(135deg, #ca8a04 0%, #eab308 40%, #fde68a 100%)",
    accent: "rgba(0,0,0,0.12)",
    lightBadgeText: false,
  },
  4: {
    label: SMILEY_LABELS[4],
    gradient: "linear-gradient(135deg, #15803d 0%, #22c55e 40%, #86efac 100%)",
    accent: "rgba(255,255,255,0.28)",
    lightBadgeText: true,
  },
  5: {
    label: SMILEY_LABELS[5],
    gradient: "linear-gradient(135deg, #0c5290 0%, #238BF7 40%, #75c8ff 100%)",
    accent: "rgba(255,255,255,0.28)",
    lightBadgeText: true,
  },
};

export function insightTextForScore(score: 1 | 2 | 3 | 4 | 5): string {
  if (score <= 2) return insightTextForRag("red");
  if (score === 3) return insightTextForRag("amber");
  return insightTextForRag("green");
}

export function insightTextForRag(rag: ScoreRag): string {
  if (rag === "red") {
    return "This area is holding your business back right now. Fixing it first will unlock progress everywhere else.";
  }
  if (rag === "amber") {
    return "You have started here, but consistency is missing. Tighten the playbook and this becomes a strength.";
  }
  return "This is a relative strength. Maintain it while you fix the weaker areas.";
}

const FOCUS_INSIGHT_RED: Record<string, string> = {
  q1: "Without a clear daily system, you stay reactive — and the business keeps running you instead of the other way around.",
  q2: "When vision is not aligned, the team pulls in different directions and hard work does not compound.",
  q3: "Without a defined strategy, every new opportunity feels urgent and focus keeps slipping away.",
  q4: "If 90-day planning is weak, you lose the rhythm that turns goals into predictable progress.",
  q5: "Unclear profit and cash visibility makes every decision feel risky — and growth can feel like a gamble.",
  q6: "An unreliable revenue engine means feast-or-famine months and constant pressure on you to sell.",
  q7: "When ops and delivery depend on you, stepping away stops the business — this caps freedom and scale.",
  q8: "Without simple weekly numbers, problems show up late and you are always fixing instead of steering.",
  q9: "If the business is not improving how it works, margin and capacity get eaten by old habits.",
  q10: "Weak team and leadership design keeps you as the bottleneck — and the business cannot grow past you.",
};

const FOCUS_INSIGHT_AMBER: Record<string, string> = {
  q1: "You have pieces of a daily system, but consistency is missing — tighten this and your weeks get calmer fast.",
  q2: "Direction exists in places, but the team still needs sharper alignment so effort converts to momentum.",
  q3: "Strategy is partly there — making it written, visible, and used weekly will stop the drift.",
  q4: "Planning happens sometimes; a disciplined 90-day cadence is what turns intent into results.",
  q5: "You track some numbers, but profit and cash need a clearer rhythm so you can decide with confidence.",
  q6: "New customer flow is uneven — a repeatable system for acquiring and converting will stabilise revenue.",
  q7: "Operations work for a while without you, but gaps still pull you back in when pressure hits.",
  q8: "KPIs exist, but reviews are not yet simple and regular enough to guide the team.",
  q9: "Improvements happen ad hoc — systemising innovation will lift quality without more heroics.",
  q10: "The team is forming, but roles and accountability need tightening so you are not the default answer.",
};

const FOCUS_INSIGHT_GREEN: Record<string, string> = {
  q1: "Owner performance is a relative strength — protect this rhythm while you upgrade weaker areas.",
  q2: "Vision alignment is working — keep it visible so new hires and projects stay on course.",
  q3: "Strategy is clear enough to guide decisions — maintain it as the filter for what you say yes to.",
  q4: "Your planning cadence is supporting progress — keep milestones visible and reviewed.",
  q5: "Profit and cash visibility is solid — use it to fund the next priority, not spread thin.",
  q6: "Revenue systems are a strength — optimise conversion and capacity rather than reinventing.",
  q7: "Ops can run without you for stretches — document what works so it survives busy seasons.",
  q8: "Weekly numbers are guiding the business — keep the dashboard simple as you grow.",
  q9: "You are improving how the business runs — channel that into the areas still below par.",
  q10: "Team and leadership are carrying load — strengthen managers before adding complexity.",
};

/** Focus card list — topics within the priority area, not delivered playbooks on this page. */
export const FOCUS_TOPICS_HEADING = "Areas to focus on";

export const FOCUS_SECTION_INTRO =
  "Your three priority areas from the scorecard. Each card lists the BOSS topics to work through—every topic has playbooks at all five levels.";

export function insightTextForFocusArea(
  questionId: string,
  score: ScorecardScore
): string {
  const rag = scoreToRag(score);
  const byRag =
    rag === "red"
      ? FOCUS_INSIGHT_RED
      : rag === "amber"
        ? FOCUS_INSIGHT_AMBER
        : FOCUS_INSIGHT_GREEN;
  return byRag[questionId] ?? insightTextForRag(rag);
}

export function getFocusSectionLead(tier: CtaTier): string {
  switch (tier) {
    case "high":
      return "Want help choosing where to focus next?";
    case "mid":
      return "Not sure where to start?";
    case "low":
      return "Not sure what to tackle first?";
  }
}

export function getFocusSectionSubtitle(
  tier: CtaTier,
  coachFirstName: string
): string {
  const coach = coachFirstName || "your coach";
  switch (tier) {
    case "high":
      return `Book a call with ${coach} to walk through your playbooks and turn your scorecard into a clear plan.`;
    case "mid":
      return `Book a free call with ${coach} and we will review your results and pick your first priority together.`;
    case "low":
      return `When you are ready, book a call with ${coach} or use the free resources below to build at your own pace.`;
  }
}

export function getWarmIntro(tier: CtaTier, coachName: string): string {
  const name = coachName || "I";
  switch (tier) {
    case "high":
      return `Thank you for completing the scorecard. Your results suggest you are exactly the kind of business owner ${name} works with. You have built real foundations, and with the right focus on a few priority areas, the next level is within reach.`;
    case "mid":
      return `Thank you for completing the scorecard. You are further along than most owners, but a few gaps are still costing you time, profit, or team capacity. The good news is these are fixable once you know where to start.`;
    case "low":
      return `Thank you for completing the scorecard. Your results show you are in the early stages of building the systems a business needs to run without you. That is honest and useful. The right next step is simpler than you might think, starting with one priority area.`;
  }
}

export type NextStepCopy = {
  title: string;
  body: string;
  ctaLabel: string;
};

export function getNextSteps(tier: CtaTier): NextStepCopy {
  switch (tier) {
    case "high":
      return {
        title: "Your next step",
        body: "Book a one-to-one results review. We will walk through your scorecard, identify your single highest-leverage priority, and map out a clear 90-day plan.",
        ctaLabel: "Book your results review",
      };
    case "mid":
      return {
        title: "Your next step",
        body: "Book a free 30-minute call. We will review your results together and show you exactly what to fix first.",
        ctaLabel: "Book a free 30-minute call",
      };
    case "low":
      return {
        title: "A good place to start",
        body: "Grab our free resources and join an upcoming group session. Build the foundations at your own pace before investing in one-to-one support.",
        ctaLabel: "Explore free resources",
      };
  }
}

export type CtaCopy = {
  body: string;
  button: string;
};

export function getCtaCopy(tier: CtaTier, coachName: string): CtaCopy {
  const next = getNextSteps(tier);
  return { body: next.body, button: next.ctaLabel };
}

export const RAG_BADGE: Record<
  ScoreRag,
  { label: string; accent: string; gradient: string }
> = {
  red: {
    label: "Critical",
    accent: "#f87171",
    gradient:
      "linear-gradient(135deg, #7f1d1d 0%, #b91c1c 38%, #dc2626 100%)",
  },
  amber: {
    label: "Needs work",
    accent: "#fcd34d",
    gradient:
      "linear-gradient(135deg, #78350f 0%, #b45309 42%, #d97706 100%)",
  },
  green: {
    label: "Strong",
    accent: "#6ee7b7",
    gradient:
      "linear-gradient(135deg, #064e3b 0%, #047857 42%, #059669 100%)",
  },
};
