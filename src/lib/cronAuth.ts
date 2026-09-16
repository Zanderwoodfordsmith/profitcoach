/**
 * Vercel Cron GET invocations.
 *
 * Current Vercel docs send `user-agent: vercel-cron/1.0` and
 * `x-vercel-cron-schedule`. They also send `Authorization: Bearer $CRON_SECRET`
 * when that env var is set. The old `x-vercel-cron: 1` header is no longer
 * guaranteed — checking only that left support-reply emails queued forever.
 */
export function isCronRequest(
  request: Request,
  extraSecrets: Array<string | undefined> = []
): boolean {
  const ua = (request.headers.get("user-agent") || "").trim();
  if (/^vercel-cron\//i.test(ua)) return true;
  if (request.headers.get("x-vercel-cron") === "1") return true;
  if (request.headers.get("x-vercel-cron-schedule")) return true;

  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const secrets = [
    process.env.CRON_SECRET?.trim(),
    process.env.LINKEDIN_CRON_SECRET?.trim(),
    process.env.HAPPY_SCRIBE_CRON_SECRET?.trim(),
    ...extraSecrets.map((s) => s?.trim()),
  ].filter(Boolean) as string[];
  return Boolean(bearer && secrets.includes(bearer));
}
