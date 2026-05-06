"use client";

import type { RefObject } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CircleDot,
  Flag,
  ImagePlus,
  Link2,
  MoreHorizontal,
  Pencil,
  Pin,
  Star,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  displayNameFromProfile,
  profileInitialsFromName,
} from "@/lib/communityProfile";
import {
  buildNameMap,
  extractMentionUserIds,
} from "@/lib/communityMentions";
import type {
  CommunityCategory,
  CommunityPostRow,
  ProfileRow,
} from "@/components/community/CommunityFeed";
import { MentionBody } from "@/components/community/MentionBody";
import { CommunityPostMarkdownBody } from "@/components/community/CommunityPostMarkdownBody";
import { CommunityPostDetailMedia } from "@/components/community/CommunityPostDetailMedia";
import { MentionTextarea } from "@/components/community/MentionTextarea";
import { CommunityAuthorAvatar } from "@/components/community/CommunityAuthorAvatar";
import { PostEngagementBar } from "@/components/community/PostEngagementBar";
import { toggleCommunityCommentLike } from "@/lib/communityCommentLike";
import { toggleCommunityPostFavourite } from "@/lib/communityPostFavourite";
import { toggleCommunityPostLike } from "@/lib/communityPostLike";
import { setCommunityPostPinned } from "@/lib/communityPostPin";
import { isUndefinedRelationError } from "@/lib/communitySupabaseErrors";
import {
  fetchStaffAvatarMap,
  mergeAuthorAvatar,
} from "@/lib/communityStaffAvatars";
import {
  COMMUNITY_POST_MEDIA_MAX,
  communityPostMediaFingerprint,
  firstCommunityPostImageUrl,
  uploadCommunityPostMediaFile,
  type CommunityPostMediaItem,
} from "@/lib/communityPostMedia";
import { capitalizeFirstUnicodeLetter } from "@/lib/communityPostCapitalize";
import { postBodyNeedsTruncation } from "@/lib/communityPostBodyTruncation";
import {
  communityAccessHint,
  supabaseErrorMessage,
} from "@/lib/supabaseErrorMessage";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  coachPersonaForCommunity,
  getCommunityAuthorId,
} from "@/lib/communityEffectiveAuthorId";
import { formatCommunityPostTimestamp } from "@/lib/communityRelativeTime";
import { CommunityProfileHoverCard } from "@/components/community/CommunityProfileHoverCard";

type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  parent_comment_id: string | null;
  author: ProfileRow | null;
  like_count: number;
  liked_by_me: boolean;
};

function toLocalDateTimeInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function CommentLikeButton({
  likeCount,
  likedByMe,
  disabled,
  onToggle,
}: {
  likeCount: number;
  likedByMe: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs tabular-nums transition hover:bg-slate-200/70 disabled:opacity-50 ${
        likedByMe
          ? "font-medium text-sky-700"
          : "text-slate-500 hover:text-slate-800"
      }`}
      aria-pressed={likedByMe}
      aria-label={likedByMe ? "Unlike comment" : "Like comment"}
    >
      <ThumbsUp
        className={`h-3.5 w-3.5 shrink-0 ${likedByMe ? "fill-sky-600 text-sky-600" : ""}`}
        strokeWidth={2}
      />
      <span>{likeCount}</span>
    </button>
  );
}

type Props = {
  post: CommunityPostRow;
  categories: CommunityCategory[];
  onClose: () => void;
  onPostsChanged: () => void | Promise<void>;
  /** Effective profile id for community feed localStorage (auth user or impersonated coach). */
  feedStorageScopeId: string | null;
  onMarkPostRead: (postId: string) => void;
  onMarkPostUnread: (postId: string) => void;
  onMarkCommentsSeenUpTo: (postId: string, latestCommentIso: string) => void;
};

async function fetchProfilesByIds(ids: string[]): Promise<ProfileRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, full_name, first_name, last_name, avatar_url, role")
    .in("id", ids);
  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

function PostDetailOverflowMenu({
  menuRef,
  menuOpen,
  setMenuOpen,
  canManagePost,
  deleteBusy,
  favouriteBusy,
  pinBusy,
  favouritedByMe,
  isPinned,
  canPin,
  canMarkUnread,
  onEdit,
  onCopyLink,
  onToggleFavourite,
  onTogglePin,
  onMarkUnread,
  onReport,
  onDelete,
}: {
  menuRef: RefObject<HTMLDivElement | null>;
  menuOpen: boolean;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  canManagePost: boolean;
  deleteBusy: boolean;
  favouriteBusy: boolean;
  pinBusy: boolean;
  favouritedByMe: boolean;
  isPinned: boolean;
  canPin: boolean;
  canMarkUnread: boolean;
  onEdit: () => void;
  onCopyLink: () => void | Promise<void>;
  onToggleFavourite: () => void | Promise<void>;
  onTogglePin: () => void | Promise<void>;
  onMarkUnread: () => void;
  onReport: () => void;
  onDelete: () => void | Promise<void>;
}) {
  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label="Post actions"
        onClick={() => setMenuOpen((o) => !o)}
      >
        <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} />
      </button>
      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-[13.5rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {canManagePost ? (
            <>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                onClick={() => {
                  onEdit();
                  setMenuOpen(false);
                }}
              >
                <Pencil className="h-4 w-4 shrink-0 opacity-70" />
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                onClick={() => void onCopyLink()}
              >
                <Link2 className="h-4 w-4 shrink-0 opacity-70" />
                Copy link
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={favouriteBusy}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                onClick={() => {
                  void (async () => {
                    await onToggleFavourite();
                    setMenuOpen(false);
                  })();
                }}
              >
                <Star
                  className={`h-4 w-4 shrink-0 ${
                    favouritedByMe
                      ? "fill-amber-400 text-amber-500"
                      : "text-slate-500 opacity-80"
                  }`}
                  strokeWidth={2}
                />
                {favouritedByMe
                  ? "Remove from favourites"
                  : "Add to favourites"}
              </button>
              {canPin ? (
                <button
                  type="button"
                  role="menuitem"
                  disabled={pinBusy}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => {
                    void (async () => {
                      await onTogglePin();
                      setMenuOpen(false);
                    })();
                  }}
                >
                  <Pin
                    className={`h-4 w-4 shrink-0 ${isPinned ? "fill-sky-500 text-sky-600" : "text-slate-500 opacity-80"}`}
                    strokeWidth={2}
                  />
                  {isPinned ? "Unpin post" : "Pin post"}
                </button>
              ) : null}
              {canMarkUnread ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                  onClick={() => {
                    onMarkUnread();
                    setMenuOpen(false);
                  }}
                >
                  <CircleDot className="h-4 w-4 shrink-0 opacity-70" />
                  Mark as unread
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                onClick={onReport}
              >
                <Flag className="h-4 w-4 shrink-0 opacity-70" />
                Report to admins
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={deleteBusy}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                onClick={() => void onDelete()}
              >
                <Trash2 className="h-4 w-4 shrink-0 opacity-80" />
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                onClick={() => void onCopyLink()}
              >
                <Link2 className="h-4 w-4 shrink-0 opacity-70" />
                Copy link
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={favouriteBusy}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                onClick={() => {
                  void (async () => {
                    await onToggleFavourite();
                    setMenuOpen(false);
                  })();
                }}
              >
                <Star
                  className={`h-4 w-4 shrink-0 ${
                    favouritedByMe
                      ? "fill-amber-400 text-amber-500"
                      : "text-slate-500 opacity-80"
                  }`}
                  strokeWidth={2}
                />
                {favouritedByMe
                  ? "Remove from favourites"
                  : "Add to favourites"}
              </button>
              {canPin ? (
                <button
                  type="button"
                  role="menuitem"
                  disabled={pinBusy}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => {
                    void (async () => {
                      await onTogglePin();
                      setMenuOpen(false);
                    })();
                  }}
                >
                  <Pin
                    className={`h-4 w-4 shrink-0 ${isPinned ? "fill-sky-500 text-sky-600" : "text-slate-500 opacity-80"}`}
                    strokeWidth={2}
                  />
                  {isPinned ? "Unpin post" : "Pin post"}
                </button>
              ) : null}
              {canMarkUnread ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                  onClick={() => {
                    onMarkUnread();
                    setMenuOpen(false);
                  }}
                >
                  <CircleDot className="h-4 w-4 shrink-0 opacity-70" />
                  Mark as unread
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                onClick={onReport}
              >
                <Flag className="h-4 w-4 shrink-0 opacity-70" />
                Report to admins
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function PostDetailModal({
  post,
  categories,
  onClose,
  onPostsChanged,
  feedStorageScopeId,
  onMarkPostRead,
  onMarkPostUnread,
  onMarkCommentsSeenUpTo,
}: Props) {
  const pathname = usePathname();
  const { impersonatingCoachId } = useImpersonation();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentLikeBusyId, setCommentLikeBusyId] = useState<string | null>(
    null
  );
  const [nameById, setNameById] = useState<Record<string, string>>({});
  const [mentionProfileHrefByUserId, setMentionProfileHrefByUserId] =
    useState<Record<string, string>>({});
  const [newComment, setNewComment] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyOpenFor, setReplyOpenFor] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentEditDrafts, setCommentEditDrafts] = useState<
    Record<string, string>
  >({});
  const [commentMenuOpenId, setCommentMenuOpenId] = useState<string | null>(
    null
  );
  const [commentActionBusyId, setCommentActionBusyId] = useState<string | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const commentsAnchorRef = useRef<HTMLDivElement>(null);
  const composerShellRef = useRef<HTMLDivElement>(null);
  const [composerMultiline, setComposerMultiline] = useState(false);
  const [composerProfile, setComposerProfile] = useState<ProfileRow | null>(
    null
  );
  const [postAuthorDisplay, setPostAuthorDisplay] = useState<ProfileRow | null>(
    null
  );
  const postRef = useRef(post);
  postRef.current = post;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentAuthorId, setCurrentAuthorId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  /** After "Mark as unread", skip auto read until switching posts (mark unread bumps parent state). */
  const skipAutoMarkPostReadRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const postTitleRef = useRef<HTMLHeadingElement>(null);
  const [showCompactPostHeader, setShowCompactPostHeader] = useState(false);

  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editBody, setEditBody] = useState(post.body);
  const [editCategoryId, setEditCategoryId] = useState(post.category_id);
  const [editSchedulePopoverOpen, setEditSchedulePopoverOpen] = useState(false);
  const [editScheduledAtLocal, setEditScheduledAtLocal] = useState("");
  const [saveEditBusy, setSaveEditBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [favouriteBusy, setFavouriteBusy] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editorRole, setEditorRole] = useState<string | null>(null);
  type EditMediaSlot =
    | { key: string; type: "remote"; item: CommunityPostMediaItem }
    | {
        key: string;
        type: "local";
        file: File;
        previewUrl: string;
      };

  const [editMediaSlots, setEditMediaSlots] = useState<EditMediaSlot[]>([]);
  const prevEditingRef = useRef(false);

  useEffect(() => {
    if (editing && !prevEditingRef.current) {
      setEditMediaSlots(
        post.media.map((item, i) => ({
          key: `r-${post.id}-${i}-${item.url.slice(-24)}`,
          type: "remote" as const,
          item,
        }))
      );
    }
    prevEditingRef.current = editing;
  }, [editing, post.id, communityPostMediaFingerprint(post.media)]);

  useEffect(() => {
    if (editing) return;
    setEditMediaSlots((slots) => {
      for (const s of slots) {
        if (s.type === "local") URL.revokeObjectURL(s.previewUrl);
      }
      return [];
    });
  }, [editing]);

  useEffect(() => {
    setPostAuthorDisplay(post.author ?? null);
    setEditTitle(post.title);
    setEditBody(post.body);
    setEditCategoryId(post.category_id);
    if (post.published_at && new Date(post.published_at).getTime() > Date.now()) {
      setEditScheduledAtLocal(toLocalDateTimeInputValue(new Date(post.published_at)));
    } else {
      setEditScheduledAtLocal("");
    }
    setEditSchedulePopoverOpen(false);
    setEditing(false);
    setBodyExpanded(false);
  }, [
    post.id,
    post.author,
    post.title,
    post.body,
    post.category_id,
    communityPostMediaFingerprint(post.media),
  ]);

  useEffect(() => {
    void supabaseClient.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      setComposerProfile(null);
      return;
    }
    let cancelled = false;
    void fetchProfilesByIds([currentUserId]).then((rows) => {
      if (!cancelled) setComposerProfile(rows[0] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    const shell = composerShellRef.current;
    if (!shell) return;
    const ro = new ResizeObserver(() => {
      const ta = shell.querySelector("textarea");
      if (ta) setComposerMultiline(ta.scrollHeight > 44);
    });
    ro.observe(shell);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  useEffect(() => {
    if (editing) {
      setShowCompactPostHeader(false);
      return;
    }
    const root = scrollContainerRef.current;
    const titleEl = postTitleRef.current;
    if (!root || !titleEl) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        setShowCompactPostHeader(!entry.isIntersecting);
      },
      { root, threshold: 0 }
    );
    io.observe(titleEl);
    return () => io.disconnect();
  }, [editing, post.id, post.title]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${pathname}?post=${post.id}`;
  }, [pathname, post.id]);

  const needsBodyTruncation = useMemo(
    () => postBodyNeedsTruncation(post.body),
    [post.body]
  );

  const coachPersona = coachPersonaForCommunity(
    pathname,
    impersonatingCoachId
  );
  const isAuthor = Boolean(
    post.author?.id &&
      (post.author.id === currentUserId ||
        Boolean(coachPersona && post.author.id === coachPersona))
  );
  const isEditorAdmin = editorRole === "admin";
  const canManagePost = isAuthor || isEditorAdmin;
  const canPin = isEditorAdmin;
  const editScheduledAtIso = useMemo(() => {
    if (!editScheduledAtLocal) return null;
    const dt = new Date(editScheduledAtLocal);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  }, [editScheduledAtLocal]);
  const editScheduleSummary = useMemo(() => {
    if (!editScheduledAtIso) return null;
    const dt = new Date(editScheduledAtIso);
    return Number.isNaN(dt.getTime())
      ? null
      : dt.toLocaleString([], {
          dateStyle: "medium",
          timeStyle: "short",
        });
  }, [editScheduledAtIso]);
  const announcementsCategory = useMemo(
    () => categories.find((c) => c.slug === "announcements") ?? null,
    [categories]
  );
  const editableCategories = useMemo(
    () =>
      isEditorAdmin
        ? categories
        : categories.filter((c) => c.slug !== "announcements"),
    [categories, isEditorAdmin]
  );

  useEffect(() => {
    if (!editableCategories.some((c) => c.id === editCategoryId)) {
      setEditCategoryId(editableCategories[0]?.id ?? "");
    }
  }, [editCategoryId, editableCategories]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const authorId = await getCommunityAuthorId(coachPersona);
      if (!cancelled) setCurrentAuthorId(authorId);
      if (!authorId) {
        if (!cancelled) setEditorRole(null);
        return;
      }
      const { data } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", authorId)
        .maybeSingle();
      if (!cancelled) setEditorRole((data?.role as string | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [coachPersona]);

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    const { data, error } = await supabaseClient
      .from("community_post_comments")
      .select(
        `
        id,
        post_id,
        author_id,
        body,
        created_at,
        parent_comment_id,
        author:profiles!author_id ( id, full_name, first_name, last_name, avatar_url, role )
      `
      )
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });

    if (error) {
      setComments([]);
      setCommentsLoading(false);
      return;
    }
    const rows = (data ?? []) as Array<
      Omit<CommentRow, "author" | "like_count" | "liked_by_me"> & {
        author: ProfileRow | ProfileRow[] | null;
      }
    >;
    const mapped = rows.map((row) => ({
      id: row.id,
      post_id: row.post_id,
      author_id: row.author_id,
      body: row.body,
      created_at: row.created_at,
      parent_comment_id: row.parent_comment_id,
      author: Array.isArray(row.author)
        ? row.author[0] ?? null
        : row.author ?? null,
    }));

    const commentIds = mapped.map((r) => r.id);
    const likeCountByComment = new Map<string, number>();
    let myLikedCommentIds = new Set<string>();
    if (commentIds.length > 0) {
      const likesRes = await supabaseClient
        .from("community_comment_likes")
        .select("comment_id, user_id")
        .in("comment_id", commentIds);

      if (likesRes.error && !isUndefinedRelationError(likesRes.error)) {
        console.error(likesRes.error);
      } else {
        const likesTableMissing = Boolean(
          likesRes.error && isUndefinedRelationError(likesRes.error)
        );
        if (likesTableMissing && process.env.NODE_ENV === "development") {
          console.warn(
            "[Community] community_comment_likes query failed (table missing?). Run migration 20260515120000_community_comment_likes.sql."
          );
        }
        const likeRows = (likesTableMissing ? [] : likesRes.data ?? []) as {
          comment_id: string;
          user_id: string;
        }[];
        const {
          data: { user },
        } = await supabaseClient.auth.getUser();
        const uid = user?.id;
        for (const r of likeRows) {
          likeCountByComment.set(
            r.comment_id,
            (likeCountByComment.get(r.comment_id) ?? 0) + 1
          );
          if (uid && r.user_id === uid) {
            myLikedCommentIds.add(r.comment_id);
          }
        }
      }
    }

    const currentPost = postRef.current;
    const avatarIds = [
      ...new Set([
        ...mapped.map((r) => r.author_id),
        ...(currentPost.author?.id ? [currentPost.author.id] : []),
      ]),
    ];
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const avatarMap = await fetchStaffAvatarMap(
      avatarIds,
      session?.access_token
    );

    setComments(
      mapped.map((r) => ({
        ...r,
        like_count: likeCountByComment.get(r.id) ?? 0,
        liked_by_me: myLikedCommentIds.has(r.id),
        author: mergeAuthorAvatar(r.author_id, r.author, avatarMap),
      }))
    );
    if (currentPost.author?.id) {
      setPostAuthorDisplay(
        mergeAuthorAvatar(
          currentPost.author.id,
          currentPost.author,
          avatarMap
        )
      );
    }
    setCommentsLoading(false);
  }, [post.id]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  useEffect(() => {
    skipAutoMarkPostReadRef.current = false;
  }, [post.id]);

  useEffect(() => {
    if (!feedStorageScopeId) return;
    if (skipAutoMarkPostReadRef.current) return;
    onMarkPostRead(post.id);
  }, [feedStorageScopeId, post.id, onMarkPostRead]);

  const handleMarkPostUnread = useCallback(() => {
    if (!feedStorageScopeId) return;
    skipAutoMarkPostReadRef.current = true;
    onMarkPostUnread(post.id);
  }, [feedStorageScopeId, post.id, onMarkPostUnread]);

  const handleToggleFavourite = useCallback(async () => {
    if (favouriteBusy) return;
    setFavouriteBusy(true);
    setActionError(null);
    try {
      await toggleCommunityPostFavourite(post.id, post.favourited_by_me);
      await onPostsChanged();
    } catch (e) {
      setActionError(supabaseErrorMessage(e));
    } finally {
      setFavouriteBusy(false);
    }
  }, [
    favouriteBusy,
    post.id,
    post.favourited_by_me,
    onPostsChanged,
  ]);

  const handleTogglePin = useCallback(async () => {
    if (pinBusy || !canPin) return;
    setPinBusy(true);
    setActionError(null);
    try {
      await setCommunityPostPinned(post.id, !post.is_pinned);
      await onPostsChanged();
    } catch (e) {
      setActionError(supabaseErrorMessage(e));
    } finally {
      setPinBusy(false);
    }
  }, [canPin, onPostsChanged, pinBusy, post.id, post.is_pinned]);

  useEffect(() => {
    if (!feedStorageScopeId) return;
    if (commentsLoading) return;
    if (comments.length === 0) {
      onMarkCommentsSeenUpTo(post.id, post.created_at);
      return;
    }
    let latest = comments[0].created_at;
    for (let i = 1; i < comments.length; i++) {
      const t = comments[i].created_at;
      if (new Date(t) > new Date(latest)) latest = t;
    }
    onMarkCommentsSeenUpTo(post.id, latest);
  }, [
    feedStorageScopeId,
    commentsLoading,
    comments,
    post.id,
    post.created_at,
    onMarkCommentsSeenUpTo,
  ]);

  const allBodiesText = useMemo(() => {
    const parts = [post.body, ...comments.map((c) => c.body)];
    return parts.join("\n");
  }, [post.body, comments]);

  useEffect(() => {
    const ids = extractMentionUserIds(allBodiesText);
    const authorIds = new Set<string>();
    if (post.author?.id) authorIds.add(post.author.id);
    for (const c of comments) {
      if (c.author?.id) authorIds.add(c.author.id);
    }
    const need = [...new Set([...ids, ...authorIds])];
    if (need.length === 0) {
      setNameById({});
      setMentionProfileHrefByUserId({});
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [rows, coachRes] = await Promise.all([
          fetchProfilesByIds(need),
          supabaseClient
            .from("coaches")
            .select("id, slug, directory_listed")
            .in("id", need),
        ]);
        if (cancelled) return;
        setNameById(buildNameMap(rows));
        const hrefs: Record<string, string> = {};
        if (!coachRes.error && coachRes.data) {
          for (const c of coachRes.data as {
            id: string;
            slug: string | null;
            directory_listed: boolean | null;
          }[]) {
            if (c.directory_listed && c.slug) {
              hrefs[c.id] = `/directory/${c.slug}`;
            }
          }
        }
        setMentionProfileHrefByUserId(hrefs);
      } catch {
        if (!cancelled) {
          setNameById({});
          setMentionProfileHrefByUserId({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allBodiesText, comments, post.author]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (menuOpen) {
        setMenuOpen(false);
        e.stopPropagation();
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, onClose]);

  const headerAuthor = postAuthorDisplay ?? post.author;
  const authorName = headerAuthor
    ? displayNameFromProfile(headerAuthor)
    : "Unknown";
  const composerDisplayName = composerProfile
    ? displayNameFromProfile(composerProfile)
    : "You";
  const showCommentComposerActions = newComment.trim().length > 0;

  const topLevel = useMemo(
    () => comments.filter((c) => c.parent_comment_id === null),
    [comments]
  );

  const repliesByParent = useMemo(() => {
    const m = new Map<string, CommentRow[]>();
    for (const c of comments) {
      if (c.parent_comment_id) {
        const arr = m.get(c.parent_comment_id) ?? [];
        arr.push(c);
        m.set(c.parent_comment_id, arr);
      }
    }
    return m;
  }, [comments]);

  const commentedByMe = useMemo(() => {
    if (post.commented_by_me) return true;
    if (!currentAuthorId) return false;
    return comments.some((c) => c.author_id === currentAuthorId);
  }, [comments, currentAuthorId, post.commented_by_me]);

  const copyPostLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMenuOpen(false);
    } catch {
      window.prompt("Copy link:", shareUrl);
      setMenuOpen(false);
    }
  }, [shareUrl]);

  const reportPost = useCallback(() => {
    const body = encodeURIComponent(
      `Report about a community post:\nTitle: ${post.title}\nPost ID: ${post.id}\nLink: ${shareUrl}\n\nDetails:\n`
    );
    window.location.href = `mailto:?subject=${encodeURIComponent("[Community] Report")}&body=${body}`;
    setMenuOpen(false);
  }, [post.id, post.title, shareUrl]);

  const handleDeletePost = useCallback(async () => {
    if (
      !confirm(
        "Delete this post? Comments will be removed too. This cannot be undone."
      )
    ) {
      setMenuOpen(false);
      return;
    }
    setActionError(null);
    setDeleteBusy(true);
    const { error } = await supabaseClient
      .from("community_posts")
      .delete()
      .eq("id", post.id);
    setDeleteBusy(false);
    setMenuOpen(false);
    if (error) {
      const msg = supabaseErrorMessage(error);
      const hint = communityAccessHint(msg);
      setActionError(hint ? `${msg}\n\n${hint}` : msg);
      return;
    }
    await onPostsChanged();
    onClose();
  }, [onClose, onPostsChanged, post.id]);

  const saveEdit = useCallback(async () => {
    const title = capitalizeFirstUnicodeLetter(editTitle.trim());
    const body = capitalizeFirstUnicodeLetter(editBody.trim());
    if (!title || !body || saveEditBusy) return;
    if (announcementsCategory && editCategoryId === announcementsCategory.id && !isEditorAdmin) {
      setActionError("Only admins can post in Announcements.");
      return;
    }
    if (isEditorAdmin && editScheduledAtIso) {
      const scheduleMs = new Date(editScheduledAtIso).getTime();
      if (Number.isNaN(scheduleMs)) {
        setActionError("Pick a valid scheduled date and time.");
        return;
      }
      if (scheduleMs <= Date.now()) {
        setActionError("Scheduled time must be in the future.");
        return;
      }
    }
    setActionError(null);
    setSaveEditBusy(true);

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    const finalMedia: CommunityPostMediaItem[] = [];
    for (const slot of editMediaSlots) {
      if (slot.type === "remote") {
        finalMedia.push(slot.item);
        continue;
      }
      const up = await uploadCommunityPostMediaFile(
        slot.file,
        session?.access_token
      );
      if ("error" in up) {
        setActionError(up.error);
        setSaveEditBusy(false);
        return;
      }
      finalMedia.push(up.media);
    }

    const mediaPayload = finalMedia.length > 0 ? finalMedia : null;
    const image_url = firstCommunityPostImageUrl(finalMedia);
    let nextPublishedAt: string | null = null;
    if (isEditorAdmin) {
      const wasFutureScheduled =
        !!post.published_at && new Date(post.published_at).getTime() > Date.now();
      nextPublishedAt = editScheduledAtIso
        ? editScheduledAtIso
        : wasFutureScheduled
          ? new Date().toISOString()
          : (post.published_at ?? new Date().toISOString());
    }

    const { error } = await supabaseClient
      .from("community_posts")
      .update({
        title,
        body,
        category_id: editCategoryId,
        image_url,
        media: mediaPayload,
        ...(isEditorAdmin ? { published_at: nextPublishedAt } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);
    setSaveEditBusy(false);
    if (error) {
      const msg = supabaseErrorMessage(error);
      const hint = communityAccessHint(msg);
      setActionError(hint ? `${msg}\n\n${hint}` : msg);
      return;
    }
    setEditing(false);
    setMenuOpen(false);
    await onPostsChanged();
  }, [
    announcementsCategory,
    editBody,
    editCategoryId,
    editMediaSlots,
    editScheduledAtIso,
    editTitle,
    isEditorAdmin,
    onPostsChanged,
    post.id,
    saveEditBusy,
  ]);

  const submitTopComment = useCallback(async () => {
    const text = newComment.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    const authorId = await getCommunityAuthorId(coachPersona);
    if (!authorId) {
      setSubmitting(false);
      return;
    }
    const { error } = await supabaseClient
      .from("community_post_comments")
      .insert({
        post_id: post.id,
        author_id: authorId,
        body: text,
        parent_comment_id: null,
      });
    setSubmitting(false);
    if (!error) {
      setNewComment("");
      await loadComments();
      await onPostsChanged();
    }
  }, [
    coachPersona,
    newComment,
    onPostsChanged,
    post.id,
    submitting,
    loadComments,
  ]);

  const handleToggleLike = useCallback(async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    try {
      await toggleCommunityPostLike(post.id, post.liked_by_me);
      await onPostsChanged();
    } finally {
      setLikeBusy(false);
    }
  }, [likeBusy, onPostsChanged, post.id, post.liked_by_me]);

  const handleToggleCommentLike = useCallback(
    async (commentId: string, currentlyLiked: boolean) => {
      if (commentLikeBusyId !== null) return;
      setCommentLikeBusyId(commentId);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                liked_by_me: !currentlyLiked,
                like_count: Math.max(
                  0,
                  c.like_count + (currentlyLiked ? -1 : 1)
                ),
              }
            : c
        )
      );
      try {
        await toggleCommunityCommentLike(commentId, currentlyLiked);
      } catch {
        await loadComments();
      } finally {
        setCommentLikeBusyId(null);
      }
    },
    [commentLikeBusyId, loadComments]
  );

  const scrollToComments = useCallback(() => {
    commentsAnchorRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const submitReply = useCallback(
    async (parentId: string) => {
      const text = (replyDrafts[parentId] ?? "").trim();
      if (!text || submitting) return;
      setSubmitting(true);
      const authorId = await getCommunityAuthorId(coachPersona);
      if (!authorId) {
        setSubmitting(false);
        return;
      }
      const { error } = await supabaseClient
        .from("community_post_comments")
        .insert({
          post_id: post.id,
          author_id: authorId,
          body: text,
          parent_comment_id: parentId,
        });
      setSubmitting(false);
      if (!error) {
        setReplyDrafts((d) => ({ ...d, [parentId]: "" }));
        setReplyOpenFor(null);
        await loadComments();
        await onPostsChanged();
      }
    },
    [coachPersona, replyDrafts, submitting, post.id, loadComments, onPostsChanged]
  );

  const canManageComment = useCallback(
    (comment: CommentRow) =>
      Boolean(
        (currentAuthorId && comment.author_id === currentAuthorId) || isEditorAdmin
      ),
    [currentAuthorId, isEditorAdmin]
  );

  const startEditingComment = useCallback((comment: CommentRow) => {
    setActionError(null);
    setCommentMenuOpenId(null);
    setEditingCommentId(comment.id);
    setReplyOpenFor(null);
    setCommentEditDrafts((prev) => ({ ...prev, [comment.id]: comment.body }));
  }, []);

  const cancelEditingComment = useCallback((commentId: string) => {
    setEditingCommentId((prev) => (prev === commentId ? null : prev));
    setCommentEditDrafts((prev) => {
      const next = { ...prev };
      delete next[commentId];
      return next;
    });
  }, []);

  const saveCommentEdit = useCallback(
    async (comment: CommentRow) => {
      const draft = (commentEditDrafts[comment.id] ?? "").trim();
      if (!draft || commentActionBusyId || !canManageComment(comment)) return;
      setActionError(null);
      setCommentActionBusyId(comment.id);
      const { error } = await supabaseClient
        .from("community_post_comments")
        .update({ body: draft })
        .eq("id", comment.id)
        .eq("post_id", post.id);
      setCommentActionBusyId(null);
      if (error) {
        const msg = supabaseErrorMessage(error);
        const hint = communityAccessHint(msg);
        setActionError(hint ? `${msg}\n\n${hint}` : msg);
        return;
      }
      setCommentMenuOpenId(null);
      cancelEditingComment(comment.id);
      await loadComments();
      await onPostsChanged();
    },
    [
      canManageComment,
      cancelEditingComment,
      commentActionBusyId,
      commentEditDrafts,
      loadComments,
      onPostsChanged,
      post.id,
    ]
  );

  const deleteComment = useCallback(
    async (comment: CommentRow) => {
      if (!canManageComment(comment) || commentActionBusyId) return;
      if (!confirm("Delete this comment? This cannot be undone.")) return;
      setActionError(null);
      setCommentActionBusyId(comment.id);
      const { error } = await supabaseClient
        .from("community_post_comments")
        .delete()
        .eq("id", comment.id)
        .eq("post_id", post.id);
      setCommentActionBusyId(null);
      if (error) {
        const msg = supabaseErrorMessage(error);
        const hint = communityAccessHint(msg);
        setActionError(hint ? `${msg}\n\n${hint}` : msg);
        return;
      }
      setCommentMenuOpenId(null);
      cancelEditingComment(comment.id);
      await loadComments();
      await onPostsChanged();
    },
    [
      canManageComment,
      cancelEditingComment,
      commentActionBusyId,
      loadComments,
      onPostsChanged,
      post.id,
    ]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-detail-title"
    >
      <div
        className="relative flex max-h-[90vh] min-h-0 w-full max-w-[calc(42rem*1.15)] flex-col overflow-visible rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-1.5 -top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md hover:bg-slate-50 hover:text-slate-800"
          aria-label="Close"
        >
          <X className="h-3 w-3" strokeWidth={2.5} />
        </button>
        <div
          className={`shrink-0 overflow-hidden border-slate-200 bg-white/95 backdrop-blur transition-[max-height,opacity] duration-200 ease-out ${
            showCompactPostHeader && !editing
              ? "max-h-24 border-b opacity-100"
              : "pointer-events-none max-h-0 border-b-0 opacity-0"
          }`}
        >
          <div className="flex items-center gap-2.5 py-2.5 pl-[2.1875rem] pr-[4.375rem]">
            <CommunityAuthorAvatar profile={headerAuthor} size="sm" />
            <p className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug text-slate-900">
              {post.title}
            </p>
            {showCompactPostHeader && !editing ? (
              <PostDetailOverflowMenu
                menuRef={menuRef}
                menuOpen={menuOpen}
                setMenuOpen={setMenuOpen}
                canManagePost={canManagePost}
                deleteBusy={deleteBusy}
                favouriteBusy={favouriteBusy}
                pinBusy={pinBusy}
                favouritedByMe={post.favourited_by_me}
                isPinned={post.is_pinned}
                canPin={canPin}
                canMarkUnread={Boolean(feedStorageScopeId)}
                onEdit={() => {
                  setActionError(null);
                  setEditing(true);
                }}
                onCopyLink={copyPostLink}
                onToggleFavourite={handleToggleFavourite}
                onTogglePin={handleTogglePin}
                onMarkUnread={handleMarkPostUnread}
                onReport={reportPost}
                onDelete={handleDeletePost}
              />
            ) : null}
          </div>
        </div>
        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-5 px-[2.1875rem]"
        >
          <div className="flex items-start gap-3">
            <CommunityAuthorAvatar profile={headerAuthor} size="md" />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-semibold leading-tight text-slate-900">
                      {authorName}
                    </div>
                    {post.is_pinned ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700">
                        <Pin className="h-3.5 w-3.5 fill-sky-500 text-sky-500" strokeWidth={1.75} />
                        Pinned
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs leading-snug">
                    <span className="text-slate-500">
                      {formatCommunityPostTimestamp(post.created_at)}
                    </span>
                    {post.category ? (
                      <>
                        <span className="mx-0.5 select-none text-slate-400">
                          ·
                        </span>
                        <span className="font-semibold text-slate-500">
                          {post.category.label}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
                {(!showCompactPostHeader || editing) ? (
                  <PostDetailOverflowMenu
                    menuRef={menuRef}
                    menuOpen={menuOpen}
                    setMenuOpen={setMenuOpen}
                    canManagePost={canManagePost}
                    deleteBusy={deleteBusy}
                    favouriteBusy={favouriteBusy}
                    pinBusy={pinBusy}
                    favouritedByMe={post.favourited_by_me}
                    isPinned={post.is_pinned}
                    canPin={canPin}
                    canMarkUnread={Boolean(feedStorageScopeId)}
                    onEdit={() => {
                      setActionError(null);
                      setEditing(true);
                    }}
                    onCopyLink={copyPostLink}
                    onToggleFavourite={handleToggleFavourite}
                    onTogglePin={handleTogglePin}
                    onMarkUnread={handleMarkPostUnread}
                    onReport={reportPost}
                    onDelete={handleDeletePost}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-3 w-full min-w-0 space-y-3">
            <div className="min-w-0">
              {editing ? (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full border-0 border-b border-slate-200 bg-transparent px-0 pb-2 text-[calc(1.25rem+2px)] font-semibold text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-0"
                    aria-label="Post title"
                  />
                  <MentionTextarea
                    value={editBody}
                    onChange={setEditBody}
                    placeholder="Body…"
                    rows={8}
                    className="w-full resize-y border-0 border-b border-slate-200 bg-transparent px-0 pb-3 text-[calc(1rem+2px)] text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-0"
                  />
                  <p className="text-xs leading-snug text-slate-500">
                    Basic{" "}
                    <span className="font-medium text-slate-600">Markdown</span>{" "}
                    is supported: **bold**, *italic*, # headings, - bullets,
                    numbered lists, blockquotes, and links (https://…).
                  </p>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Photos and videos (optional, up to {COMMUNITY_POST_MEDIA_MAX})
                    </label>
                    <div className="space-y-2">
                      {editMediaSlots.length > 0 ? (
                        <ul className="flex flex-wrap gap-2">
                          {editMediaSlots.map((slot) => (
                            <li key={slot.key} className="relative inline-block">
                              {slot.type === "remote" ? (
                                slot.item.kind === "video" ? (
                                  <video
                                    src={slot.item.url}
                                    muted
                                    playsInline
                                    preload="metadata"
                                    className="h-24 w-24 rounded-lg object-cover ring-1 ring-slate-200"
                                  />
                                ) : (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={slot.item.url}
                                    alt=""
                                    referrerPolicy="no-referrer"
                                    className="h-24 w-24 rounded-lg object-cover ring-1 ring-slate-200"
                                  />
                                )
                              ) : slot.file.type.startsWith("video/") ? (
                                <video
                                  src={slot.previewUrl}
                                  muted
                                  playsInline
                                  className="h-24 w-24 rounded-lg object-cover ring-1 ring-slate-200"
                                />
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={slot.previewUrl}
                                  alt=""
                                  className="h-24 w-24 rounded-lg object-cover ring-1 ring-slate-200"
                                />
                              )}
                              <button
                                type="button"
                                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-white shadow hover:bg-slate-900"
                                aria-label="Remove attachment"
                                onClick={() => {
                                  setEditMediaSlots((prev) => {
                                    const x = prev.find((s) => s.key === slot.key);
                                    if (x?.type === "local") {
                                      URL.revokeObjectURL(x.previewUrl);
                                    }
                                    return prev.filter((s) => s.key !== slot.key);
                                  });
                                }}
                              >
                                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-500">No attachments</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-dashed border-slate-300 bg-slate-50/80 px-3 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50">
                          <ImagePlus className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                          <span>Add files</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                            multiple
                            className="sr-only"
                            disabled={editMediaSlots.length >= COMMUNITY_POST_MEDIA_MAX}
                            onChange={(e) => {
                              const files = Array.from(e.target.files ?? []);
                              e.target.value = "";
                              if (files.length === 0) return;
                              setEditMediaSlots((prev) => {
                                const room = COMMUNITY_POST_MEDIA_MAX - prev.length;
                                if (room <= 0) return prev;
                                const add = files.slice(0, room).map((file) => ({
                                  key: crypto.randomUUID(),
                                  type: "local" as const,
                                  file,
                                  previewUrl: URL.createObjectURL(file),
                                }));
                                return [...prev, ...add];
                              });
                            }}
                          />
                        </label>
                        <span className="text-xs text-slate-500">
                          Images max 5MB · videos max 50MB
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {categories.length > 0 ? (
                        <select
                          value={editCategoryId}
                          onChange={(e) => setEditCategoryId(e.target.value)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
                        >
                          {editableCategories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setEditing(false);
                        setEditTitle(post.title);
                        setEditBody(post.body);
                        setEditCategoryId(post.category_id);
                        if (
                          post.published_at &&
                          new Date(post.published_at).getTime() > Date.now()
                        ) {
                          setEditScheduledAtLocal(
                            toLocalDateTimeInputValue(new Date(post.published_at))
                          );
                        } else {
                          setEditScheduledAtLocal("");
                        }
                        setEditSchedulePopoverOpen(false);
                      }}
                      className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:text-slate-600"
                    >
                      Cancel
                    </button>
                      <button
                        type="button"
                        disabled={
                          saveEditBusy ||
                          !editTitle.trim() ||
                          !editBody.trim()
                        }
                        onClick={() => void saveEdit()}
                        className="rounded-lg bg-sky-700 px-5 py-2.5 text-base font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saveEditBusy ? "Saving…" : "Save"}
                      </button>
                      {isEditorAdmin ? (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setEditSchedulePopoverOpen((open) => !open)
                            }
                            className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition ${
                              editScheduledAtIso
                                ? "border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100"
                                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                            title={
                              editScheduledAtIso
                                ? "Edit scheduled time"
                                : "Schedule post"
                            }
                            aria-label={
                              editScheduledAtIso
                                ? "Edit scheduled time"
                                : "Schedule post"
                            }
                          >
                            <CalendarDays className="h-4 w-4" strokeWidth={1.9} />
                          </button>
                          {editSchedulePopoverOpen ? (
                            <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Schedule post
                              </p>
                              <input
                                type="datetime-local"
                                value={editScheduledAtLocal}
                                onChange={(e) =>
                                  setEditScheduledAtLocal(e.target.value)
                                }
                                min={toLocalDateTimeInputValue(
                                  new Date(Date.now() + 60_000)
                                )}
                                className="mt-2 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                              />
                              <div className="mt-3 flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  className="text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
                                  onClick={() => {
                                    setEditScheduledAtLocal("");
                                    setEditSchedulePopoverOpen(false);
                                  }}
                                >
                                  Clear
                                </button>
                                <button
                                  type="button"
                                  className="rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                                  onClick={() => setEditSchedulePopoverOpen(false)}
                                >
                                  Done
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {!isEditorAdmin && announcementsCategory ? (
                      <p className="text-[11px] text-slate-500">
                        Announcements are admin-only.
                      </p>
                    ) : null}
                    {isEditorAdmin && editScheduleSummary ? (
                      <p className="text-right text-[11px] text-sky-700">
                        Scheduled for {editScheduleSummary}
                      </p>
                    ) : null}
                  </div>
                  {actionError ? (
                    <p className="whitespace-pre-wrap text-sm text-rose-600">
                      {actionError}
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
                  <h2
                    ref={postTitleRef}
                    id="post-detail-title"
                    className="mt-2.5 text-[calc(1.5rem+2px)] font-semibold leading-snug tracking-tight text-slate-900"
                  >
                    {post.title}
                  </h2>
                  <div className="mt-3 text-[calc(1rem+2px)] leading-relaxed text-slate-800">
                    {bodyExpanded || !needsBodyTruncation ? (
                      <>
                        <CommunityPostMarkdownBody
                          body={post.body}
                          nameById={nameById}
                          profileHrefByUserId={mentionProfileHrefByUserId}
                        />
                        {needsBodyTruncation ? (
                          <button
                            type="button"
                            className="mt-1 inline bg-transparent p-0 font-medium leading-relaxed text-sky-500 hover:text-sky-400 hover:underline"
                            onClick={() => setBodyExpanded(false)}
                          >
                            See less
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <div className="text-[calc(1rem+2px)] leading-relaxed">
                        <div className="line-clamp-9 overflow-hidden break-words">
                          <CommunityPostMarkdownBody
                            body={post.body}
                            nameById={nameById}
                            profileHrefByUserId={mentionProfileHrefByUserId}
                            className="block text-inherit"
                          />
                        </div>
                        <span className="mt-0.5 inline-flex flex-wrap items-baseline gap-1.5">
                          <span className="text-slate-400" aria-hidden>
                            …
                          </span>
                          <button
                            type="button"
                            className="bg-transparent p-0 font-medium leading-relaxed text-sky-500 hover:text-sky-400 hover:underline"
                            onClick={() => setBodyExpanded(true)}
                          >
                            See more
                          </button>
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            {!editing && post.media.length > 0 ? (
              <div className="space-y-3">
                {post.media.map((m, i) => (
                  <CommunityPostDetailMedia
                    key={`${m.url}-${i}`}
                    url={m.url}
                    kind={m.kind}
                  />
                ))}
              </div>
            ) : null}
            {!editing ? (
              <div>
                <PostEngagementBar
                  detail
                  likeCount={post.like_count}
                  commentCount={post.comment_count}
                  commentedByMe={commentedByMe}
                  commentPreviewAuthors={post.comment_preview_authors}
                  likedByMe={post.liked_by_me}
                  disabled={likeBusy}
                  onToggleLike={handleToggleLike}
                  onCommentsClick={scrollToComments}
                />
              </div>
            ) : null}
          </div>

          {actionError && !editing ? (
            <p
              className="mt-3 whitespace-pre-wrap text-sm text-rose-700"
              role="alert"
            >
              {actionError}
            </p>
          ) : null}

          <div
            ref={commentsAnchorRef}
            id="community-post-comments"
            className="mt-3 border-t border-slate-200 pt-3"
          >
            {commentsLoading ? (
              <p className="mt-1 text-sm text-slate-500">Loading comments…</p>
            ) : topLevel.length > 0 ? (
              <ul className="mt-2 space-y-5">
                {topLevel.map((c) => {
                  const ca = c.author
                    ? displayNameFromProfile(c.author)
                    : "Unknown";
                  const caInitials = profileInitialsFromName(ca);
                  const replies = repliesByParent.get(c.id) ?? [];
                  const topLevelCanManage = canManageComment(c);
                  const topLevelIsEditing = editingCommentId === c.id;
                  return (
                    <li
                      key={c.id}
                      className="group/comment relative rounded-xl bg-slate-50/80 p-3"
                      onMouseLeave={() => setCommentMenuOpenId(null)}
                    >
                      <div className="flex gap-2">
                        <CommunityProfileHoverCard
                          userId={c.author_id}
                          profile={{
                            id: c.author_id,
                            full_name: c.author?.full_name ?? ca,
                            first_name: c.author?.first_name ?? null,
                            last_name: c.author?.last_name ?? null,
                            avatar_url: c.author?.avatar_url ?? null,
                            role: c.author?.role ?? null,
                          }}
                        >
                          {c.author?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.author.avatar_url}
                              alt=""
                              className="h-8 w-8 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
                              {caInitials}
                            </span>
                          )}
                        </CommunityProfileHoverCard>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[15px] font-semibold text-slate-900">
                                {ca}
                              </span>
                              <span className="text-[13px] text-slate-500">
                                {formatCommunityPostTimestamp(c.created_at)}
                              </span>
                            </div>
                            {topLevelCanManage ? (
                              <div className="relative shrink-0">
                                <button
                                  type="button"
                                  aria-label="Comment actions"
                                  aria-expanded={commentMenuOpenId === c.id}
                                  onClick={() =>
                                    setCommentMenuOpenId((prev) =>
                                      prev === c.id ? null : c.id
                                    )
                                  }
                                  className="rounded-md p-1 text-slate-500 opacity-0 transition hover:bg-slate-200 hover:text-slate-800 focus:opacity-100 group-hover/comment:opacity-100"
                                >
                                  <MoreHorizontal
                                    className="h-4 w-4"
                                    strokeWidth={1.75}
                                  />
                                </button>
                                {commentMenuOpenId === c.id && !topLevelIsEditing ? (
                                  <div className="absolute right-0 z-20 mt-1 min-w-[8rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                                    <button
                                      type="button"
                                      className="flex w-full items-center px-3 py-1.5 text-left text-xs text-slate-800 hover:bg-slate-50"
                                      onClick={() => startEditingComment(c)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      disabled={commentActionBusyId === c.id}
                                      className="flex w-full items-center px-3 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                      onClick={() => void deleteComment(c)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                          {topLevelIsEditing ? (
                            <div className="mt-2 space-y-2">
                              <MentionTextarea
                                value={commentEditDrafts[c.id] ?? ""}
                                onChange={(v) =>
                                  setCommentEditDrafts((d) => ({
                                    ...d,
                                    [c.id]: v,
                                  }))
                                }
                                rows={3}
                                className="w-full resize-y rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => void saveCommentEdit(c)}
                                  disabled={
                                    commentActionBusyId === c.id ||
                                    !(commentEditDrafts[c.id] ?? "").trim()
                                  }
                                  className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => cancelEditingComment(c.id)}
                                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <MentionBody
                              body={c.body}
                              nameById={nameById}
                              profileHrefByUserId={mentionProfileHrefByUserId}
                              className="mt-1 text-[15px] text-slate-800"
                            />
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <CommentLikeButton
                              likeCount={c.like_count}
                              likedByMe={c.liked_by_me}
                              disabled={commentLikeBusyId !== null}
                              onToggle={() =>
                                void handleToggleCommentLike(
                                  c.id,
                                  c.liked_by_me
                                )
                              }
                            />
                            <button
                              type="button"
                              className="text-[13px] font-medium text-sky-700 hover:underline"
                              onClick={() =>
                                setReplyOpenFor((x) =>
                                  x === c.id ? null : c.id
                                )
                              }
                            >
                              Reply
                            </button>
                          </div>

                          {replyOpenFor === c.id ? (
                            <div className="mt-2 space-y-2">
                              <MentionTextarea
                                value={replyDrafts[c.id] ?? ""}
                                onChange={(v) =>
                                  setReplyDrafts((d) => ({
                                    ...d,
                                    [c.id]: v,
                                  }))
                                }
                                placeholder="Write a reply…"
                                rows={3}
                                className="w-full resize-y rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => void submitReply(c.id)}
                                  disabled={
                                    submitting ||
                                    !(replyDrafts[c.id] ?? "").trim()
                                  }
                                  className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
                                >
                                  Reply
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setReplyOpenFor(null)}
                                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {replies.length > 0 ? (
                            <ul className="mt-3 space-y-3 border-l-2 border-slate-200 pl-3">
                              {replies.map((r) => {
                                const ra = r.author
                                  ? displayNameFromProfile(r.author)
                                  : "Unknown";
                                const raInitials = profileInitialsFromName(ra);
                                const replyCanManage = canManageComment(r);
                                const replyIsEditing = editingCommentId === r.id;
                                return (
                                  <li
                                    key={r.id}
                                    className="group/reply relative rounded-lg bg-white px-3 py-2"
                                    onMouseLeave={() =>
                                      setCommentMenuOpenId(null)
                                    }
                                  >
                                    <div className="flex gap-2">
                                      <CommunityProfileHoverCard
                                        userId={r.author_id}
                                        profile={{
                                          id: r.author_id,
                                          full_name: r.author?.full_name ?? ra,
                                          first_name: r.author?.first_name ?? null,
                                          last_name: r.author?.last_name ?? null,
                                          avatar_url: r.author?.avatar_url ?? null,
                                          role: r.author?.role ?? null,
                                        }}
                                      >
                                        {r.author?.avatar_url ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={r.author.avatar_url}
                                            alt=""
                                            className="h-7 w-7 shrink-0 rounded-full object-cover"
                                          />
                                        ) : (
                                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-medium text-slate-600">
                                            {raInitials}
                                          </span>
                                        )}
                                      </CommunityProfileHoverCard>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-[13px] font-semibold text-slate-900">
                                              {ra}
                                            </span>
                                            <span className="text-[11px] text-slate-500">
                                              {formatCommunityPostTimestamp(
                                                r.created_at
                                              )}
                                            </span>
                                          </div>
                                          {replyCanManage ? (
                                            <div className="relative shrink-0">
                                              <button
                                                type="button"
                                                aria-label="Comment actions"
                                                aria-expanded={
                                                  commentMenuOpenId === r.id
                                                }
                                                onClick={() =>
                                                  setCommentMenuOpenId((prev) =>
                                                    prev === r.id ? null : r.id
                                                  )
                                                }
                                                className="rounded-md p-1 text-slate-500 opacity-0 transition hover:bg-slate-100 hover:text-slate-800 focus:opacity-100 group-hover/reply:opacity-100"
                                              >
                                                <MoreHorizontal
                                                  className="h-4 w-4"
                                                  strokeWidth={1.75}
                                                />
                                              </button>
                                              {commentMenuOpenId === r.id &&
                                              !replyIsEditing ? (
                                                <div className="absolute right-0 z-20 mt-1 min-w-[8rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                                                  <button
                                                    type="button"
                                                    className="flex w-full items-center px-3 py-1.5 text-left text-xs text-slate-800 hover:bg-slate-50"
                                                    onClick={() =>
                                                      startEditingComment(r)
                                                    }
                                                  >
                                                    Edit
                                                  </button>
                                                  <button
                                                    type="button"
                                                    disabled={
                                                      commentActionBusyId ===
                                                      r.id
                                                    }
                                                    className="flex w-full items-center px-3 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                                    onClick={() =>
                                                      void deleteComment(r)
                                                    }
                                                  >
                                                    Delete
                                                  </button>
                                                </div>
                                              ) : null}
                                            </div>
                                          ) : null}
                                        </div>
                                        {replyIsEditing ? (
                                          <div className="mt-1.5 space-y-2">
                                            <MentionTextarea
                                              value={commentEditDrafts[r.id] ?? ""}
                                              onChange={(v) =>
                                                setCommentEditDrafts((d) => ({
                                                  ...d,
                                                  [r.id]: v,
                                                }))
                                              }
                                              rows={3}
                                              className="w-full resize-y rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                                            />
                                            <div className="flex gap-2">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  void saveCommentEdit(r)
                                                }
                                                disabled={
                                                  commentActionBusyId === r.id ||
                                                  !(
                                                    commentEditDrafts[r.id] ?? ""
                                                  ).trim()
                                                }
                                                className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
                                              >
                                                Save
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  cancelEditingComment(r.id)
                                                }
                                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <MentionBody
                                            body={r.body}
                                            nameById={nameById}
                                            profileHrefByUserId={
                                              mentionProfileHrefByUserId
                                            }
                                            className="mt-0.5 text-[15px] text-slate-800"
                                          />
                                        )}
                                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                          <CommentLikeButton
                                            likeCount={r.like_count}
                                            likedByMe={r.liked_by_me}
                                            disabled={
                                              commentLikeBusyId !== null
                                            }
                                            onToggle={() =>
                                              void handleToggleCommentLike(
                                                r.id,
                                                r.liked_by_me
                                              )
                                            }
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="flex items-start gap-3">
                {composerProfile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={composerProfile.avatar_url}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-slate-100"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-600">
                    {profileInitialsFromName(composerDisplayName)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div
                    ref={composerShellRef}
                    className={`relative border border-slate-300 bg-slate-50 transition-[border-radius] ${
                      composerMultiline ? "rounded-2xl" : "rounded-[9999px]"
                    }`}
                  >
                    <MentionTextarea
                      value={newComment}
                      onChange={setNewComment}
                      placeholder="Your comment"
                      autoResize
                      maxAutoHeightPx={220}
                      className="w-full border-0 bg-transparent px-3.5 py-1.5 text-sm leading-normal text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-0"
                    />
                  </div>
                  {showCommentComposerActions ? (
                    <div className="mt-2 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setNewComment("")}
                        className="text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={submitting || !newComment.trim()}
                        onClick={() => void submitTopComment()}
                        className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-sky-700 disabled:opacity-50"
                      >
                        {submitting ? "Sending…" : "Comment"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
