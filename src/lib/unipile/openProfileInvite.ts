import { templateFillIns } from "@/lib/campaigns/connectionNote";
import { optionalLeadFlag } from "@/lib/salesNavigator/leadFlags";

export const OPEN_PROFILE_SEND_PREFIX = "open_profile:";
export const OPEN_INMAIL_MAX_CHARS = 1900;

/**
 * Starting point for the Open Profile message, in the shape of BCA's LinkedIn
 * ads: a short opener, two numbered points, one proof line, a low-pressure ask.
 * Built on the Oct 2026 outreach review: name their tribe, use their words,
 * no link, no "coaching" or "free call", sell the next step, one question.
 */
export const OPEN_PROFILE_MESSAGE_TEMPLATE = `{{first_name}}, we've never met, but I work with a lot of [who you help, e.g. engineering MDs in the Midlands]. Do you ever feel [the problem they say most, e.g. busy all year, but the profit doesn't show it]?

I ask because there are usually two quick fixes:

1️⃣ [Fix one, e.g. find the jobs that make no money]

2️⃣ [Fix two, e.g. price the work that does]

[A client like them]: [their result with a number, e.g. £180k to £410k profit in 12 months].

Happy to show you where yours sits in 10 minutes. No pitch, just the numbers.

✅ Worth a look? If not, no worries at all.`;

/** Default on: Open Profiles get a message instead of a connection request. */
export function inviteOpenProfileInmailFrom(config: unknown): boolean {
  const raw =
    config && typeof config === "object" && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : {};
  return raw.open_profile_inmail !== false;
}

/**
 * The coach's own Open Profile message, ready to fill in, or null to send the
 * connection note instead. A draft with template [brackets] left never sends.
 */
export function ownOpenProfileMessage(config: unknown): string | null {
  const raw =
    config && typeof config === "object" && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : {};
  const text =
    typeof raw.open_profile_message === "string"
      ? raw.open_profile_message.trim()
      : "";
  if (!text || templateFillIns(text).length) return null;
  return text;
}

export function openProfileFlagFromUnknown(
  ...values: unknown[]
): boolean | null {
  return optionalLeadFlag(...values);
}

export function unipileProfileIsOpen(data: Record<string, unknown>): boolean | null {
  return optionalLeadFlag(
    data.is_open_profile,
    data.open_profile,
    data.openProfile
  );
}

export function isOpenProfileSendRef(providerRef: string | null | undefined): boolean {
  return String(providerRef || "").startsWith(OPEN_PROFILE_SEND_PREFIX);
}

export function openProfileSendRef(chatId: string | null, messageId: string | null): string {
  return `${OPEN_PROFILE_SEND_PREFIX}${chatId || messageId || "sent"}`;
}

export function isInmailRejected(err: {
  error?: string;
  raw?: unknown;
  status?: number;
}): boolean {
  const type = (err.raw as { type?: string } | undefined)?.type ?? "";
  const blob = `${err.error ?? ""} ${type}`.toLowerCase();
  return (
    type === "errors/not_allowed_inmail" ||
    type === "errors/insufficient_credits" ||
    type === "errors/no_connection_with_recipient" ||
    blob.includes("not_allowed_inmail") ||
    blob.includes("insufficient_credits") ||
    blob.includes("no_connection_with_recipient")
  );
}

export function openInmailText(note: string): string | null {
  const text = note.trim();
  if (!text) return null;
  return text.slice(0, OPEN_INMAIL_MAX_CHARS);
}

export function campaignLeadIsOpenProfile(lead: {
  open_profile?: unknown;
  metadata?: unknown;
}): boolean | null {
  const meta =
    lead.metadata && typeof lead.metadata === "object" && !Array.isArray(lead.metadata)
      ? (lead.metadata as Record<string, unknown>)
      : {};
  return openProfileFlagFromUnknown(
    lead.open_profile,
    meta.open_profile,
    meta.openProfile,
    meta.is_open_profile
  );
}

export function shouldSendOpenProfileInmail(input: {
  stepType: string;
  config: unknown;
  openProfile: boolean | null;
  note: string;
}): boolean {
  return (
    input.stepType === "invite" &&
    inviteOpenProfileInmailFrom(input.config) &&
    input.openProfile === true &&
    openInmailText(input.note) != null
  );
}

/** Open Profile InMails sit on an invite step but must not consume invite quota. */
export function jobUsesInviteQuota(
  stepType: string,
  providerRef: string | null | undefined
): boolean {
  if (stepType === "instagram_follow") return true;
  return stepType === "invite" && !isOpenProfileSendRef(providerRef);
}

export function jobUsesMessageQuota(
  stepType: string,
  providerRef: string | null | undefined
): boolean {
  if (stepType === "message" || stepType === "instagram" || stepType === "messenger") {
    return true;
  }
  return stepType === "invite" && isOpenProfileSendRef(providerRef);
}
