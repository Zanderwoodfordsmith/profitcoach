import { optionalLeadFlag } from "@/lib/salesNavigator/leadFlags";

export const OPEN_PROFILE_SEND_PREFIX = "open_profile:";
const OPEN_INMAIL_MAX_CHARS = 1900;

/** Default on: Open Profiles get a message instead of a connection request. */
export function inviteOpenProfileInmailFrom(config: unknown): boolean {
  const raw =
    config && typeof config === "object" && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : {};
  return raw.open_profile_inmail !== false;
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
