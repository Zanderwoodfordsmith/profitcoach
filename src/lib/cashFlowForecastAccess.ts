const DEFAULT_ALLOWED_EMAILS = ["zander@businesscoachacademy.com"];

function parseAllowedEmails(): string[] {
  const raw = process.env.CASH_FLOW_FORECAST_ALLOWED_EMAILS?.trim();
  if (!raw) return DEFAULT_ALLOWED_EMAILS;
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function cashFlowForecastAllowedEmails(): string[] {
  return parseAllowedEmails();
}

export function isCashFlowForecastAllowedEmail(
  email: string | null | undefined
): boolean {
  if (!email) return false;
  return parseAllowedEmails().includes(email.trim().toLowerCase());
}
