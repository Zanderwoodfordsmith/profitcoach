/**
 * BOSS Scorecard question definitions and qualifying stack options.
 */

export type ScorecardPillar =
  | "foundation"
  | "vision"
  | "velocity"
  | "value"
  | "outcome";

export type ScorecardQuestion = {
  id: string;
  step: number;
  areaName: string;
  pillar: ScorecardPillar;
  question: string;
  /** When set, shown on the shared outcomes screen instead of as its own step */
  outcomesGroup?: "business_outcomes";
};

export const SCORECARD_QUESTIONS: ScorecardQuestion[] = [
  {
    id: "q1",
    step: 1,
    areaName: "Owner Performance",
    pillar: "foundation",
    question:
      "Do you have a clear daily system for deciding what to work on, so you're not just reacting to whatever comes at you?",
  },
  {
    id: "q2",
    step: 2,
    areaName: "Aligned Vision",
    pillar: "vision",
    question:
      "Does your team know exactly where the business is heading and what their role is in getting it there?",
  },
  {
    id: "q3",
    step: 3,
    areaName: "Defined Strategy",
    pillar: "vision",
    question:
      "Do you have a written plan for the next 12 months that tells you what to focus on and what to say no to?",
  },
  {
    id: "q4",
    step: 4,
    areaName: "Disciplined Planning",
    pillar: "vision",
    question:
      "Are you running your business from a clear 90-day plan with specific milestones you review regularly?",
  },
  {
    id: "q5",
    step: 5,
    areaName: "Profit & Cash",
    pillar: "velocity",
    question:
      "Do you know your profit margin, your cash position, and whether you will have enough cash in the next 90 days?",
  },
  {
    id: "q6",
    step: 6,
    areaName: "Revenue & Marketing",
    pillar: "velocity",
    question:
      "Do you have a reliable, repeatable system for acquiring and converting new leads, customers, and/or clients?",
  },
  {
    id: "q7",
    step: 7,
    areaName: "Ops & Product",
    pillar: "velocity",
    question:
      "Could your business run for two weeks without you, or does everything stop when you step away?",
  },
  {
    id: "q8",
    step: 8,
    areaName: "Financials & KPIs",
    pillar: "velocity",
    question:
      "Do you review a simple set of numbers every week that tell you clearly whether your business is on or off track?",
  },
  {
    id: "q9",
    step: 9,
    areaName: "Innovation & Management",
    pillar: "value",
    question:
      "Are you actively improving how your business works, or are you still doing most things the same way you always have?",
  },
  {
    id: "q10",
    step: 10,
    areaName: "Team & Leadership",
    pillar: "value",
    question:
      "Do you have the right people in the right roles with clear accountability, so you are not the bottleneck in your own business?",
  },
  {
    id: "q11a",
    step: 11,
    areaName: "Money",
    pillar: "outcome",
    outcomesGroup: "business_outcomes",
    question: "Is your business giving you the profit and income you want?",
  },
  {
    id: "q11b",
    step: 11,
    areaName: "Time",
    pillar: "outcome",
    outcomesGroup: "business_outcomes",
    question: "Is your business giving you the time freedom you want?",
  },
  {
    id: "q11c",
    step: 11,
    areaName: "Team",
    pillar: "outcome",
    outcomesGroup: "business_outcomes",
    question:
      "Do you have the team this business needs to run without relying on you?",
  },
];

export const SCORED_QUESTION_IDS = SCORECARD_QUESTIONS.map((q) => q.id);

export const BEST_PRACTICE_QUESTIONS = SCORECARD_QUESTIONS.filter(
  (q) => !q.outcomesGroup
);

export const OUTCOME_QUESTIONS = SCORECARD_QUESTIONS.filter(
  (q) => q.outcomesGroup === "business_outcomes"
);

export const OUTCOMES_SCREEN_HEADING =
  "Now let's look at what your business is actually giving you.";

export const SMILEY_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Don't Ask",
  2: "Needs Work",
  3: "It's ok",
  4: "Really Good",
  5: "100% Ideal",
};

export { BOSS_SCORE_SATURATED as SMILEY_COLORS } from "./bossScorecardColors";
export {
  BOSS_SCORE_PASTEL as SCORE_PASTEL_COLORS,
  BOSS_SCORE_SATURATED,
} from "./bossScorecardColors";

export type QualifyingFieldId =
  | "annual_revenue"
  | "team_size"
  | "time_in_business"
  | "desired_outcome"
  | "desired_outcome_other"
  | "obstacles"
  | "preferred_solution";

/** Selected when the prospect picks "Something else" on desired outcome. */
export const DESIRED_OUTCOME_OTHER_VALUE = "other";

export type QualifyingOtherConfig = {
  detailKey: "desired_outcome_other";
  placeholder: string;
  examples: string[];
};

export type QualifyingFieldDef = {
  id: QualifyingFieldId;
  label: string;
  required: boolean;
  multi: boolean;
  options: QualifyingOption[];
  /** Single-select only: "Something else" reveals a short free-text field. */
  other?: QualifyingOtherConfig;
};

export type QualifyingOption = {
  value: string;
  label: string;
};

export const QUALIFYING_JOURNEY_FIELDS: QualifyingFieldDef[] = [
  {
    id: "annual_revenue",
    label: "Annual Business Revenue",
    required: true,
    multi: false,
    options: [
      { value: "under_200k", label: "Under £200K" },
      { value: "200k_500k", label: "£200K to £500K" },
      { value: "500k_1m", label: "£500K to £1M" },
      { value: "1m_2m", label: "£1M to £2M" },
      { value: "2m_5m", label: "£2M to £5M" },
      { value: "over_5m", label: "Over £5M" },
    ],
  },
  {
    id: "team_size",
    label: "Team Size",
    required: true,
    multi: false,
    options: [
      { value: "just_me", label: "Just me" },
      { value: "2_5", label: "2 to 5" },
      { value: "6_15", label: "6 to 15" },
      { value: "16_30", label: "16 to 30" },
      { value: "30_plus", label: "30+" },
    ],
  },
  {
    id: "time_in_business",
    label: "How long have you been in business?",
    required: true,
    multi: false,
    options: [
      { value: "under_1", label: "Less than 1 year" },
      { value: "1_3", label: "1 to 3 years" },
      { value: "3_5", label: "3 to 5 years" },
      { value: "5_10", label: "5 to 10 years" },
      { value: "10_plus", label: "More than 10 years" },
    ],
  },
];

export const QUALIFYING_SUPPORT_FIELDS: QualifyingFieldDef[] = [
  {
    id: "desired_outcome",
    label: "What outcome matters most to you right now?",
    required: true,
    multi: false,
    options: [
      { value: "profit_income", label: "More profit and income" },
      { value: "time_freedom", label: "More time and freedom" },
      { value: "team_culture", label: "A stronger team and culture" },
      { value: "step_back_sell", label: "A business I can step back from or sell" },
      { value: DESIRED_OUTCOME_OTHER_VALUE, label: "Something else" },
    ],
    other: {
      detailKey: "desired_outcome_other",
      placeholder: "Tell us what matters most right now…",
      examples: [
        "Get off the tools",
        "Stop firefighting",
        "Fix cash flow",
        "Build a leadership team",
      ],
    },
  },
  {
    id: "obstacles",
    label: "What have you tried that has not worked?",
    required: true,
    multi: true,
    options: [
      { value: "consultants", label: "Hiring consultants or advisors" },
      { value: "books_courses", label: "Reading books or taking courses" },
      { value: "time_management", label: "Trying to manage my time better" },
      { value: "new_people", label: "Bringing in new people" },
      { value: "strategy_offer", label: "Changing my strategy or offer" },
      { value: "nothing_yet", label: "Nothing yet. I have not known where to start" },
    ],
  },
  {
    id: "preferred_solution",
    label: "What type of support would suit you best?",
    required: true,
    multi: false,
    options: [
      { value: "tools_self", label: "The right tools to figure it out myself" },
      { value: "one_on_one", label: "Working with someone one-on-one" },
      { value: "group_coaching", label: "A group coaching programme with peers" },
      { value: "done_with_you", label: "A done-with-you solution" },
    ],
  },
];

/** @deprecated Use QUALIFYING_JOURNEY_FIELDS + QUALIFYING_SUPPORT_FIELDS */
export const QUALIFYING_FIELDS: QualifyingFieldDef[] = [
  ...QUALIFYING_JOURNEY_FIELDS,
  ...QUALIFYING_SUPPORT_FIELDS,
];

export type QualifyingData = Partial<
  Record<QualifyingFieldId, string | string[]>
>;

export const QUALIFYING_HEADING = "Where are you in your business journey?";

export const QUALIFYING_SUPPORT_HEADING =
  "Help us personalise your Boss Score";

export const OPEN_TEXT_HEADING =
  "Is there anything else you would like me to know?";

/** Scored smiley questions (10 best-practice + 3 outcomes). */
export const SCORED_SCORECARD_STEPS = 13;
/** Progress bar steps (13 scored + 2 qualifying; open text is optional, shown as 15/15 at 100%). */
export const TOTAL_SCORECARD_STEPS = 15;

/** Maps internal screen step (0 intro, 1–16 questions) to progress bar label and fill. */
export function getScorecardProgress(screenStep: number): {
  currentStep: number;
  completedSteps: number;
} {
  if (screenStep <= 0) {
    return { currentStep: 0, completedSteps: 0 };
  }
  if (screenStep >= 16) {
    return { currentStep: TOTAL_SCORECARD_STEPS, completedSteps: TOTAL_SCORECARD_STEPS };
  }
  if (screenStep === 15) {
    return { currentStep: 14, completedSteps: 13 };
  }
  const step = Math.min(screenStep, 14);
  return { currentStep: step, completedSteps: Math.max(0, step - 1) };
}

/** Venn petal layout: Q2–Q10 mapped to 3 pillars × 3 petals */
export const VENN_PETAL_QUESTIONS: Record<
  "vision" | "velocity" | "value",
  string[]
> = {
  vision: ["q2", "q3", "q4"],
  velocity: ["q5", "q6", "q7"],
  value: ["q8", "q9", "q10"],
};

export const PILLAR_LABELS = {
  vision: "Vision",
  velocity: "Velocity",
  value: "Value",
} as const;

export const PILLAR_FULL_LABELS = {
  vision: "Clarify Vision",
  velocity: "Control Velocity",
  value: "Create Value",
} as const;

export const PILLAR_ACCENT_COLORS = {
  vision: "#0c5290",
  velocity: "#42a1ee",
  value: "#1ca0c2",
} as const;

/** Compass-style pillar copy for venn diagram */
export const SCORECARD_PILLAR_META: Record<
  "vision" | "velocity" | "value",
  {
    title: string;
    green: string;
    red: string;
    color: string;
  }
> = {
  vision: {
    title: "VISION",
    green: "Clear direction",
    red: "Constant confusion",
    color: PILLAR_ACCENT_COLORS.vision,
  },
  velocity: {
    title: "VELOCITY",
    green: "Controlled growth",
    red: "Chaos and firefighting",
    color: PILLAR_ACCENT_COLORS.velocity,
  },
  value: {
    title: "VALUE",
    green: "Built to last",
    red: "Owner-dependent",
    color: PILLAR_ACCENT_COLORS.value,
  },
};

export const SCORECARD_PAGE_BG = [
  "radial-gradient(1000px 520px at 8% 0%, rgba(14,165,233,0.14), transparent 60%)",
  "radial-gradient(900px 460px at 90% 10%, rgba(59,130,246,0.12), transparent 58%)",
  "linear-gradient(180deg, #f8fbff 0%, #eef5ff 45%, #e8f1ff 100%)",
].join(", ");

export const BRAND_COLORS = {
  usafaBlue: "#0A5291",
  tuftsBlue: "#438BCA",
  spaceCadet: "#2D2F46",
  powderBlue: "#CCEBF3",
} as const;
