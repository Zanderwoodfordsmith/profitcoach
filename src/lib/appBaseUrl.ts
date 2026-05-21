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
