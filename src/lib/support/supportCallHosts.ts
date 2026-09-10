/**
 * Platform support-call booking hosts (admins who take 1:1 support calls).
 * Public pages: /support-call-zander, /support-call-pam
 * Calendar slug: support (20 min).
 * Zoom shortcuts: /zoom-zander, /zoom-pam → host PMI (public location uses theprofitcoach.com).
 */
export const SUPPORT_CALL_CALENDAR_SLUG = "support" as const;

/** Public join URLs shown on calendar invites (redirect to Zoom). */
export const SUPPORT_CALL_PUBLIC_ORIGIN = "https://theprofitcoach.com" as const;

export const SUPPORT_CALL_HOSTS = [
  {
    slug: "zander",
    displayName: "Zander",
    path: "/support-call-zander",
    zoomPath: "/zoom-zander",
    zoomJoinUrl: "https://us02web.zoom.us/j/9183502510",
  },
  {
    slug: "pam",
    displayName: "Pam",
    path: "/support-call-pam",
    zoomPath: "/zoom-pam",
    zoomJoinUrl: "https://us02web.zoom.us/j/7540888016",
  },
] as const;

export type SupportCallHostSlug = (typeof SUPPORT_CALL_HOSTS)[number]["slug"];

export function isSupportCallHostSlug(
  value: string | null | undefined
): value is SupportCallHostSlug {
  const s = (value ?? "").trim().toLowerCase();
  return SUPPORT_CALL_HOSTS.some((h) => h.slug === s);
}

export function supportCallHostDisplayName(slug: string): string {
  const hit = SUPPORT_CALL_HOSTS.find(
    (h) => h.slug === slug.trim().toLowerCase()
  );
  return hit?.displayName ?? slug;
}

export function supportCallHostPath(slug: string): string | null {
  const hit = SUPPORT_CALL_HOSTS.find(
    (h) => h.slug === slug.trim().toLowerCase()
  );
  return hit?.path ?? null;
}

/** Location string for support calendars (branded short link, not raw Zoom). */
export function supportCallMeetingLocationUrl(slug: string): string | null {
  const hit = SUPPORT_CALL_HOSTS.find(
    (h) => h.slug === slug.trim().toLowerCase()
  );
  if (!hit) return null;
  return `${SUPPORT_CALL_PUBLIC_ORIGIN}${hit.zoomPath}`;
}
