/**
 * Canonical app origin for links in emails, webhooks, and redirects.
 */
export function getAppBaseUrl(request?: Request): string {
  const fromEnv =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (request) {
    return new URL(request.url).origin;
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;

  return "http://localhost:3000";
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".local")
  );
}

/**
 * Public origin for calendar subscribe feeds.
 * Google/Outlook fetch the URL from their servers, so localhost never works.
 * Prefer CALENDAR_FEED_BASE_URL / NEXT_PUBLIC_APP_BASE_URL when APP_BASE_URL is local.
 */
export function getCalendarFeedBaseUrl(request?: Request): string {
  const dedicated =
    process.env.CALENDAR_FEED_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim();
  if (dedicated) return dedicated.replace(/\/$/, "");

  const base = getAppBaseUrl(request);
  try {
    if (!isLocalHostname(new URL(base).hostname)) return base;
  } catch {
    // fall through
  }

  // Local APP_BASE_URL (common in .env.local) — still return it so the UI can
  // warn / offer download; remote clients cannot fetch it.
  return base;
}
