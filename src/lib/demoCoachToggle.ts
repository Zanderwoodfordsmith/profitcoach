import { adminPreviewCoachRouteForPath } from "@/lib/coachAccess/adminPreviewRoutes";
import {
  DEMO_COACH_LABEL,
  DEMO_COACH_SLUG,
} from "@/lib/primaryCoach";

export { DEMO_COACH_LABEL, DEMO_COACH_SLUG };

export type DemoCoachToggleUser = {
  email: string;
  coachSlug: string;
  label: string;
};

/** Admins who can one-click toggle into their coaching demo account. */
export const DEMO_COACH_TOGGLE_USERS: DemoCoachToggleUser[] = [
  {
    email: "zander@businesscoachacademy.com",
    coachSlug: DEMO_COACH_SLUG,
    label: DEMO_COACH_LABEL,
  },
  {
    email: "pam@businesscoachacademy.com",
    coachSlug: "pam",
    label: "Coach Pam",
  },
];

export function demoCoachToggleUserForEmail(
  email: string | null | undefined
): DemoCoachToggleUser | null {
  if (!email?.trim()) return null;
  const normalized = email.trim().toLowerCase();
  return (
    DEMO_COACH_TOGGLE_USERS.find((user) => user.email === normalized) ?? null
  );
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
  "/admin/lead-magnets",
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

function remapPath(pathname: string, target: "admin" | "coach"): string | null {
  if (target === "coach") {
    if (matchesPrefix(pathname, "/admin/account")) {
      return `/coach/settings${pathname.slice("/admin/account".length)}`;
    }
    if (matchesPrefix(pathname, "/admin/clients")) {
      return `/coach/clients${pathname.slice("/admin/clients".length)}`;
    }
    return null;
  }

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
