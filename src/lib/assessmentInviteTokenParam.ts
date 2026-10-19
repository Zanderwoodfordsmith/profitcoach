/**
 * Assessment invite query param helpers, safe for the browser (database lookups stay in assessmentInviteToken.ts).
 */

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Query param on personalised /assessment links. */
export const ASSESSMENT_INVITE_PARAM = "c";

export function normalizeAssessmentInviteToken(
  raw: string | null | undefined
): string | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value || value.length > 36 || !UUID_RE.test(value)) return null;
  return value;
}
