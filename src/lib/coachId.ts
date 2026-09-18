const COACH_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Impersonation header must be a UUID; garbage values are ignored. */
export function parseCoachIdHeader(
  value: string | null | undefined
): string | null {
  const id = (value ?? "").trim();
  return COACH_ID_RE.test(id) ? id : null;
}
