import type { UnipileConnectProvider } from "./providers";

/**
 * Unipile hosted auth `google_scopes` / `microsoft_scopes` replace the
 * dashboard default. Coach Google/Outlook powers mail AND booking, so we
 * always request both.
 *
 * `google_scopes` must be full Google URLs. Short names like `gmail.send`
 * are rejected (HTTP 400) and the connect falls back to Gmail-only.
 */
export const UNIPILE_GOOGLE_MAIL_AND_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
].join(",");

export const UNIPILE_MICROSOFT_MAIL_AND_CALENDAR_SCOPES = [
  "Mail.Read",
  "Mail.ReadWrite",
  "Mail.Send",
  "Calendars.Read",
  "Calendars.ReadWrite",
  "Calendars.Read.Shared",
  "Calendars.ReadWrite.Shared",
  "offline_access",
  "User.Read",
].join(",");

export function hostedAuthMailCalendarScopes(
  provider: UnipileConnectProvider
): { google_scopes?: string; microsoft_scopes?: string } {
  if (provider === "GOOGLE") {
    return { google_scopes: UNIPILE_GOOGLE_MAIL_AND_CALENDAR_SCOPES };
  }
  if (provider === "OUTLOOK") {
    return { microsoft_scopes: UNIPILE_MICROSOFT_MAIL_AND_CALENDAR_SCOPES };
  }
  return {};
}
