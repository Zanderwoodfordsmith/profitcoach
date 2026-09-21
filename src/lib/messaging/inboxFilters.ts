export type InboxChannelFilter =
  | "all"
  | "linkedin"
  | "email"
  | "sms"
  | "whatsapp"
  | "instagram"
  | "messenger";

export type InboxFilterConversation = {
  contact_id?: string | null;
  booking_id?: string | null;
  last_channel?: string | null;
  last_direction?: string | null;
  in_campaign?: boolean;
  campaign_ids?: string[];
  prospect_tags?: string[];
  reply_channels?: string[];
};

export type InboxFilters = {
  needsReply: boolean;
  hasBooking: boolean;
  inCampaign: boolean;
  otherLinkedIn: boolean;
  campaignId: string | null;
  channel: InboxChannelFilter;
  tag: string | null;
};

export const EMPTY_INBOX_FILTERS: InboxFilters = {
  needsReply: false,
  hasBooking: false,
  inCampaign: false,
  otherLinkedIn: false,
  campaignId: null,
  channel: "all",
  tag: null,
};

export type InboxFlagFilter = "needsReply" | "hasBooking" | "inCampaign" | "otherLinkedIn";

/** LinkedIn thread that is not a CRM contact, campaign lead, or booking. */
export function isOtherLinkedInConversation(
  conversation: InboxFilterConversation
): boolean {
  const last = (conversation.last_channel || "").toLowerCase();
  const channels = (conversation.reply_channels || []).map((channel) =>
    channel.toLowerCase()
  );
  const isLinkedIn = last === "linkedin" || channels.includes("linkedin");
  if (!isLinkedIn) return false;
  if (conversation.contact_id?.trim()) return false;
  if (conversation.in_campaign) return false;
  if (conversation.booking_id?.trim()) return false;
  return true;
}

export function conversationMatchesChannel(
  conversation: InboxFilterConversation,
  channel: InboxChannelFilter
): boolean {
  if (channel === "all") return true;
  return (conversation.last_channel || "").toLowerCase() === channel;
}

export function inboxFiltersActive(filters: InboxFilters): boolean {
  return (
    filters.needsReply ||
    filters.hasBooking ||
    filters.inCampaign ||
    filters.otherLinkedIn ||
    Boolean(filters.campaignId) ||
    filters.channel !== "all" ||
    Boolean(filters.tag)
  );
}

export function toggleInboxFlag(
  prev: InboxFilters,
  key: InboxFlagFilter
): InboxFilters {
  const next = !prev[key];
  if (key === "otherLinkedIn") {
    return {
      ...prev,
      otherLinkedIn: next,
      inCampaign: next ? false : prev.inCampaign,
      campaignId: next ? null : prev.campaignId,
    };
  }
  if (key === "inCampaign") {
    return {
      ...prev,
      inCampaign: next,
      otherLinkedIn: next ? false : prev.otherLinkedIn,
    };
  }
  return { ...prev, [key]: next };
}

export function conversationMatchesFilters(
  conversation: InboxFilterConversation,
  filters: InboxFilters,
  options?: { searching?: boolean }
): boolean {
  const other = isOtherLinkedInConversation(conversation);
  if (filters.otherLinkedIn) {
    if (!other) return false;
  } else if (other && !options?.searching) {
    return false;
  }
  if (!conversationMatchesChannel(conversation, filters.channel)) return false;
  if (filters.needsReply && conversation.last_direction !== "inbound") {
    return false;
  }
  if (filters.hasBooking && !conversation.booking_id) return false;
  if (filters.inCampaign && !conversation.in_campaign) return false;
  if (filters.campaignId) {
    const ids = conversation.campaign_ids || [];
    if (!ids.includes(filters.campaignId)) return false;
  }
  if (filters.tag) {
    const needle = filters.tag.toLowerCase();
    const tags = conversation.prospect_tags || [];
    if (!tags.some((tag) => tag.toLowerCase() === needle)) return false;
  }
  return true;
}
