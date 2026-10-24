/** Where a signed-in member can go from the 404 page, and our best guess at what they meant. */

export type NotFoundRole = "admin" | "coach" | "client";

export type NotFoundDestination = {
  href: string;
  label: string;
  description: string;
  /** Words in a broken URL that suggest this place. */
  keywords: string[];
  /** Shown in the list. The rest are only offered as a best guess. */
  listed: boolean;
};

function memberDestinations(prefix: "/coach" | "/admin"): NotFoundDestination[] {
  return [
    {
      href: `${prefix}/community`,
      label: "Community",
      description: "Posts, wins and questions from other coaches",
      keywords: ["community", "post", "posts", "feed", "wins", "members"],
      listed: true,
    },
    {
      href: `${prefix}/academy`,
      label: "Classroom",
      description: "Lessons and training, in order",
      keywords: ["academy", "classroom", "lesson", "lessons", "course", "courses", "training", "vault", "resources", "compass"],
      listed: true,
    },
    {
      href: prefix === "/coach" ? "/coach/blueprint" : "/admin/blueprint/coach",
      label: "My Blueprint",
      description: "Your practice plan, built from your answers",
      keywords: ["blueprint", "practice", "signature", "offer", "niche"],
      listed: true,
    },
    {
      href: `${prefix}/conversations`,
      label: "Get Clients",
      description: "Campaigns, conversations and sales calls",
      keywords: ["conversations", "campaign", "campaigns", "prospect", "prospects", "script", "scripts", "calls", "call", "linkedin", "content", "message", "messages", "lead", "leads", "pipeline", "newsletter", "share", "toolkit", "proposal", "proposals"],
      listed: true,
    },
    {
      href: `${prefix}/clients`,
      label: "Keep Clients",
      description: "Your clients, their BOSS Scores and playbooks",
      keywords: ["clients", "client", "playbook", "playbooks", "boss", "score", "levers", "welcome"],
      listed: true,
    },
    {
      href: `${prefix}/community/calendar`,
      label: "Calendar",
      description: "Live calls, trainings and recordings",
      keywords: ["calendar", "event", "events", "live", "recording", "recordings"],
      listed: false,
    },
    {
      href: prefix === "/coach" ? "/coach/settings" : "/admin/account",
      label: "Settings",
      description: "Your account, profile and billing",
      keywords: ["settings", "account", "profile", "billing", "membership", "password"],
      listed: false,
    },
    {
      href: `${prefix}/support`,
      label: "Support",
      description: "Ask the team for help",
      keywords: ["support", "help"],
      listed: true,
    },
  ];
}

const ADMIN_ONLY: NotFoundDestination[] = [
  {
    href: "/admin",
    label: "Coaches",
    description: "Every coach, their progress and payments",
    keywords: ["coaches", "coach", "payments", "financials"],
    listed: true,
  },
  {
    href: "/admin/roadmap",
    label: "Roadmap",
    description: "The Academy job queue",
    keywords: ["roadmap", "jobs", "job", "curriculum"],
    listed: true,
  },
];

const CLIENT: NotFoundDestination[] = [
  {
    href: "/client",
    label: "Your dashboard",
    description: "Your BOSS Score and what to work on next",
    keywords: ["dashboard", "score", "boss", "home"],
    listed: true,
  },
  {
    href: "/client/playbooks",
    label: "Playbooks",
    description: "The playbooks your coach has given you",
    keywords: ["playbook", "playbooks"],
    listed: true,
  },
  {
    href: "/client/goals",
    label: "Goals",
    description: "What you are working towards",
    keywords: ["goals", "goal", "plan"],
    listed: true,
  },
  {
    href: "/client/classroom",
    label: "Classroom",
    description: "Lessons from your coach",
    keywords: ["classroom", "lesson", "lessons", "course", "academy"],
    listed: true,
  },
];

export function destinationsForRole(role: NotFoundRole): NotFoundDestination[] {
  if (role === "client") return CLIENT;
  if (role === "admin") return [...ADMIN_ONLY, ...memberDestinations("/admin")];
  return memberDestinations("/coach");
}

/** Words in a path, e.g. "/coach/get-clients/scripts" → ["coach", "get", "clients", "scripts"]. */
function pathWords(pathname: string): string[] {
  return pathname
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
}

/**
 * The destination the broken link most likely meant, or null. The last
 * matching word wins, since URLs get more specific as they go.
 */
export function bestGuessDestination(
  pathname: string,
  destinations: NotFoundDestination[]
): NotFoundDestination | null {
  const words = pathWords(pathname);
  for (let i = words.length - 1; i >= 0; i--) {
    const hit = destinations.find((d) => d.keywords.includes(words[i]!));
    if (hit) return hit;
  }
  return null;
}
