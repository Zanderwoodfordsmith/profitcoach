"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check, ChevronDown, LogOut } from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  displayNameFromProfile,
  profileInitialsFromName,
} from "@/lib/communityProfile";
import { fetchCommunityMentionNameMap } from "@/lib/communityFetchMentionNameMap";
import { extractMentionUserIds } from "@/lib/communityMentions";

type DashboardTopActionsProps = {
  variant: "coach" | "admin";
  signingOut: boolean;
  onSignOut: () => void | Promise<void>;
  className?: string;
};

type TopProfile = {
  id: string;
  role: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type NotificationFilter = "all" | "replies" | "announcements";

type NotificationItem = {
  id: string;
  type: NotificationFilter;
  created_at: string;
  actor_name: string;
  actor_avatar_url: string | null;
  title: string;
  body: string;
  href: string;
};

type NotificationReadState = {
  readIds: Record<string, true>;
  readAllBefore: string | null;
};

const NOTIFICATION_READ_KEY_PREFIX = "community:notifications";
const NOTIFICATION_ITEMS_MAX = 40;

const EMPTY_READ_STATE: NotificationReadState = {
  readIds: {},
  readAllBefore: null,
};

function loadReadState(uid: string): NotificationReadState {
  if (typeof window === "undefined") return EMPTY_READ_STATE;
  const raw = window.localStorage.getItem(`${NOTIFICATION_READ_KEY_PREFIX}:${uid}`);
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

function persistReadState(uid: string, next: NotificationReadState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    `${NOTIFICATION_READ_KEY_PREFIX}:${uid}`,
    JSON.stringify(next)
  );
}

function isUnread(item: NotificationItem, state: NotificationReadState): boolean {
  if (state.readIds[item.id]) return false;
  if (!state.readAllBefore) return true;
  return (
    new Date(item.created_at).getTime() > new Date(state.readAllBefore).getTime()
  );
}

function relativeAgo(iso: string): string {
  const now = Date.now();
  const at = new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor((now - at) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function replaceMentionIdsWithNames(
  text: string,
  mentionNameById: Record<string, string>
): string {
  if (!text) return text;
  return text.replace(/@([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi, (_full, id: string) => {
    const name = mentionNameById[id];
    return name ? `@${name}` : `@${id}`;
  });
}

export function DashboardTopActions({
  variant,
  signingOut,
  onSignOut,
  className,
}: DashboardTopActionsProps) {
  const [profile, setProfile] = useState<TopProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readState, setReadState] = useState<NotificationReadState>(EMPTY_READ_STATE);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const notificationsRef = useRef<HTMLDivElement>(null);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  const settingsHref = variant === "coach" ? "/coach/settings" : "/admin/account";
  const communityHref = variant === "coach" ? "/coach/community" : "/admin/community";

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    const { data } = await supabaseClient
      .from("profiles")
      .select("id, role, full_name, first_name, last_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    setProfile((data as TopProfile | null) ?? null);
    setReadState(loadReadState(user.id));
    setProfileLoading(false);
  }, []);

  const loadNotifications = useCallback(async () => {
    const uid = profile?.id;
    if (!uid) return;
    setLoadingNotifications(true);
    try {
      const repliesPromise = supabaseClient
        .from("community_post_comments")
        .select(
          `
            id,
            post_id,
            body,
            created_at,
            author_id,
            author:profiles!author_id ( id, full_name, first_name, last_name, avatar_url ),
            post:community_posts!post_id (
              id,
              title,
              author_id
            )
          `
        )
        .eq("post.author_id", uid)
        .neq("author_id", uid)
        .order("created_at", { ascending: false })
        .limit(NOTIFICATION_ITEMS_MAX);

      const announcementsPromise = supabaseClient
        .from("community_posts")
        .select(
          `
            id,
            title,
            body,
            created_at,
            author_id,
            category:community_categories!category_id ( slug ),
            author:profiles!author_id ( id, role, full_name, first_name, last_name, avatar_url )
          `
        )
        .eq("category.slug", "announcements")
        .neq("author_id", uid)
        .order("created_at", { ascending: false })
        .limit(NOTIFICATION_ITEMS_MAX);

      const [repliesRes, announcementsRes] = await Promise.all([
        repliesPromise,
        announcementsPromise,
      ]);

      type AuthorRow = {
        id: string;
        full_name: string | null;
        first_name: string | null;
        last_name: string | null;
        avatar_url: string | null;
        role?: string | null;
      };
      const next: NotificationItem[] = [];

      if (!repliesRes.error) {
        const rows = (repliesRes.data ?? []) as Array<{
          id: string;
          post_id: string;
          body: string;
          created_at: string;
          author: AuthorRow | AuthorRow[] | null;
          post:
            | {
                id: string;
                title: string | null;
                author_id: string;
              }
            | Array<{
                id: string;
                title: string | null;
                author_id: string;
              }>
            | null;
        }>;
        for (const row of rows) {
          const author = Array.isArray(row.author)
            ? (row.author[0] ?? null)
            : (row.author ?? null);
          const post = Array.isArray(row.post)
            ? (row.post[0] ?? null)
            : (row.post ?? null);
          if (!author || !post) continue;
          const actor = displayNameFromProfile(author);
          next.push({
            id: `reply:${row.id}`,
            type: "replies",
            created_at: row.created_at,
            actor_name: actor,
            actor_avatar_url: author.avatar_url ?? null,
            title: `${actor} replied to your post`,
            body: row.body.trim() || `On: ${post.title ?? "Community post"}`,
            href: `${communityHref}?post=${post.id}`,
          });
        }
      }

      const mentionIds = new Set<string>();
      for (const item of next) {
        if (item.type !== "replies") continue;
        for (const id of extractMentionUserIds(item.body)) mentionIds.add(id);
      }
      const mentionNameById =
        mentionIds.size > 0
          ? await fetchCommunityMentionNameMap([...mentionIds])
          : {};
      for (const item of next) {
        if (item.type !== "replies") continue;
        item.body = replaceMentionIdsWithNames(item.body, mentionNameById);
      }

      if (!announcementsRes.error) {
        const rows = (announcementsRes.data ?? []) as Array<{
          id: string;
          title: string;
          body: string;
          created_at: string;
          author: AuthorRow | AuthorRow[] | null;
          category: { slug: string } | { slug: string }[] | null;
        }>;
        for (const row of rows) {
          const category = Array.isArray(row.category)
            ? (row.category[0] ?? null)
            : (row.category ?? null);
          const author = Array.isArray(row.author)
            ? (row.author[0] ?? null)
            : (row.author ?? null);
          if (!category || category.slug !== "announcements" || !author) continue;
          if (author.role !== "admin") continue;
          const actor = displayNameFromProfile(author);
          next.push({
            id: `announcement:${row.id}`,
            type: "announcements",
            created_at: row.created_at,
            actor_name: actor,
            actor_avatar_url: author.avatar_url ?? null,
            title: `${actor} posted an announcement`,
            body: row.title?.trim() || row.body?.trim() || "New announcement",
            href: `${communityHref}?post=${row.id}`,
          });
        }
      }

      next.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setNotifications(next.slice(0, NOTIFICATION_ITEMS_MAX));
    } finally {
      setLoadingNotifications(false);
    }
  }, [communityHref, profile?.id]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!profile?.id) return;
    void loadNotifications();
    const handle = window.setInterval(() => {
      void loadNotifications();
    }, 60_000);
    return () => window.clearInterval(handle);
  }, [loadNotifications, profile?.id]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(target)) {
        setAvatarMenuOpen(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(target)) {
        setFilterMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filteredNotifications = useMemo(() => {
    if (filter === "all") return notifications;
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const unreadCount = useMemo(() => {
    let count = 0;
    for (const n of notifications) {
      if (isUnread(n, readState)) count += 1;
    }
    return count;
  }, [notifications, readState]);

  const avatarLabel = useMemo(() => {
    if (!profile) return "Account";
    return displayNameFromProfile(profile);
  }, [profile]);

  const markAllAsRead = useCallback(() => {
    if (!profile?.id) return;
    const next: NotificationReadState = {
      readIds: {},
      readAllBefore: new Date().toISOString(),
    };
    setReadState(next);
    persistReadState(profile.id, next);
  }, [profile?.id]);

  const markOneAsRead = useCallback(
    (id: string) => {
      if (!profile?.id) return;
      setReadState((prev) => {
        if (prev.readIds[id]) return prev;
        const next: NotificationReadState = {
          ...prev,
          readIds: { ...prev.readIds, [id]: true },
        };
        persistReadState(profile.id, next);
        return next;
      });
    },
    [profile?.id]
  );

  return (
    <div
      className={`fixed right-5 z-[90] flex items-center gap-3 ${className ?? "top-3"}`}
    >
      <div className="relative" ref={notificationsRef}>
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => {
            setNotificationsOpen((o) => !o);
            setAvatarMenuOpen(false);
          }}
          className="relative rounded-full bg-white p-2 text-slate-700 transition hover:bg-slate-50"
        >
          <Bell className="h-6 w-6" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-center text-[10px] font-bold leading-none text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </button>
        {notificationsOpen ? (
          <div className="absolute right-0 mt-2 w-[min(92vw,34rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <p className="text-lg font-semibold text-slate-900">Notifications</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-sm font-medium text-sky-700 hover:text-sky-800"
                >
                  Mark all as read
                </button>
                <div className="relative" ref={filterMenuRef}>
                  <button
                    type="button"
                    onClick={() => setFilterMenuOpen((o) => !o)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
                  >
                    {filter === "all"
                      ? "All"
                      : filter === "replies"
                        ? "Replies"
                        : "Announcements"}
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {filterMenuOpen ? (
                    <div className="absolute right-0 z-10 mt-1 min-w-[12rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                      {(
                        [
                          ["all", "All"],
                          ["replies", "Replies"],
                          ["announcements", "Announcements"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setFilter(value);
                            setFilterMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                            filter === value
                              ? "bg-amber-100 text-slate-900"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {label}
                          {filter === value ? <Check className="h-4 w-4" /> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="max-h-[32rem] overflow-y-auto">
              {loadingNotifications ? (
                <p className="px-4 py-4 text-sm text-slate-500">Loading...</p>
              ) : filteredNotifications.length === 0 ? (
                <p className="px-4 py-4 text-sm text-slate-500">
                  No notifications yet.
                </p>
              ) : (
                <ul>
                  {filteredNotifications.map((item) => {
                    const unread = isUnread(item, readState);
                    const actorInitials = profileInitialsFromName(item.actor_name);
                    return (
                      <li key={item.id} className="border-b border-slate-200 last:border-b-0">
                        <Link
                          href={item.href}
                          onClick={() => {
                            markOneAsRead(item.id);
                            setNotificationsOpen(false);
                          }}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50"
                        >
                          {item.actor_avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.actor_avatar_url}
                              alt=""
                              className="mt-0.5 h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                            />
                          ) : (
                            <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
                              {actorInitials}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-base leading-snug text-slate-900">
                              <span className="font-semibold">{item.actor_name}</span>{" "}
                              {item.title.replace(item.actor_name, "")}
                              <span className="text-slate-500"> · {relativeAgo(item.created_at)}</span>
                            </p>
                            <p className="mt-1 line-clamp-2 text-sm text-slate-700">
                              {item.body}
                            </p>
                          </div>
                          {unread ? (
                            <span
                              className="mt-4 h-3 w-3 shrink-0 rounded-full bg-blue-500"
                              aria-label="Unread"
                            />
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative" ref={avatarMenuRef}>
        <button
          type="button"
          aria-label="Account menu"
          onClick={() => {
            setAvatarMenuOpen((o) => !o);
            setNotificationsOpen(false);
          }}
          className="flex items-center rounded-full bg-white p-1 transition hover:bg-slate-50"
        >
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              className="h-10 w-10 rounded-full object-cover ring-1 ring-slate-200"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
              {profileInitialsFromName(avatarLabel)}
            </span>
          )}
        </button>
        {avatarMenuOpen ? (
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            <div className="border-b border-slate-100 px-3 py-2">
              <p className="truncate text-sm font-semibold text-slate-900">
                {profileLoading ? "Loading..." : avatarLabel}
              </p>
            </div>
            <Link
              href={settingsHref}
              className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setAvatarMenuOpen(false)}
            >
              Account settings
            </Link>
            <button
              type="button"
              onClick={() => {
                setAvatarMenuOpen(false);
                void onSignOut();
              }}
              disabled={signingOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {signingOut ? "Signing out..." : "Log out"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
