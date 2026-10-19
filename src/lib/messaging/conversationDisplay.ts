import { personNameWithoutNote } from "@/lib/prospectDisplayFormat";

/** Channel labels that used to be stored as the conversation title. */
const GENERIC_TITLES = new Set([
  "linkedin",
  "linkedin chat",
  "whatsapp",
  "whatsapp chat",
  "instagram",
  "instagram chat",
  "messenger",
  "messenger chat",
  "facebook messenger",
  "email",
  "email chat",
  "sms",
  "sms chat",
  "unknown",
  "unknown contact",
]);

export function isGenericConversationName(
  name: string | null | undefined,
  channel?: string | null
): boolean {
  const n = (name || "").trim();
  if (!n) return true;
  const lower = n.toLowerCase();
  if (GENERIC_TITLES.has(lower)) return true;
  if (channel) {
    const ch = channel.trim().toLowerCase();
    if (lower === ch || lower === `${ch} chat`) return true;
  }
  return false;
}

/**
 * LinkedIn chat titles often look like "Pam at Business Coach Academy".
 * That is not a person's name, and the company side is not our business field.
 */
export function splitLinkedInAtCompanyName(
  name: string | null | undefined
): { person: string; company: string } | null {
  const n = (name || "").trim();
  if (!n) return null;
  const match = n.match(/^(.+?)\s+at\s+(.+)$/i);
  if (!match) return null;
  const person = match[1].trim();
  const company = match[2].trim();
  if (!person || company.length < 2) return null;
  const personWords = person.split(/\s+/).filter(Boolean);
  if (personWords.length === 0 || personWords.length > 4) return null;
  if (/[?!]/.test(person) || /https?:\/\//i.test(person)) return null;
  if (/https?:\/\//i.test(company)) return null;
  return { person, company };
}

/** InMail subjects and first-message snippets are not a person's name. */
export function looksLikePersonName(name: string | null | undefined): boolean {
  const n = (name || "").trim();
  if (!n || isGenericConversationName(n)) return false;
  if (n.includes("@") || n.includes("(")) return false;
  if (splitLinkedInAtCompanyName(n)) return false;
  if (n.length > 80) return false;
  if (/[?!]/.test(n) || /https?:\/\//i.test(n)) return false;
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 6) return false;
  return true;
}

/** Post-nominal letters such as MBA, FRSA, CMgr, MSc or PhD. Not McDonald. */
function looksLikeLetters(word: string): boolean {
  const upper = (word.match(/\p{Lu}/gu) ?? []).length;
  const lower = (word.match(/\p{Ll}/gu) ?? []).length;
  return upper >= 2 && lower <= 2;
}

function looksLikeShortName(part: string): boolean {
  const words = part.split(" ").filter(Boolean);
  return words.length >= 1 && words.length <= 3 && !looksLikeLetters(words[0]);
}

/** A tagline, note or list of letters starts here: " - ", " | ", ",", "(". */
const DISPLAY_NAME_TAIL = /\s*[|·•,]\s*|\s+[-–—]|[-–—]\s+|\s*[([]/;

/**
 * LinkedIn display names often carry letters, a tagline or a group list:
 * "Mervyn Pilley CMgr FRSA FAIA", "Christopher Breiner, MSc BA Hons",
 * "Myranda Love - Fractional COO". Keep the person's name in front.
 */
export function personNameFromDisplayName(
  name: string | null | undefined
): string | null {
  // Drop "(Liv)", "[ M.IPSA ]" and LinkedIn's "(13)" unread count.
  const n = (name || "")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!n) return null;
  if (looksLikePersonName(n)) return n;
  const parts = n.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3 && parts.slice(0, 3).every(looksLikeShortName)) {
    const shown = parts.slice(0, 3).join(", ");
    return parts.length > 3 ? `${shown} +${parts.length - 3}` : shown;
  }
  const words = n.split(DISPLAY_NAME_TAIL)[0].split(" ").filter(Boolean);
  const lettersAt = words.findIndex(looksLikeLetters);
  const person = (lettersAt === -1 ? words : words.slice(0, lettersAt)).join(" ");
  return looksLikePersonName(person) ? person : null;
}

export function isChannelOnlySubject(
  subject: string | null | undefined,
  channel?: string | null
): boolean {
  return isGenericConversationName(subject, channel);
}

export function conversationPersonName(input: {
  prospectFullName?: string | null;
  prospectName?: string | null;
  prospectEmail?: string | null;
  channel?: string | null;
}): string {
  for (const candidate of [
    input.prospectFullName,
    input.prospectName,
    input.prospectEmail,
  ]) {
    const raw = (candidate || "").trim();
    const value = personNameWithoutNote(raw);
    if (value && looksLikePersonName(value)) {
      return value;
    }
    const fromLinkedInTitle = splitLinkedInAtCompanyName(value)?.person;
    if (fromLinkedInTitle && looksLikePersonName(fromLinkedInTitle)) {
      return fromLinkedInTitle;
    }
    const fromDisplayName = personNameFromDisplayName(raw);
    if (fromDisplayName) return fromDisplayName;
    if (value.includes("@") && !isGenericConversationName(value, input.channel)) {
      return value;
    }
  }
  return "Unknown contact";
}

const MESSAGING_CHANNELS = [
  "linkedin",
  "whatsapp",
  "instagram",
  "messenger",
  "email",
  "sms",
] as const;

export function normalizeMessagingChannel(
  channel: string | null | undefined
): string | null {
  const c = (channel || "").trim().toLowerCase();
  if (!c || c === "system" || c === "comment") return null;
  if ((MESSAGING_CHANNELS as readonly string[]).includes(c)) return c;
  return c || null;
}

/** Most recent inbound reply channel first. Falls back to last_channel. */
export function inboundReplyChannels(
  messages: Array<{
    channel?: string | null;
    direction?: string | null;
    created_at?: string | null;
  }>,
  fallbackChannel?: string | null
): string[] {
  const latest = new Map<string, number>();
  for (const message of messages) {
    if ((message.direction || "").toLowerCase() !== "inbound") continue;
    const channel = normalizeMessagingChannel(message.channel);
    if (!channel) continue;
    const at = message.created_at ? new Date(message.created_at).getTime() : 0;
    const prev = latest.get(channel) ?? 0;
    if (at >= prev) latest.set(channel, at);
  }
  const ordered = [...latest.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([channel]) => channel);
  if (ordered.length) return ordered;
  const fallback = normalizeMessagingChannel(fallbackChannel);
  return fallback ? [fallback] : [];
}

