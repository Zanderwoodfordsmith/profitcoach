const DEFAULT_ALLOWED_EMAILS = ["pam@businesscoachacademy.com"];

function parseAllowedEmails(): string[] {
  const raw = process.env.COACH_CLIENT_HUB_ALLOWED_EMAILS?.trim();
  if (!raw) return DEFAULT_ALLOWED_EMAILS;
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function coachClientHubAllowedEmails(): string[] {
  return parseAllowedEmails();
}

export function isCoachClientHubAllowedEmail(
  email: string | null | undefined
): boolean {
  if (!email) return false;
  return parseAllowedEmails().includes(email.trim().toLowerCase());
}
