"use client";

import { markCommunityPostReadInStorage } from "@/lib/communityPostFeedLocalState";

export const COMMUNITY_NOTIFICATION_READ_KEY_PREFIX = "community:notifications";

export type NotificationReadState = {
  readIds: Record<string, true>;
  readAllBefore: string | null;
};

const EMPTY_READ_STATE: NotificationReadState = {
  readIds: {},
  readAllBefore: null,
};

export function loadNotificationReadState(uid: string): NotificationReadState {
  if (typeof window === "undefined") return EMPTY_READ_STATE;
  const raw = window.localStorage.getItem(
    `${COMMUNITY_NOTIFICATION_READ_KEY_PREFIX}:${uid}`
  );
  if (!raw) return EMPTY_READ_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<NotificationReadState>;
    return {
      readIds: parsed.readIds ?? {},
      readAllBefore: parsed.readAllBefore ?? null,
    };
  } catch {
    return EMPTY_READ_STATE;
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
  if (prev.readIds[notificationId]) return;
  persistNotificationReadState(uid, {
    ...prev,
    readIds: { ...prev.readIds, [notificationId]: true },
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
