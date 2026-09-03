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

/** InMail subjects and first-message snippets are not a person's name. */
export function looksLikePersonName(name: string | null | undefined): boolean {
  const n = (name || "").trim();
  if (!n || isGenericConversationName(n)) return false;
  if (n.length > 80) return false;
  if (/[?!]/.test(n) || /https?:\/\//i.test(n)) return false;
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 6) return false;
  return true;
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
    const value = (candidate || "").trim();
    if (value && looksLikePersonName(value)) {
      return value;
    }
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

