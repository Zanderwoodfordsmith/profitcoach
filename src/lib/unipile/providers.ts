/**
 * Unipile provider ↔ app messaging channel mapping.
 * Hosted auth providers: LINKEDIN | WHATSAPP | INSTAGRAM | MESSENGER | GOOGLE | OUTLOOK | …
 */

export const UNIPILE_CONNECT_PROVIDERS = [
  "LINKEDIN",
  "WHATSAPP",
  "INSTAGRAM",
  "MESSENGER",
  "GOOGLE",
  "OUTLOOK",
] as const;

export type UnipileConnectProvider =
  (typeof UNIPILE_CONNECT_PROVIDERS)[number];

/** App-side messaging_messages.channel values we persist for Unipile traffic. */
export type UnipileAppChannel =
  | "linkedin"
  | "whatsapp"
  | "instagram"
  | "messenger"
  | "email";

export function normalizeUnipileProvider(
  raw: string | null | undefined
): string {
  const t = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (!t) return "UNKNOWN";
  if (t === "GOOGLE_OAUTH" || t === "GMAIL") return "GOOGLE";
  if (t === "FACEBOOK" || t === "FB" || t === "FACEBOOK_MESSENGER")
    return "MESSENGER";
  if (t.includes("LINKEDIN")) return "LINKEDIN";
  if (t.includes("WHATSAPP")) return "WHATSAPP";
  if (t.includes("INSTAGRAM")) return "INSTAGRAM";
  if (t.includes("MESSENGER")) return "MESSENGER";
  if (t.includes("OUTLOOK") || t === "EXCHANGE") return "OUTLOOK";
  if (t === "MAIL" || t.includes("GOOGLE")) return t === "MAIL" ? "MAIL" : "GOOGLE";
  return t;
}

export function isConnectableProvider(
  raw: string | null | undefined
): raw is UnipileConnectProvider {
  const p = normalizeUnipileProvider(raw);
  return (UNIPILE_CONNECT_PROVIDERS as readonly string[]).includes(p);
}

export function isMailingProvider(provider: string): boolean {
  const p = normalizeUnipileProvider(provider);
  return p === "GOOGLE" || p === "OUTLOOK" || p === "MAIL" || p === "EXCHANGE";
}

export function isMessagingProvider(provider: string): boolean {
  const p = normalizeUnipileProvider(provider);
  return (
    p === "LINKEDIN" ||
    p === "WHATSAPP" ||
    p === "INSTAGRAM" ||
    p === "MESSENGER" ||
    p === "TELEGRAM" ||
    p === "TWITTER"
  );
}

export function providerToAppChannel(provider: string): UnipileAppChannel {
  const p = normalizeUnipileProvider(provider);
  switch (p) {
    case "WHATSAPP":
      return "whatsapp";
    case "INSTAGRAM":
      return "instagram";
    case "MESSENGER":
      return "messenger";
    case "GOOGLE":
    case "OUTLOOK":
    case "MAIL":
    case "EXCHANGE":
      return "email";
    case "LINKEDIN":
    default:
      return "linkedin";
  }
}

export function providerLabel(provider: string): string {
  const p = normalizeUnipileProvider(provider);
  switch (p) {
    case "LINKEDIN":
      return "LinkedIn";
    case "WHATSAPP":
      return "WhatsApp";
    case "INSTAGRAM":
      return "Instagram";
    case "MESSENGER":
      return "Facebook Messenger";
    case "GOOGLE":
      return "Gmail";
    case "OUTLOOK":
      return "Outlook";
    case "MAIL":
      return "Email (IMAP)";
    default:
      return p || "Account";
  }
}

export function channelLabel(channel: string): string {
  switch ((channel || "").toLowerCase()) {
    case "linkedin":
      return "LinkedIn";
    case "whatsapp":
      return "WhatsApp";
    case "instagram":
      return "Instagram";
    case "messenger":
      return "Messenger";
    case "email":
      return "Email";
    case "sms":
      return "SMS";
    default:
      return channel || "Message";
  }
}

export function displayNameFromUnipileAccount(
  raw: Record<string, unknown>,
  coachId?: string
): string | null {
  const params = raw.connection_params as
    | {
        im?: { username?: string; phone_number?: string };
        mail?: { username?: string; id?: string };
      }
    | undefined;
  const fromIm =
    params?.im?.username ||
    params?.im?.phone_number ||
    params?.mail?.username ||
    params?.mail?.id ||
    null;
  if (fromIm) return String(fromIm);
  const name = typeof raw.name === "string" ? raw.name : null;
  if (name && (!coachId || name !== coachId)) return name;
  return null;
}
