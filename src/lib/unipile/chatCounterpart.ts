import { isGenericConversationName, looksLikePersonName } from "@/lib/messaging/conversationDisplay";
import { hrefFromUnipileLinkedIn } from "@/lib/unipile/linkedinUrl";
import { whatsappPhoneE164 } from "@/lib/unipile/whatsappIdentity";

export type UnipileChatAttendee = {
  id?: string;
  provider_id?: string;
  name?: string;
  picture_url?: string;
  profile_url?: string;
  is_self?: number | boolean;
  public_identifier?: string;
  specifics?: {
    provider?: string;
    occupation?: string;
    headline?: string;
    public_identifier?: string;
    phone_number?: string;
    lid?: string;
    contact_info?: { emails?: string[] };
  };
};

export type ChatCounterpart = {
  name: string | null;
  pictureUrl: string | null;
  profileUrl: string | null;
  providerId: string | null;
  /** Real MSISDN when known (WhatsApp); never a Linked ID. */
  phone: string | null;
  occupation: string | null;
  email: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isSelf(value: unknown): boolean {
  return value === 1 || value === true || value === "1";
}

export function parseUnipileAttendee(raw: unknown): UnipileChatAttendee | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const specifics = asRecord(rec.specifics);
  const contactInfo = asRecord(specifics?.contact_info);
  const emails = Array.isArray(contactInfo?.emails)
    ? (contactInfo.emails as unknown[])
    : [];
  return {
    id: asString(rec.id) ?? undefined,
    provider_id: asString(rec.provider_id) ?? undefined,
    name: asString(rec.name) ?? undefined,
    picture_url:
      asString(rec.picture_url) ??
      asString(rec.profile_picture_url) ??
      asString(rec.profile_pic_url) ??
      undefined,
    profile_url:
      asString(rec.profile_url) ??
      asString(rec.public_profile_url) ??
      undefined,
    public_identifier:
      asString(rec.public_identifier) ??
      asString(specifics?.public_identifier) ??
      undefined,
    is_self: rec.is_self as number | boolean | undefined,
    specifics: specifics
      ? {
          provider: asString(specifics.provider) ?? undefined,
          occupation: asString(specifics.occupation) ?? undefined,
          headline: asString(specifics.headline) ?? undefined,
          public_identifier: asString(specifics.public_identifier) ?? undefined,
          phone_number: asString(specifics.phone_number) ?? undefined,
          lid: asString(specifics.lid) ?? undefined,
          contact_info: {
            emails: emails
              .map((e) => asString(e))
              .filter((e): e is string => Boolean(e)),
          },
        }
      : undefined,
  };
}

const EMPTY_COUNTERPART: ChatCounterpart = {
  name: null,
  pictureUrl: null,
  profileUrl: null,
  providerId: null,
  phone: null,
  occupation: null,
  email: null,
};

function phoneFromAttendee(attendee: UnipileChatAttendee | undefined): string | null {
  if (!attendee) return null;
  return whatsappPhoneE164({
    phoneNumber: attendee.specifics?.phone_number,
    publicIdentifier: attendee.public_identifier,
    providerId: attendee.provider_id,
    profileUrl: attendee.profile_url,
    name: attendee.name,
  });
}

export function counterpartFromAttendees(
  attendees: UnipileChatAttendee[]
): ChatCounterpart {
  const others = attendees.filter((a) => !isSelf(a.is_self));
  const pool = others.length ? others : attendees;
  const named = pool.filter(
    (a) => asString(a.name) && !isGenericConversationName(a.name)
  );
  const names = named
    .map((a) => asString(a.name))
    .filter((n): n is string => Boolean(n));
  const first = named[0] || pool[0];
  const occupation =
    asString(first?.specifics?.occupation) ||
    asString(first?.specifics?.headline);
  const email = first?.specifics?.contact_info?.emails?.[0] ?? null;
  const isWhatsApp =
    String(first?.specifics?.provider || "").toUpperCase() === "WHATSAPP" ||
    Boolean(first?.specifics?.phone_number) ||
    Boolean(first?.specifics?.lid) ||
    /@s\.whatsapp\.net/i.test(first?.public_identifier || "") ||
    /@lid/i.test(first?.provider_id || "");
  return {
    name:
      names.length === 0
        ? null
        : names.length === 1
          ? names[0]
          : names.slice(0, 3).join(", "),
    pictureUrl: asString(first?.picture_url),
    // Only LinkedIn (and similar) profile URLs — never WhatsApp JIDs.
    profileUrl: isWhatsApp
      ? null
      : hrefFromUnipileLinkedIn(
          first?.profile_url,
          first?.public_identifier || first?.specifics?.public_identifier
        ),
    providerId: asString(first?.provider_id),
    phone: phoneFromAttendee(first),
    occupation,
    email,
  };
}

export function indexAttendeesByProviderId(
  attendees: UnipileChatAttendee[]
): Map<string, UnipileChatAttendee> {
  const map = new Map<string, UnipileChatAttendee>();
  for (const attendee of attendees) {
    if (isSelf(attendee.is_self)) continue;
    const providerId = asString(attendee.provider_id);
    if (providerId && !map.has(providerId)) map.set(providerId, attendee);
  }
  return map;
}

export function counterpartForChat(
  chat: Record<string, unknown>,
  attendeesByProviderId: Map<string, UnipileChatAttendee>,
  channel?: string | null
): ChatCounterpart {
  const chatName = asString(chat.name);
  const chatType = Number(chat.type);
  const isGroup = chatType === 1 || chatType === 2;
  const providerId =
    asString(chat.attendee_provider_id) ||
    asString(chat.attendeeProviderId);
  const matched = providerId
    ? attendeesByProviderId.get(providerId)
    : undefined;
  const fromAttendee = matched
    ? counterpartFromAttendees([matched])
    : EMPTY_COUNTERPART;

  if (isGroup) {
    return {
      name: looksLikePersonName(chatName) ? chatName : fromAttendee.name || chatName,
      pictureUrl: fromAttendee.pictureUrl,
      profileUrl: fromAttendee.profileUrl,
      providerId: providerId || fromAttendee.providerId,
      phone: fromAttendee.phone,
      occupation: fromAttendee.occupation,
      email: fromAttendee.email,
    };
  }

  return {
    name: fromAttendee.name,
    pictureUrl: fromAttendee.pictureUrl,
    profileUrl: fromAttendee.profileUrl,
    providerId: providerId || fromAttendee.providerId,
    phone:
      fromAttendee.phone ||
      whatsappPhoneE164({
        publicIdentifier: asString(chat.attendee_public_identifier),
        providerId,
      }),
    occupation: fromAttendee.occupation,
    email: fromAttendee.email,
  };
}

export function identityFromUnipileWebhook(
  body: Record<string, unknown>,
  channel?: string | null
): ChatCounterpart {
  const attendees = Array.isArray(body.attendees)
    ? body.attendees
        .map(parseUnipileAttendee)
        .filter((a): a is UnipileChatAttendee => Boolean(a))
    : [];
  const fromAttendees = counterpartFromAttendees(attendees);
  const sender = asRecord(body.sender);
  const senderName =
    asString(sender?.attendee_name) ||
    asString(sender?.name) ||
    asString(sender?.display_name);
  const senderPicture =
    asString(sender?.attendee_picture_url) ||
    asString(sender?.picture_url) ||
    asString(sender?.profile_picture_url);
  const senderProfile = hrefFromUnipileLinkedIn(
    asString(sender?.attendee_profile_url) || asString(sender?.profile_url)
  );
  const isSender = Boolean(body.is_sender);

  const webhookPhone =
    fromAttendees.phone ||
    whatsappPhoneE164({
      phoneNumber:
        asString(body.phone_number) ||
        asString(asRecord(body.specifics)?.phone_number),
      publicIdentifier:
        asString(body.attendee_public_identifier) ||
        asString(body.user_public_identifier) ||
        asString(sender?.attendee_public_identifier),
      providerId:
        asString(sender?.attendee_provider_id) ||
        asString(sender?.provider_id) ||
        fromAttendees.providerId,
      profileUrl:
        asString(sender?.attendee_profile_url) || asString(sender?.profile_url),
      name: senderName || fromAttendees.name,
    });

  if (
    !isSender &&
    senderName &&
    !isGenericConversationName(senderName, channel)
  ) {
    return {
      name: senderName,
      pictureUrl: senderPicture || fromAttendees.pictureUrl,
      profileUrl: senderProfile || fromAttendees.profileUrl,
      providerId:
        asString(sender?.attendee_provider_id) ||
        asString(sender?.provider_id) ||
        fromAttendees.providerId,
      phone: webhookPhone,
      occupation: fromAttendees.occupation,
      email: fromAttendees.email,
    };
  }

  if (fromAttendees.name) {
    return {
      ...fromAttendees,
      pictureUrl: fromAttendees.pictureUrl || senderPicture,
      phone: fromAttendees.phone || webhookPhone,
    };
  }

  return {
    name: null,
    pictureUrl: fromAttendees.pictureUrl || senderPicture,
    profileUrl: fromAttendees.profileUrl || senderProfile,
    providerId: fromAttendees.providerId,
    phone: webhookPhone,
    occupation: fromAttendees.occupation,
    email: fromAttendees.email,
  };
}

export function leadDisplayName(lead: {
  first_name?: string | null;
  last_name?: string | null;
} | null | undefined): string | null {
  if (!lead) return null;
  const name = [lead.first_name, lead.last_name]
    .map((p) => (p || "").trim())
    .filter(Boolean)
    .join(" ");
  return name || null;
}
