"use client";

import { markCommunityPostReadInStorage } from "@/lib/communityPostFeedLocalState";

export const COMMUNITY_NOTIFICATION_READ_KEY_PREFIX = "community:notifications";

export type NotificationReadState = {
  readIds: Record<string, true>;
  /** Explicitly marked unread; overrides readAllBefore cutoffs. */
  unreadIds?: Record<string, true>;
  /** Legacy global cutoff; used when section-specific cutoffs are unset. */
  readAllBefore: string | null;
  communityReadAllBefore?: string | null;
  prospectsReadAllBefore?: string | null;
};

export const EMPTY_NOTIFICATION_READ_STATE: NotificationReadState = {
  readIds: {},
  unreadIds: {},
  readAllBefore: null,
  communityReadAllBefore: null,
  prospectsReadAllBefore: null,
};

export function isProspectNotificationId(id: string): boolean {
  return id.startsWith("prospect:");
}

function sectionReadAllBefore(
  id: string,
  state: NotificationReadState
): string | null {
  if (isProspectNotificationId(id)) {
    return state.prospectsReadAllBefore ?? state.readAllBefore;
  }
  return state.communityReadAllBefore ?? state.readAllBefore;
}

export function isNotificationUnread(
  item: { id: string; created_at: string },
  state: NotificationReadState
): boolean {
  if (state.readIds[item.id]) return false;
  if (state.unreadIds?.[item.id]) return true;
  const readAllBefore = sectionReadAllBefore(item.id, state);
  if (!readAllBefore) return true;
  return (
    new Date(item.created_at).getTime() > new Date(readAllBefore).getTime()
  );
}

export function markNotificationSectionRead(
  uid: string,
  section: "community" | "prospects"
): NotificationReadState {
  const prev = loadNotificationReadState(uid);
  const now = new Date().toISOString();
  const nextUnreadIds: Record<string, true> = {};
  for (const id of Object.keys(prev.unreadIds ?? {})) {
    const belongsToSection =
      section === "prospects"
        ? isProspectNotificationId(id)
        : !isProspectNotificationId(id);
    if (!belongsToSection) nextUnreadIds[id] = true;
  }
  const next: NotificationReadState = {
    ...prev,
    unreadIds: nextUnreadIds,
    ...(section === "community"
      ? { communityReadAllBefore: now }
      : { prospectsReadAllBefore: now }),
  };
  persistNotificationReadState(uid, next);
  return next;
}

export function loadNotificationReadState(uid: string): NotificationReadState {
  if (typeof window === "undefined") return EMPTY_NOTIFICATION_READ_STATE;
  const raw = window.localStorage.getItem(
    `${COMMUNITY_NOTIFICATION_READ_KEY_PREFIX}:${uid}`
  );
  if (!raw) return EMPTY_NOTIFICATION_READ_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<NotificationReadState>;
    return {
      readIds: parsed.readIds ?? {},
      unreadIds: parsed.unreadIds ?? {},
      readAllBefore: parsed.readAllBefore ?? null,
      communityReadAllBefore: parsed.communityReadAllBefore ?? null,
      prospectsReadAllBefore: parsed.prospectsReadAllBefore ?? null,
    };
  } catch {
    return EMPTY_NOTIFICATION_READ_STATE;
  }
}

export function persistNotificationReadState(
  uid: string,
  next: NotificationReadState
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    `${COMMUNITY_NOTIFICATION_READ_KEY_PREFIX}:${uid}`,
    JSON.stringify(next)
  );
}

export function markCommunityNotificationRead(
  uid: string,
  notificationId: string
): void {
  const prev = loadNotificationReadState(uid);
  if (prev.readIds[notificationId] && !prev.unreadIds?.[notificationId]) return;
  const nextUnreadIds = { ...(prev.unreadIds ?? {}) };
  delete nextUnreadIds[notificationId];
  persistNotificationReadState(uid, {
    ...prev,
    readIds: { ...prev.readIds, [notificationId]: true },
    unreadIds: nextUnreadIds,
  });
}

export function winNotificationIdForPost(postId: string): string {
  return `win:${postId}`;
}

/** Bell unread + feed read when an admin has celebrated a win. */
export function markCommunityWinPostHandled(uid: string, postId: string): void {
  markCommunityNotificationRead(uid, winNotificationIdForPost(postId));
  markCommunityPostReadInStorage(uid, postId);
}
