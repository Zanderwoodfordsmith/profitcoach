import {
  findHubCourse,
  findLessonInCourse,
  firstLessonInCourse,
  type HubCatalog,
} from "@/lib/academy/hubCatalog";
import { loadClassroomHub } from "@/lib/academy/classroomHubLoad";

export type GrowthMapNode = {
  id: string;
  title: string;
  description: string;
  icon:
    | "target"
    | "search"
    | "list"
    | "message"
    | "badge"
    | "calendar"
    | "users"
    | "repeat"
    | "phone"
    | "handshake"
    | "sparkles"
    | "clipboard"
    | "compass"
    | "refresh";
  href: string | null;
  status: "available" | "coming-soon";
};

export type GrowthMapRow = {
  id: string;
  title: string;
  description: string;
  nodes: GrowthMapNode[];
};

export type GrowthMapSection = {
  id: "get-calls" | "win-clients" | "coach-clients";
  title: string;
  description: string;
  href: string;
  rows: GrowthMapRow[];
};

type LessonTarget = {
  id: string;
  title: string;
  description: string;
  icon: GrowthMapNode["icon"];
};

function lessonHref(
  catalog: HubCatalog,
  courseId: string,
  target: LessonTarget,
  basePath: string,
): GrowthMapNode {
  const course = findHubCourse(catalog, courseId);
  const lesson = course ? findLessonInCourse(course, target.id) : null;
  const isAvailable = Boolean(lesson);
  const href =
    isAvailable && course
      ? `${basePath}/${encodeURIComponent(course.id)}/${encodeURIComponent(target.id)}`
      : null;

  return {
    ...target,
    href,
    status: isAvailable ? "available" : "coming-soon",
  };
}

function courseHref(catalog: HubCatalog, courseId: string, basePath: string): string {
  const course = findHubCourse(catalog, courseId);
  const first = course ? firstLessonInCourse(course) : null;
  return first
    ? `${basePath}/${encodeURIComponent(courseId)}/${encodeURIComponent(first.id)}`
    : `${basePath}/${encodeURIComponent(courseId)}`;
}

export function buildGrowthSystemMap(
  basePath = "/admin/academy/classroom",
): GrowthMapSection[] {
  const catalog = loadClassroomHub();
  const getCalls = (target: LessonTarget) =>
    lessonHref(catalog, "get-calls", target, basePath);
  const winClients = (target: LessonTarget) =>
    lessonHref(catalog, "win-clients", target, basePath);
  const coachClients = (target: LessonTarget) =>
    lessonHref(catalog, "coach-clients", target, basePath);

  return [
    {
      id: "get-calls",
      title: "Get Calls",
      description:
        "Build a reliable flow of conversations with the right people.",
      href: courseHref(catalog, "get-calls", basePath),
      rows: [
        {
          id: "market",
          title: "Market",
          description:
            "Choose who you serve, understand their world, and know where to find them.",
          nodes: [
            getCalls({
              id: "get-calls-ideal-clients-how-to-choose-your-core-client",
              title: "Choose ideal client",
              description: "Set the filters for a good-fit prospect.",
              icon: "target",
            }),
            getCalls({
              id: "get-calls-ideal-clients-understand-your-ideal-client",
              title: "Understand them",
              description: "Learn the pains, outcomes, and language that matter.",
              icon: "search",
            }),
            getCalls({
              id: "get-calls-ideal-clients-linkedin-sales-navigator-build-your-prospect-list",
              title: "Find and list",
              description: "Build your working universe of prospects.",
              icon: "list",
            }),
          ],
        },
        {
          id: "message-setup",
          title: "Message & Setup",
          description:
            "Make the right message easy to find, then give people a simple next step.",
          nodes: [
            getCalls({
              id: "get-calls-linkedin-optimization-set-up-your-linkedin-profile",
              title: "Profile and positioning",
              description: "Make your point of view clear at a glance.",
              icon: "message",
            }),
            getCalls({
              id: "get-calls-boss-assessment-marketing-how-to-use-the-boss-score-assessment",
              title: "Lead asset and scorecard",
              description: "Give the conversation a useful next step.",
              icon: "badge",
            }),
            getCalls({
              id: "get-calls-calendar-setup-how-to-simplify-scheduling-meetins-with-prospects",
              title: "Calendar and booking",
              description: "Make booking a call simple.",
              icon: "calendar",
            }),
          ],
        },
        {
          id: "lead-gen",
          title: "Lead Gen",
          description:
            "Build the list, start the conversations, and keep the right people warm.",
          nodes: [
            getCalls({
              id: "get-calls-lead-generation-get-started-with-connector",
              title: "Connection requests",
              description: "Start conversations with good-fit people.",
              icon: "users",
            }),
            getCalls({
              id: "get-calls-lead-generation-run-your-vip-nurture",
              title: "Top 200 sequence",
              description: "Work 20 people a day through the sequence.",
              icon: "repeat",
            }),
            getCalls({
              id: "get-calls-lead-generation-run-your-vip-nurture",
              title: "Nurture",
              description: "Keep the right people warm until they are ready.",
              icon: "refresh",
            }),
          ],
        },
      ],
    },
    {
      id: "win-clients",
      title: "Win Clients",
      description:
        "Turn good conversations into clear decisions and paying clients.",
      href: courseHref(catalog, "win-clients", basePath),
      rows: [
        {
          id: "sales-room",
          title: "Sales room",
          description:
            "Use a calm, repeatable conversation to diagnose, present value, and close well.",
          nodes: [
            winClients({
              id: "win-clients-book-and-run-value-sessions",
              title: "Discovery call",
              description: "Understand the situation and the reason to act.",
              icon: "phone",
            }),
            winClients({
              id: "win-clients-book-and-run-value-sessions",
              title: "Value session",
              description: "Show the gap and the route forward.",
              icon: "handshake",
            }),
            winClients({
              id: "win-clients-deliver-your-sales-pitch",
              title: "Offer & close",
              description:
                "Present the right package, handle objections, and follow up.",
              icon: "sparkles",
            }),
          ],
        },
      ],
    },
    {
      id: "coach-clients",
      title: "Coach Clients",
      description:
        "Deliver a coaching experience that creates progress and keeps clients moving.",
      href: courseHref(catalog, "coach-clients", basePath),
      rows: [
        {
          id: "delivery-rhythm",
          title: "Delivery rhythm",
          description:
            "Start with clarity, guide the first 90 days, and build a rhythm clients want to stay with.",
          nodes: [
            coachClients({
              id: "coach-clients-client-onboarding-how-to-setup-a-new-client",
              title: "Onboard",
              description: "Create clarity and momentum from the start.",
              icon: "clipboard",
            }),
            coachClients({
              id: "coach-clients-client-onboarding-session-4-ninety-day-plan",
              title: "First 90 days",
              description: "Turn the diagnosis into a practical plan.",
              icon: "compass",
            }),
            coachClients({
              id: "coach-clients-coachiing-session-structure-how-to-use-the-coaching-sheet-in-sessions",
              title: "Ongoing rhythm",
              description: "Run sessions with a method you trust and keep progress visible.",
              icon: "repeat",
            }),
          ],
        },
      ],
    },
  ];
}
