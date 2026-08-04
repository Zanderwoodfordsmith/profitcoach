/** Who can use the admin Lead Finder (Zander-only by default). */

const DEFAULT_ALLOWED_EMAILS = ["zander@businesscoachacademy.com"];

function parseAllowedEmails(): string[] {
  const raw =
    process.env.LEAD_FINDER_ALLOWED_EMAILS?.trim() ||
    process.env.CASH_FLOW_FORECAST_ALLOWED_EMAILS?.trim();
  if (!raw) return DEFAULT_ALLOWED_EMAILS;
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isLeadFinderAllowedEmail(
  email: string | null | undefined
): boolean {
  if (!email) return false;
  return parseAllowedEmails().includes(email.trim().toLowerCase());
}
