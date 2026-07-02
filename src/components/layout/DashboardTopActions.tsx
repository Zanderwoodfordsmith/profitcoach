"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check, ChevronDown, LogOut } from "lucide-react";
import {
  displayNameFromProfile,
  profileInitialsFromName,
} from "@/lib/communityProfile";
import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { supabaseClient } from "@/lib/supabaseClient";
import { fetchCommunityMentionNameMap } from "@/lib/communityFetchMentionNameMap";
import { extractMentionUserIds } from "@/lib/communityMentions";
import { communityPostCardPreview } from "@/lib/communityPostMarkdown";
import { communityPostPath } from "@/lib/communityPostSlug";
import {
  fetchUserCommentedPostIds,
  isWinNotificationEligible,
  isWinPostVisibleNow,
  loadPermanentlySkippedWinPostIds,
  resolveCommunityCategoryId,
} from "@/lib/adminWinsReplyQueue";
import {
  EMPTY_NOTIFICATION_READ_STATE,
  isNotificationUnread,
  loadNotificationReadState,
  markCommunityNotificationRead,
  markNotificationSectionRead,
  persistNotificationReadState,
  winNotificationIdForPost,
  type NotificationReadState,
} from "@/lib/communityNotificationReadState";
import type { ProspectNotificationItem } from "@/lib/prospectNotifications";

type DashboardTopActionsProps = {
  variant: "coach" | "admin";
  signingOut: boolean;
  onSignOut: () => void | Promise<void>;
  avatarOverride?: {
    name: string;
    avatarUrl: string | null;
  } | null;
  className?: string;
  /** Mobile top bar: bell only (account is in bottom nav). */
  notificationsOnly?: boolean;
};

function NotificationReadToggle({
  unread,
  onToggle,
}: {
  unread: boolean;
  onToggle: () => void;
}) {
  return (
    <span className="relative mt-2.5 flex shrink-0 items-center justify-center">
      <button
        type="button"
        aria-label={unread ? "Mark read" : "Mark unread"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }}
        className={`peer flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-slate-100 ${
          unread ? "" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
        }`}
      >
        {unread ? (
          <span className="h-3 w-3 rounded-full bg-blue-500" />
        ) : (
          <span className="h-3 w-3 rounded-full border-2 border-slate-300" />
        )}
      </button>
      <span className="pointer-events-none absolute -top-6 right-0 z-10 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-white opacity-0 transition peer-hover:opacity-100">
        {unread ? "Mark read" : "Mark unread"}
      </span>
    </span>
  );
}

type NotificationFilter = "all" | "mentions" | "replies" | "announcements" | "wins";
type NotificationSection = "community" | "prospects";

type NotificationItem = {
  id: string;
  type: Exclude<NotificationFilter, "all">;
  created_at: string;
  actor_name: string;
  actor_avatar_url: string | null;
  title: string;
  body: string;
  href: string;
};

const NOTIFICATION_ITEMS_MAX = 40;

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

export function DashboardTopActions({
  variant,
  signingOut,
  onSignOut,
  avatarOverride,
  className,
  notificationsOnly = false,
}: DashboardTopActionsProps) {
  const { profile, profileLoading, avatarLabel, avatarImageUrl } =
    useDashboardProfile(avatarOverride);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [section, setSection] = useState<NotificationSection>("community");
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [prospectNotifications, setProspectNotifications] = useState<
    ProspectNotificationItem[]
  >([]);
  const [readState, setReadState] = useState<NotificationReadState>(
    EMPTY_NOTIFICATION_READ_STATE
  );
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [loadingProspectNotifications, setLoadingProspectNotifications] =
    useState(false);

  const notificationsRef = useRef<HTMLDivElement>(null);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  const settingsHref = variant === "coach" ? "/coach/settings" : "/admin/account";
  const communityHref = variant === "coach" ? "/coach/community" : "/admin/community";
  const prospectsHref = variant === "coach" ? "/coach/prospects" : "/admin/prospects";
  const prospectsEnabled = variant === "coach";

  useEffect(() => {
    if (!profile?.id) return;
    setReadState(loadNotificationReadState(profile.id));
  }, [profile?.id]);

  const loadNotifications = useCallback(async () => {
    const uid = profile?.id;
    if (!uid) return;
    setLoadingNotifications(true);
    try {
      const [announcementsCategoryId, winsCategoryId] = await Promise.all([
        resolveCommunityCategoryId("announcements"),
        variant === "admin"
          ? resolveCommunityCategoryId("wins")
          : Promise.resolve(null),
      ]);

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

      const nowIso = new Date().toISOString();

      const postMentionsPromise = supabaseClient
        .from("community_posts")
        .select(
          `
            id,
            title,
            body,
            created_at,
            published_at,
            author_id,
            author:profiles!author_id ( id, full_name, first_name, last_name, avatar_url )
          `
        )
        .ilike("body", `%${uid}%`)
        .neq("author_id", uid)
        .lte("published_at", nowIso)
        .order("published_at", { ascending: false })
        .limit(NOTIFICATION_ITEMS_MAX);

      const commentMentionsPromise = supabaseClient
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
        .ilike("body", `%${uid}%`)
        .neq("author_id", uid)
        .order("created_at", { ascending: false })
        .limit(NOTIFICATION_ITEMS_MAX);

      const announcementsPromise = announcementsCategoryId
        ? supabaseClient
            .from("community_posts")
            .select(
              `
            id,
            title,
            body,
            created_at,
            published_at,
            author_id,
            category:community_categories!category_id ( slug ),
            author:profiles!author_id ( id, role, full_name, first_name, last_name, avatar_url )
          `
            )
            .eq("category_id", announcementsCategoryId)
            .neq("author_id", uid)
            .lte("published_at", new Date().toISOString())
            .order("published_at", { ascending: false })
            .limit(NOTIFICATION_ITEMS_MAX)
        : Promise.resolve({ data: [], error: null });

      const winsPromise =
        variant === "admin" && winsCategoryId
          ? supabaseClient
              .from("community_posts")
              .select(
                `
            id,
            title,
            body,
            created_at,
            published_at,
            author_id,
            category:community_categories!category_id ( slug ),
            author:profiles!author_id ( id, full_name, first_name, last_name, avatar_url )
          `
              )
              .eq("category_id", winsCategoryId)
              .neq("author_id", uid)
              .order("created_at", { ascending: false })
              .limit(NOTIFICATION_ITEMS_MAX)
          : Promise.resolve({ data: [], error: null });

      const [
        repliesRes,
        announcementsRes,
        winsRes,
        postMentionsRes,
        commentMentionsRes,
      ] = await Promise.all([
        repliesPromise,
        announcementsPromise,
        winsPromise,
        postMentionsPromise,
        commentMentionsPromise,
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

      type CommentRow = {
        id: string;
        post_id: string;
        body: string;
        created_at: string;
        author_id?: string;
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
      };

      const repliedCommentIds = new Set<string>();
      if (!repliesRes.error) {
        const rows = (repliesRes.data ?? []) as CommentRow[];
        for (const row of rows) {
          const author = Array.isArray(row.author)
            ? (row.author[0] ?? null)
            : (row.author ?? null);
          const post = Array.isArray(row.post)
            ? (row.post[0] ?? null)
            : (row.post ?? null);
          if (!author || !post) continue;
          const actor = displayNameFromProfile(author);
          repliedCommentIds.add(row.id);
          next.push({
            id: `reply:${row.id}`,
            type: "replies",
            created_at: row.created_at,
            actor_name: actor,
            actor_avatar_url: author.avatar_url ?? null,
            title: `${actor} replied to your post`,
            body: row.body.trim() || `On: ${post.title ?? "Community post"}`,
            href: communityPostPath(communityHref, {
              title: post.title ?? "Community post",
            }),
          });
        }
      }

      if (!postMentionsRes.error) {
        const rows = (postMentionsRes.data ?? []) as Array<{
          id: string;
          title: string | null;
          body: string;
          created_at: string;
          published_at?: string | null;
          author: AuthorRow | AuthorRow[] | null;
        }>;
        for (const row of rows) {
          if (!extractMentionUserIds(row.body).includes(uid)) continue;
          const author = Array.isArray(row.author)
            ? (row.author[0] ?? null)
            : (row.author ?? null);
          if (!author) continue;
          const actor = displayNameFromProfile(author);
          next.push({
            id: `mention-post:${row.id}`,
            type: "mentions",
            created_at: row.published_at ?? row.created_at,
            actor_name: actor,
            actor_avatar_url: author.avatar_url ?? null,
            title: `${actor} mentioned you in a post`,
            body: row.body.trim() || row.title?.trim() || "Community post",
            href: communityPostPath(communityHref, {
              title: row.title?.trim() || row.body?.trim() || "Community post",
            }),
          });
        }
      }

      if (!commentMentionsRes.error) {
        const rows = (commentMentionsRes.data ?? []) as CommentRow[];
        for (const row of rows) {
          if (repliedCommentIds.has(row.id)) continue;
          if (!extractMentionUserIds(row.body).includes(uid)) continue;
          const author = Array.isArray(row.author)
            ? (row.author[0] ?? null)
            : (row.author ?? null);
          const post = Array.isArray(row.post)
            ? (row.post[0] ?? null)
            : (row.post ?? null);
          if (!author || !post) continue;
          const actor = displayNameFromProfile(author);
          next.push({
            id: `mention-comment:${row.id}`,
            type: "mentions",
            created_at: row.created_at,
            actor_name: actor,
            actor_avatar_url: author.avatar_url ?? null,
            title: `${actor} mentioned you in a comment`,
            body: row.body.trim() || `On: ${post.title ?? "Community post"}`,
            href: communityPostPath(communityHref, {
              title: post.title ?? "Community post",
            }),
          });
        }
      }

      const mentionIds = new Set<string>();
      for (const item of next) {
        if (item.type !== "replies" && item.type !== "mentions") continue;
        for (const id of extractMentionUserIds(item.body)) mentionIds.add(id);
      }
      const mentionNameById =
        mentionIds.size > 0
          ? await fetchCommunityMentionNameMap([...mentionIds])
          : {};
      for (const item of next) {
        if (item.type !== "replies" && item.type !== "mentions") continue;
        item.body = communityPostCardPreview(item.body, mentionNameById);
      }

      if (!announcementsRes.error) {
        const rows = (announcementsRes.data ?? []) as Array<{
          id: string;
          title: string;
          body: string;
          created_at: string;
          published_at?: string | null;
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
            created_at: row.published_at ?? row.created_at,
            actor_name: actor,
            actor_avatar_url: author.avatar_url ?? null,
            title: `${actor} posted an announcement`,
            body: row.title?.trim() || row.body?.trim() || "New announcement",
            href: communityPostPath(communityHref, {
              title: row.title?.trim() || row.body?.trim() || "Community post",
            }),
          });
        }
      }

      if (variant === "admin" && !winsRes.error) {
        const rows = (winsRes.data ?? []) as Array<{
          id: string;
          title: string;
          body: string;
          created_at: string;
          published_at?: string | null;
          author: AuthorRow | AuthorRow[] | null;
          category: { slug: string } | { slug: string }[] | null;
        }>;
        const eligibleWinRows = rows.filter((row) => {
          const category = Array.isArray(row.category)
            ? (row.category[0] ?? null)
            : (row.category ?? null);
          if (!category || category.slug !== "wins") return false;
          if (
            !isWinPostVisibleNow(row.published_at ?? null, row.created_at)
          ) {
            return false;
          }
          return isWinNotificationEligible(
            row.published_at ?? null,
            row.created_at,
            uid
          );
        });
        const eligibleWinIds = eligibleWinRows.map((row) => row.id);
        const commentedWinIds = await fetchUserCommentedPostIds(uid, eligibleWinIds);
        const permanentlySkippedWinIds = loadPermanentlySkippedWinPostIds(uid);
        for (const row of eligibleWinRows) {
          if (
            commentedWinIds.has(row.id) ||
            permanentlySkippedWinIds.has(row.id)
          ) {
            markCommunityNotificationRead(uid, winNotificationIdForPost(row.id));
            continue;
          }
          const author = Array.isArray(row.author)
            ? (row.author[0] ?? null)
            : (row.author ?? null);
          if (!author) continue;
          const actor = displayNameFromProfile(author);
          next.push({
            id: winNotificationIdForPost(row.id),
            type: "wins",
            created_at: row.published_at ?? row.created_at,
            actor_name: actor,
            actor_avatar_url: author.avatar_url ?? null,
            title: `${actor} shared a win`,
            body: row.title?.trim() || row.body?.trim() || "New win",
            href: communityPostPath(communityHref, {
              title: row.title?.trim() || row.body?.trim() || "Community post",
            }),
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
  }, [communityHref, profile?.id, variant]);

  const loadProspectNotifications = useCallback(async () => {
    if (!prospectsEnabled) {
      setProspectNotifications([]);
      return;
    }
    const uid = profile?.id;
    if (!uid) return;
    setLoadingProspectNotifications(true);
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        setProspectNotifications([]);
        return;
      }

      const res = await fetch("/api/notifications/prospects", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        setProspectNotifications([]);
        return;
      }

      const body = (await res.json()) as {
        notifications?: ProspectNotificationItem[];
      };
      setProspectNotifications(body.notifications ?? []);
    } finally {
      setLoadingProspectNotifications(false);
    }
  }, [profile?.id, prospectsEnabled]);

  useEffect(() => {
    if (!profile?.id) return;
    void loadNotifications();
    if (prospectsEnabled) {
      void loadProspectNotifications();
    }
    const handle = window.setInterval(() => {
      void loadNotifications();
      if (prospectsEnabled) {
        void loadProspectNotifications();
      }
    }, 60_000);
    return () => window.clearInterval(handle);
  }, [loadNotifications, loadProspectNotifications, profile?.id, prospectsEnabled]);

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

  const communityUnreadCount = useMemo(() => {
    let count = 0;
    for (const n of notifications) {
      if (isNotificationUnread(n, readState)) count += 1;
    }
    return count;
  }, [notifications, readState]);

  const prospectsUnreadCount = useMemo(() => {
    if (!prospectsEnabled) return 0;
    let count = 0;
    for (const n of prospectNotifications) {
      if (isNotificationUnread(n, readState)) count += 1;
    }
    return count;
  }, [prospectNotifications, readState, prospectsEnabled]);

  const unreadCount = communityUnreadCount + prospectsUnreadCount;

  const markSectionAsRead = useCallback(
    (target: NotificationSection) => {
      if (!profile?.id) return;
      setReadState(markNotificationSectionRead(profile.id, target));
    },
    [profile?.id]
  );

  const markOneAsRead = useCallback(
    (id: string) => {
      if (!profile?.id) return;
      setReadState((prev) => {
        if (prev.readIds[id] && !prev.unreadIds?.[id]) return prev;
        const nextUnreadIds = { ...(prev.unreadIds ?? {}) };
        delete nextUnreadIds[id];
        const next: NotificationReadState = {
          ...prev,
          readIds: { ...prev.readIds, [id]: true },
          unreadIds: nextUnreadIds,
        };
        persistNotificationReadState(profile.id, next);
        return next;
      });
    },
    [profile?.id]
  );

  const markOneAsUnread = useCallback(
    (id: string) => {
      if (!profile?.id) return;
      setReadState((prev) => {
        const nextReadIds = { ...prev.readIds };
        delete nextReadIds[id];
        const next: NotificationReadState = {
          ...prev,
          readIds: nextReadIds,
          unreadIds: { ...(prev.unreadIds ?? {}), [id]: true },
        };
        persistNotificationReadState(profile.id, next);
        return next;
      });
    },
    [profile?.id]
  );

  return (
    <div
      className={`fixed right-5 top-1.5 z-[90] flex items-center gap-3 ${className ?? ""}`}
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
            <div className="border-b border-slate-200 px-4 pt-3 pb-0">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <p className="text-lg font-semibold text-slate-900">Notifications</p>
                <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                  <button
                    type="button"
                    onClick={() => markSectionAsRead("community")}
                    disabled={communityUnreadCount === 0}
                    className="text-sm font-medium text-sky-700 hover:text-sky-800 disabled:cursor-default disabled:text-slate-400 disabled:hover:text-slate-400"
                  >
                    Mark community as read
                  </button>
                  {prospectsEnabled ? (
                    <>
                      <span aria-hidden className="text-slate-300">
                        ·
                      </span>
                      <button
                        type="button"
                        onClick={() => markSectionAsRead("prospects")}
                        disabled={prospectsUnreadCount === 0}
                        className="text-sm font-medium text-sky-700 hover:text-sky-800 disabled:cursor-default disabled:text-slate-400 disabled:hover:text-slate-400"
                      >
                        Mark prospects as read
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <nav
                  className="flex gap-5"
                  aria-label="Notification sections"
                >
                  {(
                    [
                      ["community", "Community", communityUnreadCount],
                      ...(prospectsEnabled
                        ? ([["prospects", "Prospects", prospectsUnreadCount]] as const)
                        : []),
                    ] as const
                  ).map(([value, label, unread]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSection(value)}
                      className={`relative border-b-2 px-0 pb-1.5 text-sm font-semibold transition ${
                        section === value
                          ? "border-[#0c5290] text-[#0c5290]"
                          : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
                      }`}
                    >
                      {label}
                      {unread > 0 ? (
                        <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-none text-white">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </nav>
                {section === "community" ? (
                  <div className="relative shrink-0" ref={filterMenuRef}>
                    <button
                      type="button"
                      onClick={() => setFilterMenuOpen((o) => !o)}
                      className="mb-0.5 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-200"
                    >
                      {filter === "all"
                        ? "All"
                        : filter === "mentions"
                          ? "Mentions"
                          : filter === "replies"
                            ? "Replies"
                            : filter === "announcements"
                              ? "Announcements"
                              : "Wins"}
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    {filterMenuOpen ? (
                      <div className="absolute right-0 z-10 mt-1 min-w-[12rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                        {(
                          [
                            ["all", "All"],
                            ["mentions", "Mentions"],
                            ["replies", "Replies"],
                            ["announcements", "Announcements"],
                            ...(variant === "admin"
                              ? ([["wins", "Wins"]] as const)
                              : []),
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
                ) : null}
              </div>
            </div>

            <div className="max-h-[32rem] overflow-y-auto">
              {section === "community" || !prospectsEnabled ? (
                loadingNotifications ? (
                  <p className="px-4 py-3 text-sm text-slate-500">Loading...</p>
                ) : filteredNotifications.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-500">
                    No community notifications yet.
                  </p>
                ) : (
                  <ul>
                    {filteredNotifications.map((item) => {
                      const unread = isNotificationUnread(item, readState);
                      const actorInitials = profileInitialsFromName(item.actor_name);
                      return (
                        <li key={item.id} className="border-b border-slate-200 last:border-b-0">
                          <Link
                            href={item.href}
                            onClick={() => {
                              markOneAsRead(item.id);
                              setNotificationsOpen(false);
                            }}
                            className="group flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50"
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
                            <NotificationReadToggle
                              unread={unread}
                              onToggle={() =>
                                unread
                                  ? markOneAsRead(item.id)
                                  : markOneAsUnread(item.id)
                              }
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : loadingProspectNotifications ? (
                <p className="px-4 py-3 text-sm text-slate-500">Loading...</p>
              ) : prospectNotifications.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-500">
                  No prospect activity yet.
                </p>
              ) : (
                <ul>
                  {prospectNotifications.map((item) => {
                    const unread = isNotificationUnread(item, readState);
                    const contactInitials = profileInitialsFromName(item.contact_name);
                    const actionText = item.title.replace(item.contact_name, "").trim();
                    return (
                      <li key={item.id} className="border-b border-slate-200 last:border-b-0">
                        <Link
                          href={item.href || prospectsHref}
                          onClick={() => {
                            markOneAsRead(item.id);
                            setNotificationsOpen(false);
                          }}
                          className="group flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50"
                        >
                          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sm font-semibold text-sky-800 ring-1 ring-sky-100">
                            {contactInitials}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-base leading-snug text-slate-900">
                              <span className="font-semibold">{item.contact_name}</span>{" "}
                              {actionText}
                              <span className="text-slate-500"> · {relativeAgo(item.created_at)}</span>
                            </p>
                            <p className="mt-1 line-clamp-2 text-sm text-slate-700">
                              {item.body}
                            </p>
                          </div>
                          <NotificationReadToggle
                            unread={unread}
                            onToggle={() =>
                              unread
                                ? markOneAsRead(item.id)
                                : markOneAsUnread(item.id)
                            }
                          />
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

      {!notificationsOnly ? (
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
          {avatarImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarImageUrl}
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
      ) : null}
    </div>
  );
}
