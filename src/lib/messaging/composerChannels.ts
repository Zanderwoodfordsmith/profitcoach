import {
  isMailingProvider,
  normalizeUnipileProvider,
} from "@/lib/unipile/providers";
import type { MessagingComposeChannel } from "@/lib/messaging/composeDraft";

export type ComposerReplyChannel = MessagingComposeChannel | "comment";

export type ComposerChannelOption = {
  id: ComposerReplyChannel;
  label: string;
  sendable: boolean;
  notConnected: boolean;
  noContact: boolean;
  blockedLabel: string | null;
};

export type ComposerChannelMenuSections = {
  visible: ComposerChannelOption[];
  hidden: ComposerChannelOption[];
  comment: ComposerChannelOption[];
};

const CHANNEL_LABEL: Record<ComposerReplyChannel, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  messenger: "Messenger",
  comment: "Internal Comment",
};

const CONNECTABLE_CHANNELS: ComposerReplyChannel[] = [
  "email",
  "linkedin",
  "whatsapp",
  "instagram",
  "messenger",
];

function noContactLabel(id: ComposerReplyChannel): string {
  switch (id) {
    case "email":
      return "No email";
    case "sms":
    case "whatsapp":
      return "No phone";
    case "linkedin":
      return "No LinkedIn";
    case "instagram":
      return "No Instagram";
    case "messenger":
      return "No Messenger";
    default:
      return "No contact";
  }
}

export function composerChannelBlockedLabel(option: {
  id: ComposerReplyChannel;
  notConnected: boolean;
  noContact: boolean;
}): string | null {
  if (!option.notConnected && !option.noContact) return null;
  const parts: string[] = [];
  if (option.notConnected) parts.push("Not connected");
  if (option.noContact) parts.push(noContactLabel(option.id));
  return parts.join(" · ");
}

export function connectedComposerChannels(input: {
  accounts: { provider: string; status?: string | null }[];
  adminOrgWideEmail?: boolean;
  accountsLoaded?: boolean;
}): Set<ComposerReplyChannel> {
  const connected = new Set<ComposerReplyChannel>(["sms", "comment"]);
  if (input.accountsLoaded === false) {
    for (const id of CONNECTABLE_CHANNELS) connected.add(id);
    return connected;
  }
  if (input.adminOrgWideEmail) connected.add("email");
  for (const row of input.accounts) {
    if ((row.status || "").toUpperCase() !== "OK") continue;
    if (isMailingProvider(row.provider)) {
      connected.add("email");
      continue;
    }
    const provider = normalizeUnipileProvider(row.provider);
    if (provider === "LINKEDIN") connected.add("linkedin");
    if (provider === "WHATSAPP") connected.add("whatsapp");
    if (provider === "INSTAGRAM") connected.add("instagram");
    if (provider === "MESSENGER") connected.add("messenger");
  }
  return connected;
}

function hasContactForChannel(
  id: ComposerReplyChannel,
  input: {
    last: string;
    hasEmail: boolean;
    hasPhone: boolean;
    hasLinkedIn: boolean;
  }
): boolean {
  switch (id) {
    case "sms":
      return input.hasPhone;
    case "whatsapp":
      return input.hasPhone || input.last === "whatsapp";
    case "email":
      return input.hasEmail || input.last === "email";
    case "linkedin":
      return input.hasLinkedIn;
    case "instagram":
      return input.last === "instagram";
    case "messenger":
      return input.last === "messenger";
    case "comment":
      return true;
  }
}

export function composerChannelOptions(input: {
  lastChannel?: string | null;
  prospectEmail?: string | null;
  prospectPhone?: string | null;
  prospectLinkedInUrl?: string | null;
  connected: ReadonlySet<ComposerReplyChannel>;
  includeInternalNote?: boolean;
}): ComposerChannelOption[] {
  const last = (input.lastChannel || "").toLowerCase();
  const hasPhone = Boolean(input.prospectPhone);
  const hasEmail = Boolean(input.prospectEmail);
  const hasLinkedIn = Boolean(input.prospectLinkedInUrl) || last === "linkedin";
  const ids: ComposerReplyChannel[] = [
    "sms",
    "whatsapp",
    "email",
    "linkedin",
    "instagram",
    "messenger",
  ];
  if (input.includeInternalNote !== false) ids.push("comment");

  return ids.map((id) => {
    const noContact = !hasContactForChannel(id, {
      last,
      hasEmail,
      hasPhone,
      hasLinkedIn,
    });
    const notConnected = !input.connected.has(id);
    const sendable = !noContact && !notConnected;
    return {
      id,
      label: CHANNEL_LABEL[id],
      sendable,
      notConnected,
      noContact,
      blockedLabel: composerChannelBlockedLabel({ id, notConnected, noContact }),
    };
  });
}

export function composerChannelMenuSections(
  options: ComposerChannelOption[],
  current: ComposerReplyChannel,
  draftChannel?: ComposerReplyChannel | null
): ComposerChannelMenuSections {
  const comment = options.filter((option) => option.id === "comment");
  const rest = options.filter((option) => option.id !== "comment");
  const visible = rest.filter(
    (option) =>
      option.sendable || option.id === current || option.id === draftChannel
  );
  const hidden = rest.filter(
    (option) => !visible.some((row) => row.id === option.id)
  );
  return { visible, hidden, comment };
}
