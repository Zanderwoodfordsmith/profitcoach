import { timingSafeEqual } from "node:crypto";

/**
 * Vercel Cron invocations.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` on every cron call when
 * that env var is set (it is, on Production). Headers such as
 * `user-agent: vercel-cron/1.0` or `x-vercel-cron-schedule` are NOT trusted:
 * anyone can send them. No secret configured = no cron access.
 */
export function isCronRequest(
  request: Request,
  extraSecrets: Array<string | undefined> = []
): boolean {
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!bearer) return false;
  const secrets = [
    process.env.CRON_SECRET?.trim(),
    process.env.LINKEDIN_CRON_SECRET?.trim(),
    process.env.HAPPY_SCRIBE_CRON_SECRET?.trim(),
    ...extraSecrets.map((s) => s?.trim()),
  ].filter(Boolean) as string[];
  const given = Buffer.from(bearer);
  return secrets.some((secret) => {
    const expected = Buffer.from(secret);
    return (
      expected.length === given.length && timingSafeEqual(expected, given)
    );
  });
}
