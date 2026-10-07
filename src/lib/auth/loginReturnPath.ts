export const LOGIN_RETURN_QUERY = "next";

/** Reject open redirects; only same-origin relative paths are allowed. */
export function sanitizeLoginReturnPath(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw.trim());
  } catch {
    return null;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return null;
  if (decoded.includes("://")) return null;
  return decoded;
}

export function buildLoginUrl(returnPath?: string | null): string {
  const safe = sanitizeLoginReturnPath(returnPath ?? null);
  if (!safe) return "/login";
  return `/login?${LOGIN_RETURN_QUERY}=${encodeURIComponent(safe)}`;
}

/** First URL segment under /coach that is a real coach page. */
const COACH_SECTIONS = new Set([
  "academy",
  "academy-experiences",
  "boss-pro",
  "calls",
  "campaigns",
  "clients",
  "community",
  "contacts",
  "conversations",
  "feedback",
  "first-campaign",
  "funnel-analyzer",
  "funnel-settings",
  "ideal-client",
  "income",
  "ladder",
  "lead-magnets",
  "linkedin",
  "linkedin-profile",
  "links",
  "map",
  "membership",
  "message-generator",
  "pipeline",
  "playbooks",
  "practice",
  "prospects",
  "search",
  "settings",
  "share",
  "signature",
  "support",
]);

/** Shown when a coach opens an admin URL that has no coach page. */
export const COACH_ADMIN_UNAVAILABLE_PATH = "/coach/page-not-available";

/**
 * Coach twin of an admin URL, or null when that tool is admin-only.
 * Account settings map to the coach settings page.
 */
export function coachEquivalentOfAdminPath(path: string): string | null {
  const qIndex = path.indexOf("?");
  const pathname = qIndex === -1 ? path : path.slice(0, qIndex);
  const query = qIndex === -1 ? "" : path.slice(qIndex);
  if (pathname.startsWith("/admin/account")) {
    return `/coach/settings${pathname.slice("/admin/account".length)}${query}`;
  }
  const rest = pathname.startsWith("/admin/")
    ? pathname.slice("/admin/".length)
    : "";
  const section = rest.split("/")[0] ?? "";
  if (section && COACH_SECTIONS.has(section)) {
    return `/coach/${rest}${query}`;
  }
  return null;
}

/**
 * Where this role should actually land. Admins keep the path.
 * Coaches hitting /admin go to the matching coach screen, or a not-available
 * page when that tool has no coach version. Clients stay in the client portal.
 */
export function landingPathForRole(
  role: string | null | undefined,
  path: string
): string {
  if (role === "admin") return path;
  if (role === "client") {
    return path.startsWith("/client") ? path : "/client";
  }
  if (path.startsWith("/admin")) {
    return coachEquivalentOfAdminPath(path) ?? COACH_ADMIN_UNAVAILABLE_PATH;
  }
  if (path.startsWith("/coach")) return path;
  return "/coach/community";
}

/** Coaches opening shared admin community links should land on the coach area. */
export function normalizeCommunityReturnPath(
  path: string,
  role: "admin" | "coach" | "client"
): string {
  return landingPathForRole(role, path);
}

export function coachCommunityPathFromAdminPath(pathname: string): string | null {
  if (!pathname.startsWith("/admin/community")) return null;
  return `/coach/community${pathname.slice("/admin/community".length)}`;
}

export function resolvePostLoginPath(
  role: "admin" | "coach" | "client",
  nextParam: string | null
): string {
  const safe = sanitizeLoginReturnPath(nextParam);
  if (safe) return landingPathForRole(role, safe);
  if (role === "admin") return "/admin/community";
  if (role === "client") return "/client";
  return "/coach/community";
}
