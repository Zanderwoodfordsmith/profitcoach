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
  /** Person is in the coach's Campaigns Pool (by contact, email, or LinkedIn). */
  in_pool?: boolean;
  /** contacts.type of the linked contact — "prospect" | "client". */
  contact_type?: string | null;
};

export type InboxFilters = {
  needsReply: boolean;
  hasBooking: boolean;
  inCampaign: boolean;
  inPool: boolean;
  isProspect: boolean;
  otherEmail: boolean;
  campaignId: string | null;
  channel: InboxChannelFilter;
  tag: string | null;
  excludeTags: string[];
};

export const EMPTY_INBOX_FILTERS: InboxFilters = {
  needsReply: false,
  hasBooking: false,
  inCampaign: false,
  inPool: false,
  isProspect: false,
  otherEmail: false,
  campaignId: null,
  channel: "all",
  tag: null,
  excludeTags: [],
};

export type InboxFlagFilter =
  | "needsReply"
  | "hasBooking"
  | "inCampaign"
  | "inPool"
  | "isProspect"
  | "otherEmail";

/** Flags that require a known person — never true for an "other" email thread. */
const WORK_PERSON_FLAGS = ["inCampaign", "inPool", "isProspect"] as const;
const OTHER_BUCKET_FLAGS = ["otherEmail"] as const;

/** Email thread that is not a prospect, pool person, campaign lead, or booking. */
export function isOtherEmailConversation(
  conversation: InboxFilterConversation
): boolean {
  const last = (conversation.last_channel || "").toLowerCase();
  if (last !== "email") return false;
  if ((conversation.contact_type || "").toLowerCase() === "prospect") {
    return false;
  }
  if (conversation.in_campaign) return false;
  if (conversation.in_pool) return false;
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
    filters.inPool ||
    filters.isProspect ||
    filters.otherEmail ||
    Boolean(filters.campaignId) ||
    filters.channel !== "all" ||
    Boolean(filters.tag) ||
    filters.excludeTags.length > 0
  );
}

export function toggleInboxFlag(
  prev: InboxFilters,
  key: InboxFlagFilter
): InboxFilters {
  const next = !prev[key];
  if ((OTHER_BUCKET_FLAGS as readonly string[]).includes(key)) {
    return {
      ...prev,
      [key]: next,
      inCampaign: next ? false : prev.inCampaign,
      inPool: next ? false : prev.inPool,
      isProspect: next ? false : prev.isProspect,
      campaignId: next ? null : prev.campaignId,
    };
  }
  if ((WORK_PERSON_FLAGS as readonly string[]).includes(key)) {
    return {
      ...prev,
      [key]: next,
      otherEmail: next ? false : prev.otherEmail,
    };
  }
  return { ...prev, [key]: next };
}

/** Case-insensitive toggle of one tag in the exclude list. */
export function toggleExcludedTag(prev: InboxFilters, tag: string): InboxFilters {
  const key = tag.toLowerCase();
  const has = prev.excludeTags.some((t) => t.toLowerCase() === key);
  const excludeTags = has
    ? prev.excludeTags.filter((t) => t.toLowerCase() !== key)
    : [...prev.excludeTags, tag];
  return {
    ...prev,
    excludeTags,
    // Including and excluding the same tag would match nothing.
    tag: !has && prev.tag?.toLowerCase() === key ? null : prev.tag,
  };
}

export function conversationMatchesFilters(
  conversation: InboxFilterConversation,
  filters: InboxFilters,
  options?: { searching?: boolean }
): boolean {
  const otherEmail = isOtherEmailConversation(conversation);
  if (filters.otherEmail) {
    if (!otherEmail) return false;
  } else if (otherEmail && !options?.searching) {
    return false;
  }
  if (!conversationMatchesChannel(conversation, filters.channel)) return false;
  if (filters.needsReply && conversation.last_direction !== "inbound") {
    return false;
  }
  if (filters.hasBooking && !conversation.booking_id) return false;
  if (filters.inCampaign && !conversation.in_campaign) return false;
  if (filters.inPool && !conversation.in_pool) return false;
  if (filters.isProspect && conversation.contact_type !== "prospect") {
    return false;
  }
  if (filters.campaignId) {
    const ids = conversation.campaign_ids || [];
    if (!ids.includes(filters.campaignId)) return false;
  }
  const tags = (conversation.prospect_tags || []).map((tag) =>
    tag.toLowerCase()
  );
  if (filters.tag && !tags.includes(filters.tag.toLowerCase())) return false;
  if (
    filters.excludeTags.length &&
    filters.excludeTags.some((tag) => tags.includes(tag.toLowerCase()))
  ) {
    return false;
  }
  return true;
}
