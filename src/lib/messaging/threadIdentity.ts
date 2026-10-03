import { looksLikePersonName } from "@/lib/messaging/conversationDisplay";

const EMAIL_IN_TEXT =
  /[a-z0-9][a-z0-9._%+-]*@[a-z0-9.-]+\.[a-z]{2,}/gi;

const STATED_EMAIL_LEAD =
  /^(my email is|my e-mail is|email is|e-mail is|email|e-mail|it is|it's|its|here's my email|here is my email)\s*[:\-]?\s*$/i;

/**
 * An address the other person gave as their own.
 * The whole message is the address, or a short lead-in plus that one address.
 * Long mail and messages that mention several addresses are ignored.
 */
export function statedCounterpartEmail(
  text: string | null | undefined
): string | null {
  const raw = (text || "").replace(/\s+/g, " ").trim();
  if (!raw || raw.length > 180) return null;
  const matches = raw.match(EMAIL_IN_TEXT) ?? [];
  if (matches.length !== 1) return null;
  const email = matches[0].toLowerCase().replace(/\.+$/, "");
  const rest = raw
    .replace(matches[0], " ")
    .replace(/[<>()[\],:;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!rest || STATED_EMAIL_LEAD.test(rest)) return email;
  return null;
}

/** Display name from a mailbox header, never the address itself. */
export function mailboxPersonName(input: {
  isSent: boolean;
  fromName?: string | null;
  toName?: string | null;
}): string | null {
  const raw = (input.isSent ? input.toName : input.fromName)?.trim() || "";
  if (!looksLikePersonName(raw)) return null;
  return raw.slice(0, 200);
}

/** Prefer a fuller real name over Unknown, an email, or a single token. */
export function bestPersonName(
  names: Array<string | null | undefined>
): string | null {
  let best: string | null = null;
  let score = -1;
  for (const candidate of names) {
    const name = (candidate || "").trim();
    if (!looksLikePersonName(name)) continue;
    const words = name.split(/\s+/).length;
    const next = words * 100 + Math.min(name.length, 80);
    if (next > score) {
      best = name;
      score = next;
    }
  }
  return best;
}
