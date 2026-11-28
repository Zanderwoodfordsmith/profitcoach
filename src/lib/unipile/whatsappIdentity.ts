import { phoneMatchKey } from "@/lib/messaging/knownContacts";

/**
 * WhatsApp now addresses many chats by opaque Linked IDs (`…@lid`), not phone
 * numbers. Unipile still exposes the real MSISDN via `specifics.phone_number`
 * and/or `…@s.whatsapp.net` public identifiers.
 */

export function isWhatsAppLid(raw: string | null | undefined): boolean {
  const v = String(raw || "").trim().toLowerCase();
  return v.includes("@lid");
}

/** Digits from `447540888016@s.whatsapp.net` (or URL-encoded forms). */
export function phoneDigitsFromWhatsAppJid(
  raw: string | null | undefined
): string | null {
  if (!raw?.trim()) return null;
  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    /* keep raw */
  }
  const m = decoded.match(/(\d{8,15})@s\.whatsapp\.net/i);
  if (!m?.[1]) return null;
  return phoneMatchKey(m[1]);
}

/**
 * The other person's phone digits in a one-to-one WhatsApp chat (a Unipile
 * chat object, GET /chats/{id}). Null for groups (type 1 or 2, `@g.us`) and
 * chats with no real number. The chat object always names the other person,
 * unlike a message webhook, which can name the coach. Support and the coach
 * inbox both use this.
 */
export function whatsAppChatPhone(chat: Record<string, unknown>): string | null {
  if (Number(chat.type) !== 0) return null;
  const candidates = [
    chat.attendee_public_identifier,
    chat.provider_id,
    chat.attendee_provider_id,
  ].map((v) => (typeof v === "string" ? v : ""));
  if (candidates.some((v) => v.toLowerCase().includes("@g.us"))) return null;
  for (const c of candidates) {
    const digits = phoneDigitsFromWhatsAppJid(c);
    if (digits) return digits;
  }
  return null;
}

/**
 * Real WhatsApp phone digits (no leading +), never a Linked ID.
 * Prefer explicit phone fields, then `@s.whatsapp.net`, then legacy
 * phone-shaped provider ids (not `@lid`).
 */
export function whatsappPhoneDigits(input: {
  phoneNumber?: string | null;
  publicIdentifier?: string | null;
  providerId?: string | null;
  profileUrl?: string | null;
  name?: string | null;
}): string | null {
  const fromField = phoneMatchKey(input.phoneNumber);
  if (fromField) return fromField;

  const fromPublic =
    phoneDigitsFromWhatsAppJid(input.publicIdentifier) ||
    phoneDigitsFromWhatsAppJid(input.profileUrl);
  if (fromPublic) return fromPublic;

  if (input.providerId && !isWhatsAppLid(input.providerId)) {
    const fromProvider = phoneMatchKey(input.providerId);
    if (fromProvider) return fromProvider;
  }

  // Names are a last resort and must not be LID-shaped.
  if (input.name && !isWhatsAppLid(input.name)) {
    return phoneDigitsFromWhatsAppJid(input.name) || phoneMatchKey(input.name);
  }

  return null;
}

/** E.164-ish display/storage form (`+4475…`). */
export function whatsappPhoneE164(input: {
  phoneNumber?: string | null;
  publicIdentifier?: string | null;
  providerId?: string | null;
  profileUrl?: string | null;
  name?: string | null;
}): string | null {
  const digits = whatsappPhoneDigits(input);
  return digits ? `+${digits}` : null;
}

/**
 * Fake LinkedIn URLs we accidentally built from WhatsApp JIDs, e.g.
 * `https://www.linkedin.com/in/447540888016%40s.whatsapp.net/`
 */
export function phoneDigitsFromPollutedLinkedInUrl(
  url: string | null | undefined
): string | null {
  if (!url?.trim()) return null;
  if (!/whatsapp\.net/i.test(url) && !/%40s\.whatsapp/i.test(url)) {
    return null;
  }
  return phoneDigitsFromWhatsAppJid(url);
}

export function isPollutedWhatsAppLinkedInUrl(
  url: string | null | undefined
): boolean {
  return Boolean(phoneDigitsFromPollutedLinkedInUrl(url));
}
