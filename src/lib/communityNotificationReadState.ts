"use client";

import { markCommunityPostReadInStorage } from "@/lib/communityPostFeedLocalState";
import { supabaseClient } from "@/lib/supabaseClient";

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

function laterIso(
  a: string | null | undefined,
  b: string | null | undefined
): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function recordKeys(value: unknown): Record<string, true> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, true> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (key) out[key] = true;
  }
  return out;
}

export function normalizeNotificationReadState(
  raw: Partial<NotificationReadState> | null | undefined
): NotificationReadState {
  if (!raw) return { ...EMPTY_NOTIFICATION_READ_STATE };
  return {
    readIds: recordKeys(raw.readIds),
    unreadIds: recordKeys(raw.unreadIds),
    readAllBefore:
      typeof raw.readAllBefore === "string" ? raw.readAllBefore : null,
    communityReadAllBefore:
      typeof raw.communityReadAllBefore === "string"
        ? raw.communityReadAllBefore
        : null,
    prospectsReadAllBefore:
      typeof raw.prospectsReadAllBefore === "string"
        ? raw.prospectsReadAllBefore
        : null,
  };
}

/** True when the user has any persisted read signal (cutoffs or per-item marks). */
export function hasMeaningfulNotificationReadState(
  state: NotificationReadState
): boolean {
  if (state.readAllBefore) return true;
  if (state.communityReadAllBefore) return true;
  if (state.prospectsReadAllBefore) return true;
  if (Object.keys(state.readIds).length > 0) return true;
  if (Object.keys(state.unreadIds ?? {}).length > 0) return true;
  return false;
}

/**
 * Empty local/server state used to treat every historical item as unread.
 * Seed section cutoffs to now so backlog does not flood the bell.
 */
export function seedNotificationReadStateIfEmpty(
  state: NotificationReadState
): NotificationReadState {
  if (hasMeaningfulNotificationReadState(state)) return state;
  const now = new Date().toISOString();
  return {
    readIds: {},
    unreadIds: {},
    readAllBefore: now,
    communityReadAllBefore: now,
    prospectsReadAllBefore: now,
  };
}

export function mergeNotificationReadStates(
  a: NotificationReadState,
  b: NotificationReadState
): NotificationReadState {
  const readIds: Record<string, true> = { ...a.readIds, ...b.readIds };
  const unreadIds: Record<string, true> = {
    ...(a.unreadIds ?? {}),
    ...(b.unreadIds ?? {}),
  };
  for (const id of Object.keys(readIds)) {
    delete unreadIds[id];
  }
  return {
    readIds,
    unreadIds,
    readAllBefore: laterIso(a.readAllBefore, b.readAllBefore),
    communityReadAllBefore: laterIso(
      a.communityReadAllBefore,
      b.communityReadAllBefore
    ),
    prospectsReadAllBefore: laterIso(
      a.prospectsReadAllBefore,
      b.prospectsReadAllBefore
    ),
  };
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
    return normalizeNotificationReadState(
      JSON.parse(raw) as Partial<NotificationReadState>
    );
  } catch {
    return EMPTY_NOTIFICATION_READ_STATE;
  }
}

function persistNotificationReadStateLocal(
  uid: string,
  next: NotificationReadState
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    `${COMMUNITY_NOTIFICATION_READ_KEY_PREFIX}:${uid}`,
    JSON.stringify(next)
  );
}

let serverPersistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingServerPersist: { uid: string; state: NotificationReadState } | null =
  null;

async function upsertNotificationReadStateServer(
  uid: string,
  state: NotificationReadState
): Promise<void> {
  const { error } = await supabaseClient.from("notification_read_state").upsert(
    {
      user_id: uid,
      state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    // Prefer not to break the bell UX if sync fails; localStorage still applies.
    console.warn("notification_read_state upsert failed", error.message);
  }
}

function scheduleServerPersist(uid: string, state: NotificationReadState): void {
  pendingServerPersist = { uid, state };
  if (serverPersistTimer) clearTimeout(serverPersistTimer);
  serverPersistTimer = setTimeout(() => {
    const pending = pendingServerPersist;
    pendingServerPersist = null;
    serverPersistTimer = null;
    if (!pending) return;
    void upsertNotificationReadStateServer(pending.uid, pending.state);
  }, 300);
}

export function persistNotificationReadState(
  uid: string,
  next: NotificationReadState
): void {
  persistNotificationReadStateLocal(uid, next);
  scheduleServerPersist(uid, next);
}

/**
 * Load local + server state, seed if still empty, and write the resolved state back.
 * Call once when the dashboard profile id is known.
 */
export async function hydrateNotificationReadState(
  uid: string
): Promise<NotificationReadState> {
  const local = loadNotificationReadState(uid);
  let remote = EMPTY_NOTIFICATION_READ_STATE;

  const { data, error } = await supabaseClient
    .from("notification_read_state")
    .select("state")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) {
    console.warn("notification_read_state load failed", error.message);
  } else if (data?.state && typeof data.state === "object") {
    remote = normalizeNotificationReadState(
      data.state as Partial<NotificationReadState>
    );
  }

  const merged = seedNotificationReadStateIfEmpty(
    mergeNotificationReadStates(local, remote)
  );
  persistNotificationReadStateLocal(uid, merged);
  // Always mirror resolved state server-side (covers first-time seed).
  void upsertNotificationReadStateServer(uid, merged);
  return merged;
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
  markCommunityPostReadInStorage(uid, postId, { clearExplicitUnread: true });
}
