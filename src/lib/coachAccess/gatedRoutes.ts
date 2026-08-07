import type { CoachFeature } from "@/lib/coachAccess/tiers";

/**
 * Full-page gated routes. When a coach lacks the feature we show a
 * context-relevant upgrade gate (page shown blurred/greyed with a modal in the
 * middle) instead of hiding or redirecting. Copy is per-route so the modal
 * speaks to what they opened.
 *
 * Order matters: more specific prefixes must come before their parents
 * (e.g. the calendar entry before the community feed entry).
 */
export type GatedRoute = {
  prefix: string;
  feature: CoachFeature;
  title: string;
  description: string;
};

export const GATED_ROUTES: GatedRoute[] = [
  {
    prefix: "/coach/community/calendar",
    feature: "calendar.momentum_only",
    title: "Community calendar",
    description:
      "See and book every live call, workshop and momentum session in one calendar. Membership keeps you plugged into the room.",
  },
  {
    prefix: "/coach/community",
    feature: "community.feed",
    title: "The community",
    description:
      "The community feed is where coaches share wins, ask questions and get support daily. Membership keeps you in the conversation.",
  },
  {
    prefix: "/coach/first-campaign",
    feature: "nav.marketing",
    title: "First Campaign",
    description:
      "A guided setup that takes you from LinkedIn import to ICP, avatar, messages, and a starter list of named prospects.",
  },
  {
    prefix: "/coach/prospects",
    feature: "nav.marketing",
    title: "Prospects",
    description:
      "Track every lead in one pipeline and know exactly who needs a follow-up, so opportunities stop slipping through the cracks.",
  },
  {
    prefix: "/coach/pipeline",
    feature: "nav.marketing",
    title: "Pipeline",
    description:
      "See every prospect on a simple board — who’s new, who’s in calls, and who needs a follow-up.",
  },
  {
    prefix: "/coach/calls",
    feature: "nav.marketing",
    title: "Calls",
    description:
      "See and manage your booked calls in one place, so your calendar and pipeline stay in sync.",
  },
  {
    prefix: "/coach/funnel-analyzer",
    feature: "nav.marketing",
    title: "Funnel Analyzer",
    description:
      "See where prospects drop off and where the money is, so you can fix the weak point instead of guessing.",
  },
  {
    prefix: "/coach/funnel-settings",
    feature: "nav.marketing",
    title: "Get Clients settings",
    description:
      "Set up your share links, CRM sync, and funnel landing copy so leads flow into your pipeline.",
  },
  {
    prefix: "/coach/boss-pro",
    feature: "nav.marketing",
    title: "Boss Pro",
    description:
      "Run the BOSS diagnostic for any client to show exactly where the money is and why your fee is justified.",
  },
  {
    prefix: "/coach/message-generator",
    feature: "nav.marketing",
    title: "AI Message Generator",
    description:
      "Draft high-converting outreach and follow-ups in seconds, tailored to each prospect.",
  },
  {
    prefix: "/coach/clients",
    feature: "nav.delivery",
    title: "Clients",
    description:
      "Manage your client book, delivery and progress in one place built for Profit Coaches.",
  },
  {
    prefix: "/coach/playbooks",
    feature: "nav.delivery",
    title: "Playbooks",
    description:
      "Give every client a clear, guided plan they can follow, so your delivery stays consistent and high-value.",
  },
  {
    prefix: "/coach/contacts",
    feature: "nav.delivery",
    title: "Contacts",
    description:
      "Keep every client and prospect organised in one CRM, without building your own tech stack.",
  },
];

export function gatedRouteForPath(pathname: string | null): GatedRoute | null {
  if (!pathname) return null;
  return GATED_ROUTES.find((route) => pathname.startsWith(route.prefix)) ?? null;
}

/* --------------------------------------------------------------------------
 * Classroom (academy) — the nav stays open to everyone, but individual
 * programmes are gated. Alumni keep a few starter programmes; the rest need
 * membership (classroom.full).
 * ------------------------------------------------------------------------ */

/** Programmes any coach (incl. Alumni) can open without membership. */
export const ALUMNI_FREE_COURSE_IDS: ReadonlySet<string> = new Set([
  "coach-action-plan",
  "going-pro",
  "profit-coach-certification",
]);

/** Client-safe course id → title map (kept in sync with archive-hub.json). */
export const ACADEMY_COURSE_TITLES: Record<string, string> = {
  kickstart: "Start Here",
  "coach-action-plan": "Coach Action Plan",
  "going-pro": "Going Pro",
  "get-calls": "Get Calls",
  "win-clients": "Win Clients",
  "profit-coach-certification": "Profit Coach Certification",
  "client-acquisition": "Client Acquisition",
  "client-delivery": "Client Delivery",
  "profit-coach-system": "Profit Coach System",
  "profit-coach-os": "Profit Coach OS",
  "profit-brand-framework": "PROFIT Brand & Framework",
  "not-in-classroom": "Archive",
};

const ACADEMY_RESERVED_SEGMENTS = new Set([
  "classroom",
  "compass",
  "archive",
  "programs",
  "simplified",
  "resources",
  "weekly-focus",
]);

/**
 * Extract the academy course id from a coach academy path, if any.
 *
 * Hub segments nest the course one level deeper
 * (`/coach/academy/classroom/going-pro/...`), so skip past them.
 */
export function academyCourseIdFromPath(
  pathname: string | null
): string | null {
  const prefix = "/coach/academy/";
  if (!pathname?.startsWith(prefix)) return null;

  for (const segment of pathname.slice(prefix.length).split("/").slice(0, 2)) {
    if (!segment) continue;
    const courseId = decodeURIComponent(segment);
    if (!ACADEMY_RESERVED_SEGMENTS.has(courseId)) return courseId;
  }
  return null;
}

/** True when a programme is locked for a coach with the given feature check. */
export function academyCourseLocked(
  courseId: string,
  hasFeature: (feature: CoachFeature) => boolean
): boolean {
  if (hasFeature("classroom.full")) return false;
  return !ALUMNI_FREE_COURSE_IDS.has(courseId);
}
