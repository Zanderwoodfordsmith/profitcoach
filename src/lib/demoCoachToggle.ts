import { adminPreviewCoachRouteForPath } from "@/lib/coachAccess/adminPreviewRoutes";
import {
  DEMO_COACH_LABEL,
  DEMO_COACH_SLUG,
  PAM_DEMO_COACH_LABEL,
  PAM_DEMO_COACH_SLUG,
} from "@/lib/primaryCoachConstants";

export {
  DEMO_COACH_LABEL,
  DEMO_COACH_SLUG,
  PAM_DEMO_COACH_LABEL,
  PAM_DEMO_COACH_SLUG,
};

export type DemoCoachToggleUser = {
  email: string;
  coachSlug: string;
  label: string;
};

const ZANDER_STAFF_EMAIL = "zander@businesscoachacademy.com";
const PAM_STAFF_EMAIL = "pam@businesscoachacademy.com";

/** Admins who own a one-click coaching demo account. */
export const DEMO_COACH_TOGGLE_USERS: DemoCoachToggleUser[] = [
  {
    email: ZANDER_STAFF_EMAIL,
    coachSlug: DEMO_COACH_SLUG,
    label: DEMO_COACH_LABEL,
  },
  {
    email: PAM_STAFF_EMAIL,
    coachSlug: PAM_DEMO_COACH_SLUG,
    label: PAM_DEMO_COACH_LABEL,
  },
];

/** Staff who can also jump into the other person's demo (not only their own). */
const STAFF_DEMO_CROSS_ACCESS_EMAILS = new Set([ZANDER_STAFF_EMAIL]);

export function demoCoachToggleUserForEmail(
  email: string | null | undefined
): DemoCoachToggleUser | null {
  if (!email?.trim()) return null;
  const normalized = email.trim().toLowerCase();
  return (
    DEMO_COACH_TOGGLE_USERS.find((user) => user.email === normalized) ?? null
  );
}

/** Demos this admin can open from the sidebar (own first, then others they can enter). */
export function staffDemosAccessibleToEmail(
  email: string | null | undefined
): DemoCoachToggleUser[] {
  if (!email?.trim()) return [];
  const normalized = email.trim().toLowerCase();
  const own = DEMO_COACH_TOGGLE_USERS.filter((user) => user.email === normalized);
  if (!STAFF_DEMO_CROSS_ACCESS_EMAILS.has(normalized)) return own;
  const others = DEMO_COACH_TOGGLE_USERS.filter(
    (user) => user.email !== normalized
  );
  return [...own, ...others];
}

/** Admin-only routes with no coach surface equivalent. */
const ADMIN_ONLY_PREFIXES = [
  "/admin/coaches",
  "/admin/coach-groups",
  "/admin/payments",
  "/admin/client-success",
  "/admin/cash-flow-forecast",
  "/admin/lead-finder",
  "/admin/sales-nav-imports",
  "/admin/roadmap",
  "/admin/lesson-import",
  "/admin/brand",
  "/admin/blog",
  "/admin/newsletter",
  "/admin/linkedin-inbox",
  "/admin/landing-analytics",
  "/admin/time-tracker",
  "/admin/action-plans",
  "/admin/growth-system",
  "/admin/academy/classroom/working",
  "/admin/settings",
  "/admin/funnel-settings",
  "/admin/links",
  "/admin/map",
  "/admin/feedback",
];

/** Coach-only routes with no admin surface equivalent. */
const COACH_ONLY_PREFIXES = ["/coach/membership", "/coach/income"];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isAdminOnlyPath(pathname: string): boolean {
  if (pathname === "/admin") return true;
  return ADMIN_ONLY_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

function isCoachOnlyPath(pathname: string): boolean {
  if (pathname === "/coach") return false;
  return COACH_ONLY_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

const ADMIN_BLUEPRINT_COACH = "/admin/blueprint/coach";
const COACH_BLUEPRINT = "/coach/blueprint";
/** Earlier coach URL. Still recognised so an old tab maps back to the same page. */
const COACH_BLUEPRINT_LEGACY = "/coach/practice";

/**
 * Admin Blueprint document ↔ the coach's own Blueprint.
 * Records and the map stay admin-only, so those land on the coach home.
 */
function coachBlueprintPath(pathname: string): string | null {
  if (pathname === "/admin/blueprint" || pathname === ADMIN_BLUEPRINT_COACH) {
    return COACH_BLUEPRINT;
  }
  if (pathname.startsWith(`${ADMIN_BLUEPRINT_COACH}/`)) {
    return `${COACH_BLUEPRINT}${pathname.slice(ADMIN_BLUEPRINT_COACH.length)}`;
  }
  if (matchesPrefix(pathname, "/admin/blueprint")) return COACH_BLUEPRINT;
  return null;
}

function coachBlueprintSuffix(pathname: string): string | null {
  for (const base of [COACH_BLUEPRINT, COACH_BLUEPRINT_LEGACY]) {
    if (pathname === base) return "";
    if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length);
  }
  return null;
}

function adminBlueprintPath(pathname: string): string | null {
  const suffix = coachBlueprintSuffix(pathname);
  if (suffix === null) return null;
  return `${ADMIN_BLUEPRINT_COACH}${suffix}`;
}

function remapPath(pathname: string, target: "admin" | "coach"): string | null {
  if (target === "coach") {
    const blueprint = coachBlueprintPath(pathname);
    if (blueprint) return blueprint;
    if (matchesPrefix(pathname, "/admin/account")) {
      return `/coach/settings${pathname.slice("/admin/account".length)}`;
    }
    if (matchesPrefix(pathname, "/admin/clients")) {
      return `/coach/clients${pathname.slice("/admin/clients".length)}`;
    }
    return null;
  }

  const blueprint = adminBlueprintPath(pathname);
  if (blueprint) return blueprint;
  if (matchesPrefix(pathname, "/coach/settings")) {
    return `/admin/account${pathname.slice("/coach/settings".length)}`;
  }
  if (matchesPrefix(pathname, "/coach/contacts")) {
    return `/admin/clients${pathname.slice("/coach/contacts".length)}`;
  }
  if (matchesPrefix(pathname, "/coach/clients")) {
    return `/admin/clients${pathname.slice("/coach/clients".length)}`;
  }
  return null;
}

function coachPathWithPreviewFallback(coachPath: string): string {
  const preview = adminPreviewCoachRouteForPath(coachPath);
  return preview?.fallback ?? coachPath;
}

/**
 * Where to navigate after toggling between admin and demo-coach impersonation.
 * Keeps the same screen when a coach/admin counterpart exists.
 */
export function pathAfterDemoCoachToggle(
  pathname: string,
  target: "admin" | "coach"
): string {
  const remapped = remapPath(pathname, target);
  if (remapped) {
    return target === "coach"
      ? coachPathWithPreviewFallback(remapped)
      : remapped;
  }

  if (target === "coach") {
    if (isAdminOnlyPath(pathname)) return "/coach";
    if (pathname.startsWith("/admin/")) {
      return coachPathWithPreviewFallback(
        `/coach${pathname.slice("/admin".length)}`
      );
    }
    if (pathname.startsWith("/coach/")) {
      return coachPathWithPreviewFallback(pathname);
    }
    return "/coach";
  }

  if (isCoachOnlyPath(pathname)) return "/admin";
  if (pathname.startsWith("/coach/")) {
    return `/admin${pathname.slice("/coach".length)}`;
  }
  if (pathname.startsWith("/admin/")) return pathname;
  return "/admin";
}
