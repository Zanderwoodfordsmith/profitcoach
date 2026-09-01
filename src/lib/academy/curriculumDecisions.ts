/**
 * Locked curriculum decisions (Sep 2026).
 * Admin working spec — not coach-facing.
 *
 * Outcome titles are the target. Current lessons stay until rewritten.
 * Do not treat this as a new course tree to build from scratch.
 */

export type CurriculumDecision =
  | "rename"
  | "keep"
  | "fill"
  | "fold"
  | "gap"
  | "later"
  | "skip"
  | "reference";

export type CurriculumLessonRow = {
  outcomeTitle: string;
  decision: CurriculumDecision;
  note: string;
  currentTitle?: string;
  courseId?: string;
  lessonId?: string;
};

export type CurriculumMilestone = {
  id: string;
  title: string;
  purpose: string;
  lessons: CurriculumLessonRow[];
};

export type CurriculumCourse = {
  id: string;
  title: string;
  purpose: string;
  milestones: CurriculumMilestone[];
};

export const CURRICULUM_DECISION_LABELS: Record<CurriculumDecision, string> = {
  rename: "Rename",
  keep: "Keep",
  fill: "Rewrite in place",
  fold: "Fold in",
  gap: "Gap",
  later: "Later",
  skip: "Not taking",
  reference: "Reference only",
};

export const CURRICULUM_RULES = [
  {
    title: "If-then lives in the lesson",
    body: "No separate Decision Desk. The first screen of every lesson is the situation, the action, the script or tool, and the success standard. Chapters hold the branches. Search already finds it.",
  },
  {
    title: "Outcome titles, same lessons",
    body: "Rename toward the job the coach finishes. Do not invent a parallel tree. Connector, Sessions 1–4, Pick Your Path, and Going Pro stay as the product. Generic academy names hide the work.",
  },
  {
    title: "Tools first, then a short explain",
    body: "If a tool can lock the decision, the lesson opens the tool. If it needs judgement (objections, a live session, a rescue conversation), write the if-then, then explain only as far as the skill needs.",
  },
  {
    title: "One search",
    body: "The top-bar search stays the only search. Transcripts and chapters are the retrieval layer. Do not add a second engine or an AI-only front door.",
  },
] as const;

export const LESSON_OPENING_STANDARD = {
  title: "Lesson opening",
  steps: [
    "Title = the outcome or situation",
    "Do this now: one action",
    "Say this / use this: script, checklist, or tool",
    "Success standard: what is true when they are done",
    "Then the video, guide, or short why, only if the skill needs it",
    "Chapters = branches, not extra theory",
  ],
} as const;

export const CURRICULUM_COURSES: CurriculumCourse[] = [
  {
    id: "start-here",
    title: "Start Here",
    purpose: "Remove confusion. First action today. Do not replace with a generic onboarding syllabus.",
    milestones: [
      {
        id: "start-here-welcome",
        title: "Get oriented and take the first action",
        purpose: "Keep the current path. Tighten openings. Do not add First 7 Days / How to Use This Programme.",
        lessons: [
          {
            outcomeTitle: "Welcome and take two actions",
            currentTitle: "Welcome & Program Overview",
            courseId: "start-here",
            lessonId: "start-here-welcome-welcome-program-overview",
            decision: "keep",
            note: "Already action-first. Keep community calendar + complete Start Here.",
          },
          {
            outcomeTitle: "Pick the path that matches your bottleneck",
            currentTitle: "Pick Your Path",
            courseId: "start-here",
            lessonId: "start-here-welcome-pick-your-path",
            decision: "keep",
            note: "This is the if-then router. Do not replace with a six-step theory lesson.",
          },
          {
            outcomeTitle: "Get unstuck without waiting",
            currentTitle: "Support",
            courseId: "start-here",
            lessonId: "start-here-welcome-support",
            decision: "keep",
            note: "Keep. Later this can point at rewritten if-then lesson openings.",
          },
        ],
      },
    ],
  },
  {
    id: "coach-action-plan",
    title: "Coach Action Plan",
    purpose: "Personalise the route. Leave drafts empty until the tool can do the setup.",
    milestones: [
      {
        id: "cap-activation",
        title: "Choose the constraint and the next 90 days",
        purpose: "Their Constraint / Scorecard / 90-Day names are useful as outcome titles. Do not fill drafts with long teaching.",
        lessons: [
          {
            outcomeTitle: "See why the plan is lighter now",
            currentTitle: "Why your Action Plan looks different now",
            courseId: "coach-action-plan",
            lessonId: "coach-action-plan-why-your-action-plan-looks-different",
            decision: "keep",
            note: "This is the product rule: tools will do the setup, so do not teach a manual process you will replace.",
          },
          {
            outcomeTitle: "Lock the £10k/mo model",
            currentTitle: "Your £10k/mo Profit Coach Model & Path",
            courseId: "coach-action-plan",
            lessonId:
              "coach-action-plan-the-10k-mo-plan-the-10k-mo-blueprint-your-bridge-to-success",
            decision: "keep",
            note: "Keep the model. Outcome title is already close.",
          },
          {
            outcomeTitle: "Identify your current constraint",
            currentTitle: "Volume x Conversion",
            courseId: "coach-action-plan",
            lessonId:
              "coach-action-plan-the-10k-mo-plan-how-to-achieve-results-the-formula-for-business-coach-success",
            decision: "rename",
            note: "Same lesson. Title should answer: calls, sales, or delivery?",
          },
          {
            outcomeTitle: "Set targets, week, and 90-day plan",
            currentTitle: "Snapshot / Design Your Week / 90-Day Client Plan",
            decision: "later",
            note: "Drafts on purpose. Ship the tool, then a short if-then. Do not write a course into the gap.",
          },
        ],
      },
    ],
  },
  {
    id: "going-pro",
    title: "Going Pro",
    purpose: "Keep the PRO names. Cut length. End every lesson with a calendar or scorecard action.",
    milestones: [
      {
        id: "going-pro-day-zero",
        title: "Install the weekly operating rhythm",
        purpose: "Do not rebrand to Think Like a Business Owner. The brand is Going Pro.",
        lessons: [
          {
            outcomeTitle: "Protect time for revenue work",
            currentTitle: "PRO Time-Management",
            courseId: "going-pro",
            lessonId: "going-pro-day-zero-pro-time-management",
            decision: "keep",
            note: "Keep the name. Opening becomes the calendar action, not 35 minutes of why.",
          },
          {
            outcomeTitle: "Keep the commitment when motivation drops",
            currentTitle: "PRO Energy / Focus / Mindset / Productivity",
            decision: "keep",
            note: "Same lessons. Shorten. Each ends with one operating action.",
          },
        ],
      },
    ],
  },
  {
    id: "get-calls",
    title: "Get Calls",
    purpose: "Take their three outcome milestones. Keep Connector, Sales Nav, and BOSS as the work.",
    milestones: [
      {
        id: "get-calls-market",
        title: "Choose Your Market",
        purpose: "Who, what problem, what language. Finding them is still this milestone.",
        lessons: [
          {
            outcomeTitle: "Choose Your Ideal Client",
            currentTitle: "How To Choose Your Core Client",
            courseId: "get-calls",
            lessonId: "get-calls-ideal-clients-how-to-choose-your-core-client",
            decision: "rename",
            note: "Working lesson already does this. Title should be the lock, not the how-to.",
          },
          {
            outcomeTitle: "Define the Problem You Solve",
            currentTitle: "Understand Your Ideal Client",
            courseId: "get-calls",
            lessonId: "get-calls-ideal-clients-understand-your-ideal-client",
            decision: "rename",
            note: "Guide-only today. Rewrite as lock-the-pains, then tool.",
          },
          {
            outcomeTitle: "Write Your Market Message",
            currentTitle: "Set Up Your LinkedIn Profile",
            courseId: "get-calls",
            lessonId: "get-calls-linkedin-optimization-set-up-your-linkedin-profile",
            decision: "fold",
            note: "Do not add a third theory lesson. Message is the profile + the language from the client lock.",
          },
          {
            outcomeTitle: "Build Your Prospect List",
            currentTitle: "Finding Ideal Clients + Sales Navigator",
            courseId: "get-calls",
            lessonId: "get-calls-ideal-clients-linkedin-sales-navigator-build-your-prospect-list",
            decision: "keep",
            note: "Their list hid Sales Nav. Keep it. Mindset video can shrink into the opening.",
          },
        ],
      },
      {
        id: "get-calls-pipeline",
        title: "Build Your Call Pipeline",
        purpose: "Their pipeline names are the target. Most of this is still draft or sitting in Win Clients.",
        lessons: [
          {
            outcomeTitle: "Create Your Lead Capture System",
            currentTitle: "How to Use the BOSS Score Assessment",
            courseId: "get-calls",
            lessonId: "get-calls-boss-assessment-marketing-how-to-use-the-boss-score-assessment",
            decision: "rename",
            note: "BOSS is the capture asset. Title should be the outcome, not the product tour.",
          },
          {
            outcomeTitle: "Connect Your Calendar and Follow-Up",
            currentTitle: "How To Simplify Scheduling Meetings With Prospects",
            courseId: "get-calls",
            lessonId: "get-calls-calendar-setup-how-to-simplify-scheduling-meetins-with-prospects",
            decision: "fill",
            note: "Draft. This is a real hole. Tool first, then a short if-then.",
          },
          {
            outcomeTitle: "Set Up Your CRM Stages",
            currentTitle: "CRM Setup & Pipeline (Win Clients, draft)",
            courseId: "win-clients",
            lessonId: "profit-coach-os-crm-setup-usage-set-up-pipeline-stages",
            decision: "fill",
            note: "Belongs in Get Calls once it is real. Do not teach a long CRM course.",
          },
          {
            outcomeTitle: "Build Your Show-Up System",
            decision: "gap",
            note: "No lesson today. Add only when confirmation / no-show follow-up exists as a tool or a one-page if-then.",
          },
        ],
      },
      {
        id: "get-calls-lead-gen",
        title: "Launch Lead Generation",
        purpose: "Do not take Choose Your Lead Source. Connector is the source until another one ships.",
        lessons: [
          {
            outcomeTitle: "Choose Your Lead Source",
            decision: "skip",
            note: "Generic. Would hide Connector. If a second source appears, add a chapter, not a course.",
          },
          {
            outcomeTitle: "Create Your First Campaign",
            currentTitle: "Set Up & Launch Connector",
            courseId: "get-calls",
            lessonId: "get-calls-lead-generation-get-started-with-connector",
            decision: "rename",
            note: "Keep Connector in the body and the tool. Outcome title for the lesson.",
          },
          {
            outcomeTitle: "Start Conversations",
            currentTitle: "Connector Co-Pilot + Mistakes When Replying",
            courseId: "get-calls",
            lessonId: "get-calls-replying-to-leads-set-up-connector-co-pilot",
            decision: "fold",
            note: "Two lessons, one outcome. Opening: if they reply, do this.",
          },
          {
            outcomeTitle: "Follow Up Until You Get a Decision",
            currentTitle: "Run Your VIP Nurture",
            courseId: "get-calls",
            lessonId: "get-calls-lead-generation-run-your-vip-nurture",
            decision: "rename",
            note: "Guide-only. Rewrite as the follow-up if-then, not a nurture theory lesson.",
          },
          {
            outcomeTitle: "Diagnose Your Lead Flow",
            currentTitle: "Lead Gen Foundations",
            courseId: "get-calls",
            lessonId: "get-calls-lead-generation-lead-gen-foundations",
            decision: "later",
            note: "Useful after they have volume. Foundations can shrink to a one-page map, not a pre-campaign course.",
          },
        ],
      },
    ],
  },
  {
    id: "win-clients",
    title: "Win Clients",
    purpose: "Best take from that conversation: Offer → Run the process → Improve conversion. Do not explode into seven micro-lessons.",
    milestones: [
      {
        id: "win-offer",
        title: "Build the Offer",
        purpose: "One clear offer they can present. Split Package / Price / Proof only when a tool needs it.",
        lessons: [
          {
            outcomeTitle: "Package Your Expertise Into a Clear Outcome",
            currentTitle: "Design Your Coaching Offer",
            courseId: "win-clients",
            lessonId: "win-clients-design-your-coaching-offer",
            decision: "rename",
            note: "Keep as one lesson until an offer tool exists. 50 minutes should become lock-the-offer.",
          },
        ],
      },
      {
        id: "win-process",
        title: "Run the Sales Process",
        purpose: "Teach the conversation in order. Objections stay as chapters under one parent.",
        lessons: [
          {
            outcomeTitle: "Book and Run the Value Session",
            currentTitle: "Book & Run Value Sessions",
            courseId: "win-clients",
            lessonId: "win-clients-book-and-run-value-sessions",
            decision: "keep",
            note: "Do not split Discover / Diagnose / Value into three lessons. Chapters if needed.",
          },
          {
            outcomeTitle: "Present the Offer and Ask for the Sale",
            currentTitle: "Deliver Your Sales Pitch + Post-Pitch, Price & Close",
            courseId: "win-clients",
            lessonId: "win-clients-deliver-your-sales-pitch",
            decision: "fold",
            note: "119-minute close can become chapters: present, price, collect, book onboarding.",
          },
          {
            outcomeTitle: "Handle Objections",
            currentTitle: "Client Closing (8 lessons)",
            courseId: "win-clients",
            lessonId: "win-clients-client-closing-find-the-real-objection",
            decision: "fold",
            note: "One parent. Existing objection lessons become chapters. First screen of each is the if-then. Do not delete the branches.",
          },
        ],
      },
      {
        id: "win-improve",
        title: "Improve Your Close Rate",
        purpose: "Their best new milestone. Only after they have enough calls to see a leak.",
        lessons: [
          {
            outcomeTitle: "Find the biggest conversion leak",
            decision: "later",
            note: "Do not build this path now. A new coach has no data. Add when recorded-call review is a real habit.",
          },
        ],
      },
    ],
  },
  {
    id: "coach-clients",
    title: "Coach Clients",
    purpose: "Activate → Get results → Retain. Sessions 1–4 stay as activation. Profit System drops off the main path.",
    milestones: [
      {
        id: "coach-activate",
        title: "Activate the Client",
        purpose: "Do not flatten into Run the First Session. The first four sessions are the path.",
        lessons: [
          {
            outcomeTitle: "Complete the New Client Setup",
            currentTitle: "How To Setup A New Client",
            courseId: "coach-clients",
            lessonId: "coach-clients-client-onboarding-how-to-setup-a-new-client",
            decision: "rename",
            note: "Already short. Opening should be the setup checklist, not a tour.",
          },
          {
            outcomeTitle: "Run Sessions 1–4",
            currentTitle: "Session 1–4 + Coaching Sheet",
            courseId: "coach-clients",
            lessonId: "coach-clients-client-onboarding-session-1-profit-systems-dashboard",
            decision: "keep",
            note: "Keep the four sessions. Their generic first-session lesson would hide the method.",
          },
          {
            outcomeTitle: "If the session goes off plan",
            currentTitle: "Coaching Session FAQs",
            courseId: "coach-clients",
            lessonId: "coach-clients-coaching-session-faqs",
            decision: "rename",
            note: "Already a Decision Desk. Retitle satellites as if-thens. Keep them under activation / ongoing, not a new hub.",
          },
        ],
      },
      {
        id: "coach-results",
        title: "Create Results",
        purpose: "Shorten certification. One constraint, one next action, every session.",
        lessons: [
          {
            outcomeTitle: "Diagnose the constraint and run the session",
            currentTitle: "COACH Foundations / Powerful Questions / …",
            courseId: "coach-clients",
            lessonId: "coach-clients-certification-week-1-coach-foundations",
            decision: "fill",
            note: "100-minute method blocks become a short if-then plus practice. Do not add Diagnose / Action Plan / Track as four new lessons yet.",
          },
        ],
      },
      {
        id: "coach-retain",
        title: "Retain and Expand",
        purpose: "Rename off PROGRESS poetry into jobs. Reference tools stay out of the path.",
        lessons: [
          {
            outcomeTitle: "If they miss sessions or go quiet",
            currentTitle: "Client Retention (PROGRESS titles)",
            courseId: "coach-clients",
            lessonId: "coach-clients-retention-prevent-overwhelm",
            decision: "rename",
            note: "Prevent Overwhelm does not tell a newbie what to do. Retitle to the situation when we rewrite.",
          },
          {
            outcomeTitle: "If they want to cancel / if they hit the goal",
            decision: "gap",
            note: "Rescue, renew, proof, next offer. Add as if-then openings when we rewrite retention. Not a new course.",
          },
          {
            outcomeTitle: "Profit System tools",
            currentTitle: "Profit System: Frameworks & Tools",
            decision: "reference",
            note: "Stay as a library coaches open from a session, not a 60-lesson path.",
          },
        ],
      },
    ],
  },
];

export function classroomLessonHref(
  courseId: string,
  lessonId: string,
  basePath = "/admin/academy/classroom",
): string {
  return `${basePath}/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`;
}
