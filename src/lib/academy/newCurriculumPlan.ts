/**
 * The proposed new curriculum (28 Nov 2026): three stages, three sections each.
 * Edited on Academy → Curriculum → New plan and saved whole as JSON in
 * `curriculum_drafts`. The data below is the first version, used until the
 * first save (and by "Start again").
 */
export const NEW_PLAN_DRAFT_ID = "new-plan";

export type NewPlanLesson = { id: string; title: string; note?: string; children?: string[] };

export type NewPlanSection = {
  id: string;
  title: string;
  outcome: string;
  /** App tabs the section teaches. */
  tabs: string[];
  lessons: NewPlanLesson[];
};

export type NewPlanStage = { id: string; title: string; headline: string; sections: NewPlanSection[] };

export const NEW_CURRICULUM_SPINE =
  "Get the right people onto calls, turn calls into clients, and help those clients get results they keep paying for.";

export const NEW_CURRICULUM_RULE =
  "BCA builds the practice in the Blueprint. Lessons don't ask coaches to build it again: they show what's been built, why it works, how to check it and how to run it each week.";

type SeedSection = Omit<NewPlanSection, "id" | "lessons"> & { lessons: Omit<NewPlanLesson, "id">[] };
type SeedStage = Omit<NewPlanStage, "id" | "sections"> & { sections: SeedSection[] };

const SEED_STAGES: SeedStage[] = [
  {
    title: "Get Calls",
    headline: "Get owners to book a call with you.",
    sections: [
      {
        title: "Ideal Clients",
        outcome: "Know who you help, why they fit, and how to use the list BCA builds for you.",
        tabs: ["My Blueprint", "Lead Lists"],
        lessons: [
          { title: "Understand Your Ideal Client" },
          { title: "Check Your Market Page" },
          { title: "Use Your Lead Lists" },
          { title: "Check Fit, One at a Time", note: "Swipe through a list; Ava learns from it" },
        ],
      },
      {
        title: "Lead Engine",
        outcome: "Run the BCA lead system every week.",
        tabs: ["Campaigns", "Content", "Newsletter", "Lead Magnets", "Toolkit"],
        lessons: [
          { title: "How the Lead Engine Works" },
          { title: "Run Your Campaigns" },
          { title: "Keep Your LinkedIn Safe", note: "LinkedIn score and invite clean-up" },
          { title: "Post Content and Your Newsletter" },
          { title: "Use Lead Magnets and Your Toolkit" },
        ],
      },
      {
        title: "Book Calls",
        outcome: "Turn replies into booked calls that people turn up to.",
        tabs: ["Conversations", "Calls"],
        lessons: [
          { title: "Reply in Conversations", note: "Snippets and Ava drafting replies" },
          { title: "Set Up Your Booking Pages", note: "Connect your calendar" },
          { title: "Book and Confirm Calls" },
          { title: "Get Prospects to Show Up" },
        ],
      },
    ],
  },
  {
    title: "Win Clients",
    headline: "Turn calls into paying clients.",
    sections: [
      {
        title: "Pipeline",
        outcome: "Know who needs you next, and how much work it takes to hit your target.",
        tabs: ["Pipeline", "Scoreboard", "Calls"],
        lessons: [
          { title: "Set Your Targets on the Scoreboard" },
          { title: "Manage Your Pipeline" },
          { title: "Mark Every Call Done or No-Show", note: "Keeps the Scoreboard true" },
          { title: "Know Who to Chase and When", note: "Who and when; Closing covers what to say" },
        ],
      },
      {
        title: "Sales Calls",
        outcome: "Run the Constraint Call and the Profit Roadmap Call the BCA way.",
        tabs: ["Scripts", "Call Practice", "Profit Levers"],
        lessons: [
          { title: "Run the Constraint Call" },
          { title: "Run the Profit Roadmap Call" },
          { title: "Show the Prize with Profit Levers", note: "Profit Levers is admin-only today" },
          { title: "Practise in Call Practice" },
        ],
      },
      {
        title: "Closing",
        outcome: "Ask for the decision, handle doubts, and win back people who don't buy straight away.",
        tabs: ["Scripts"],
        lessons: [
          { title: "Find the Real Objection" },
          {
            title: "Handle Common Objections",
            note: "One short video each, so Scripts and Ava can link to the right one",
            children: ["“I Need Time to Think”", "Money", "Partner", "Timing", "Fear"],
          },
          { title: "Ask for the Decision", note: "Closing loops and final moves" },
          { title: "Follow Up and Close" },
        ],
      },
    ],
  },
  {
    title: "Keep Clients",
    headline: "Help clients win, so they stay.",
    sections: [
      {
        title: "Client Launch",
        outcome: "Take a new client from payment to a live 90-day plan.",
        tabs: ["Clients"],
        lessons: [
          { title: "Set Up a New Client" },
          { title: "The Profit System", note: "5 Levels, 3 Pillars, 9 Steps" },
          { title: "Session 1: Profit System & Dashboard" },
          { title: "Session 2: Leverage & Critical Issues" },
          { title: "Session 3: 3-Year Plan" },
          { title: "Session 4: 90-Day Plan" },
        ],
      },
      {
        title: "Client Results",
        outcome: "Use the Profit System and COACH to help clients decide and make progress.",
        tabs: ["Playbooks", "Client Simulator"],
        lessons: [
          {
            title: "Apply the Profit System",
            note: "Short lessons per business area",
            children: [
              "Dynamic Planning",
              "Profit & Cash",
              "Revenue & Marketing",
              "Ops & Product",
              "Financials & KPIs",
              "Innovation & Management",
              "Team & Leadership",
            ],
          },
          { title: "Use the COACH Method" },
          { title: "Run a Good Session" },
          { title: "Share Playbooks" },
          { title: "Practise in the Client Simulator" },
        ],
      },
      {
        title: "Retain and Expand",
        outcome: "Make progress easy to see, keep clients engaged, and earn renewals and referrals.",
        tabs: ["BOSS Score"],
        lessons: [
          { title: "Prevent Overwhelm and Distraction" },
          { title: "Create Ownership and Progress" },
          { title: "Show Progress with the BOSS Score", note: "Run it again to show how far they've come" },
          { title: "Review Results and Renew" },
          { title: "Get Referrals" },
        ],
      },
    ],
  },
];

export const NEW_CURRICULUM_OPEN_QUESTIONS: string[] = [
  "Scoreboard targets repeat the £ target and 90-day plan in Coach Action Plan. Which one owns it?",
  "Can the Classroom show lessons nested under a lesson (objections, business areas)? If not, use chaptered videos.",
  "Profit Levers is admin-only. Release it before Sales Calls is filmed, or drop that lesson.",
  "Tools and reference (BOSS Pro, templates) go in the Vault, not the main path.",
];

export type NewPlanDoc = {
  spine: string;
  rule: string;
  stages: NewPlanStage[];
  openQuestions: string[];
};

export function newPlanId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function defaultNewPlan(): NewPlanDoc {
  return {
    spine: NEW_CURRICULUM_SPINE,
    rule: NEW_CURRICULUM_RULE,
    openQuestions: [...NEW_CURRICULUM_OPEN_QUESTIONS],
    stages: SEED_STAGES.map((stage) => ({
      ...stage,
      id: newPlanId(),
      sections: stage.sections.map((section) => ({
        ...section,
        id: newPlanId(),
        tabs: [...section.tabs],
        lessons: section.lessons.map((lesson) => ({
          ...lesson,
          id: newPlanId(),
          children: lesson.children ? [...lesson.children] : undefined,
        })),
      })),
    })),
  };
}

const str = (v: unknown, max = 2000): string => (typeof v === "string" ? v.slice(0, max) : "");
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 500)) : [];
const id = (v: unknown): string => (typeof v === "string" && v ? v.slice(0, 40) : newPlanId());

/** Checks a saved or posted plan and fills any missing ids. Null if it isn't a plan. */
export function parseNewPlan(raw: unknown): NewPlanDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw as Record<string, unknown>;
  if (!Array.isArray(doc.stages)) return null;
  const records = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object") : [];
  return {
    spine: str(doc.spine),
    rule: str(doc.rule),
    openQuestions: strList(doc.openQuestions),
    stages: records(doc.stages).map((stage) => ({
      id: id(stage.id),
      title: str(stage.title, 200),
      headline: str(stage.headline, 500),
      sections: records(stage.sections).map((section) => ({
        id: id(section.id),
        title: str(section.title, 200),
        outcome: str(section.outcome),
        tabs: strList(section.tabs),
        lessons: records(section.lessons).map((lesson) => {
          const children = strList(lesson.children);
          const note = str(lesson.note, 500);
          return {
            id: id(lesson.id),
            title: str(lesson.title, 300),
            ...(note ? { note } : {}),
            ...(children.length ? { children } : {}),
          };
        }),
      })),
    })),
  };
}
