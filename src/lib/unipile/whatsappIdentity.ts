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
