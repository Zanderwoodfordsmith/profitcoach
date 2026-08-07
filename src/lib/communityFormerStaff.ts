/**
 * Former staff who left BCA. Profiles stay so historical community posts keep
 * names/avatars; they are hidden from @-mention pickers and login is banned
 * separately. Mentions of their UUIDs notify the alias recipient after the cutoff.
 */

/** Mark James — main account (keep profile for post authorship). */
export const FORMER_STAFF_MARK_JAMES_ID =
  "9fa4ceb3-7605-42e2-b9a8-dd923814eac3";

/** Zac Fagan — main account (keep profile for post authorship). */
export const FORMER_STAFF_ZAC_FAGAN_ID =
  "4713d7f7-5733-4fcb-8559-4ad3befacffb";

/** Zander Woodford-Smith — admin who receives aliased @mentions. */
export const COMMUNITY_MENTION_ALIAS_RECIPIENT_ID =
  "01df174c-646c-4a29-8e76-9d0132735434";

/** Profiles that must not appear in the @-mention picker. */
export const FORMER_STAFF_HIDDEN_FROM_MENTIONS = new Set<string>([
  FORMER_STAFF_MARK_JAMES_ID,
  FORMER_STAFF_ZAC_FAGAN_ID,
]);

/**
 * When someone @mentions a former-staff UUID, notify this user instead.
 * Only applies to content created on/after {@link FORMER_STAFF_MENTION_ALIAS_AFTER_ISO}
 * so historical tags do not flood the alias inbox.
 */
export const FORMER_STAFF_MENTION_NOTIFICATION_ALIASES: Readonly<
  Record<string, string>
> = {
  [FORMER_STAFF_MARK_JAMES_ID]: COMMUNITY_MENTION_ALIAS_RECIPIENT_ID,
  [FORMER_STAFF_ZAC_FAGAN_ID]: COMMUNITY_MENTION_ALIAS_RECIPIENT_ID,
};

/** ISO cutoff: alias notifications only for content at/after this instant. */
export const FORMER_STAFF_MENTION_ALIAS_AFTER_ISO =
  "2026-08-03T17:30:00.000Z";

/** UUID strings to search in post/comment bodies for this viewer's mention inbox. */
export function mentionNotificationSearchIds(viewerId: string): string[] {
  const ids = new Set<string>([viewerId]);
  for (const [formerId, aliasTo] of Object.entries(
    FORMER_STAFF_MENTION_NOTIFICATION_ALIASES
  )) {
    if (aliasTo === viewerId) ids.add(formerId);
  }
  return [...ids];
}

/**
 * True when `body` should generate a mention notification for `viewerId`.
 * Direct self-mentions always count; aliased former-staff mentions only after
 * the cutoff (use `contentAt` = published_at or created_at).
 */
export function bodyMentionsViewerForNotification(
  body: string,
  viewerId: string,
  contentAt: string,
  extractMentionUserIds: (body: string) => string[]
): boolean {
  const mentioned = extractMentionUserIds(body);
  if (mentioned.includes(viewerId)) return true;

  const cutoffMs = Date.parse(FORMER_STAFF_MENTION_ALIAS_AFTER_ISO);
  const contentMs = Date.parse(contentAt);
  if (!Number.isFinite(contentMs) || contentMs < cutoffMs) return false;

  return mentioned.some(
    (id) => FORMER_STAFF_MENTION_NOTIFICATION_ALIASES[id] === viewerId
  );
}

export function isHiddenFromMentionPicker(userId: string): boolean {
  return FORMER_STAFF_HIDDEN_FROM_MENTIONS.has(userId);
}
