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

/** Coaches opening shared admin community links should land on the coach area. */
export function normalizeCommunityReturnPath(
  path: string,
  role: "admin" | "coach" | "client"
): string {
  if (role === "admin") return path;
  const match = path.match(/^(\/admin\/community(?:\/[^?]*)?)(\?.*)?$/);
  if (!match) return path;
  const subpath = match[1].slice("/admin/community".length);
  const query = match[2] ?? "";
  return `/coach/community${subpath}${query}`;
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
  if (safe) return normalizeCommunityReturnPath(safe, role);
  if (role === "admin") return "/admin/community";
  if (role === "client") return "/client";
  return "/coach/community";
}
