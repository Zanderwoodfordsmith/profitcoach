"use client";

import type { RefObject } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
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
import { coachCommunityPathFromAdminPath } from "@/lib/auth/loginReturnPath";
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
import { CommunityPostMediaGallery } from "@/components/community/CommunityPostMediaGallery";
import {
  MentionTextarea,
  prefetchMentionUsers,
} from "@/components/community/MentionTextarea";
import { CommunityAuthorAvatar } from "@/components/community/CommunityAuthorAvatar";
import { PostEngagementBar } from "@/components/community/PostEngagementBar";
import { toggleCommunityCommentLike } from "@/lib/communityCommentLike";
import { toggleCommunityPostFavourite } from "@/lib/communityPostFavourite";
import { toggleCommunityPostLike } from "@/lib/communityPostLike";
import { setCommunityPostPinned } from "@/lib/communityPostPin";
import {
  appendCommunityPostCommentsCache,
  fetchCommunityPostComments,
  getCachedCommunityPostComments,
  invalidateCommunityPostCommentsCache,
  prefetchCommunityPostComments,
} from "@/lib/fetchCommunityPostComments";
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
import { markCommunityWinPostHandled } from "@/lib/communityNotificationReadState";
import { communityPostPath } from "@/lib/communityPostSlug";
import { CommunityProfileHoverCard } from "@/components/community/CommunityProfileHoverCard";
import {
  CommentAttachButton,
  CommentImageComposer,
  CommentImagePreviews,
  clearPendingCommentImages,
  type PendingCommentImage,
} from "@/components/community/CommentImageComposer";
import { CommentMediaDisplay } from "@/components/community/CommentMediaDisplay";
import {
  parseStoredCommunityCommentMedia,
  uploadCommunityCommentImageFile,
  type CommunityCommentMediaItem,
} from "@/lib/communityCommentMedia";

type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  parent_comment_id: string | null;
  media: CommunityCommentMediaItem[];
  author: ProfileRow | null;
  like_count: number;
  liked_by_me: boolean;
};

/** Stored mention token for composers: [@Name](mention:uuid) */
function mentionTokenForAuthor(authorId: string, displayName: string): string {
  const name = displayName.replace(/[[\]]/g, "").trim() || "member";
  return `[@${name}](mention:${authorId}) `;
}

const COMMENT_INSERT_SELECT = `
  id,
  post_id,
  author_id,
  body,
  created_at,
  parent_comment_id,
  media,
  author:profiles!author_id ( id, full_name, first_name, last_name, avatar_url, role )
`;

function mapCommentInsertRow(
  row: Omit<CommentRow, "like_count" | "liked_by_me" | "author" | "media"> & {
    author: ProfileRow | ProfileRow[] | null;
    media?: unknown;
  }
): CommentRow {
  const author = Array.isArray(row.author)
    ? row.author[0] ?? null
    : row.author ?? null;
  return {
    id: row.id,
    post_id: row.post_id,
    author_id: row.author_id,
    body: row.body,
    created_at: row.created_at,
    parent_comment_id: row.parent_comment_id,
    media: parseStoredCommunityCommentMedia(row.media),
    author,
    like_count: 0,
    liked_by_me: false,
  };
}

async function uploadPendingCommentImages(
  pending: PendingCommentImage[]
): Promise<CommunityCommentMediaItem[] | { error: string }> {
  const uploaded: CommunityCommentMediaItem[] = [];
  for (const p of pending) {
    const up = await uploadCommunityCommentImageFile(p.file);
    if ("error" in up) return up;
    uploaded.push(up.media);
  }
  return uploaded;
}

async function insertCommunityCommentRow(args: {
  postId: string;
  authorId: string;
  body: string;
  parentCommentId: string | null;
  pendingImages: PendingCommentImage[];
}): Promise<{ comment: CommentRow } | { error: string }> {
  let mediaPayload: CommunityCommentMediaItem[] | null = null;
  if (args.pendingImages.length > 0) {
    const uploaded = await uploadPendingCommentImages(args.pendingImages);
    if ("error" in uploaded) return uploaded;
    mediaPayload = uploaded;
  }

  const row: {
    post_id: string;
    author_id: string;
    body: string;
    parent_comment_id: string | null;
    media?: CommunityCommentMediaItem[];
  } = {
    post_id: args.postId,
    author_id: args.authorId,
    body: args.body,
    parent_comment_id: args.parentCommentId,
  };
  if (mediaPayload && mediaPayload.length > 0) {
    row.media = mediaPayload;
  }

  const { data, error } = await supabaseClient
    .from("community_post_comments")
    .insert(row)
    .select(COMMENT_INSERT_SELECT)
    .single();

  if (error) {
    const msg = supabaseErrorMessage(error);
    const hint = communityAccessHint(msg);
    return { error: hint ? `${msg}\n\n${hint}` : msg };
  }
  if (!data) {
    return { error: "Comment could not be saved." };
  }

  return {
    comment: mapCommentInsertRow(
      data as Parameters<typeof mapCommentInsertRow>[0]
    ),
  };
}

function appendComment(prev: CommentRow[], next: CommentRow): CommentRow[] {
  if (prev.some((c) => c.id === next.id)) return prev;
  return [...prev, next].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

/** Top-level comment id for a reply (never nests deeper than one reply level). */
function threadRootCommentId(
  comment: CommentRow,
  commentById: Map<string, CommentRow>
): string {
  const parentId = comment.parent_comment_id;
  if (!parentId) return comment.id;
  const parent = commentById.get(parentId);
  if (!parent || parent.parent_comment_id === null) return parentId;
  return parent.parent_comment_id;
}

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
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm tabular-nums transition hover:bg-slate-200/70 disabled:opacity-50 ${
        likedByMe
          ? "font-medium text-sky-700"
          : "text-slate-500 hover:text-slate-800"
      }`}
      aria-pressed={likedByMe}
      aria-label={likedByMe ? "Unlike comment" : "Like comment"}
    >
      <ThumbsUp
        className={`h-4 w-4 shrink-0 ${likedByMe ? "fill-sky-600 text-sky-600" : ""}`}
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
  /**
   * Optimistically patch the post in the parent feed's local state instead of
   * reloading the whole feed. When provided, likes and comments update the feed
   * in place and reconcile on the next feed load. When omitted, those actions
   * fall back to `onPostsChanged`.
   */
  onPostLocalUpdate?: (
    postId: string,
    patch: (post: CommunityPostRow) => Partial<CommunityPostRow>
  ) => void;
  /** Effective profile id for community feed localStorage (auth user or impersonated coach). */
  feedStorageScopeId: string | null;
  /** When false, ignore stale sessionStorage impersonation (real coaches). */
  viewerIsAdmin?: boolean | null;
  onMarkPostRead: (postId: string) => void;
  onMarkPostUnread: (postId: string) => void;
  /** Embedded inside a parent shell (e.g. admin wins queue) — no full-screen backdrop. */
  presentation?: "overlay" | "embedded";
  /**
   * Parent-owned close buttons (e.g. wins queue shell) should call this handler
   * so unsaved comment drafts trigger the same confirmation as the modal X button.
   */
  onRegisterCloseHandler?: (handler: (() => void) | null) => void;
};

function UnsavedCommentDiscardDialog({
  open,
  onStay,
  onLeave,
}: {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-comment-discard-title"
      onClick={onStay}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Profit Coach
        </p>
        <h2
          id="unsaved-comment-discard-title"
          className="mt-2 text-base font-semibold text-slate-900"
        >
          Leave without finishing?
        </h2>
        <p className="mt-2 text-[15px] leading-snug text-slate-600">
          You haven&apos;t finished your comment yet. Do you want to leave without
          finishing?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onStay}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Stay
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
          >
            Leave
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

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
  onPostLocalUpdate,
  feedStorageScopeId,
  viewerIsAdmin = null,
  onMarkPostRead,
  onMarkPostUnread,
  presentation = "overlay",
  onRegisterCloseHandler,
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
  const [commentComposerFocused, setCommentComposerFocused] = useState(false);
  const [discardCommentDialogOpen, setDiscardCommentDialogOpen] = useState(false);
  const [topCommentPendingImages, setTopCommentPendingImages] = useState<
    PendingCommentImage[]
  >([]);
  const [replyPendingImages, setReplyPendingImages] = useState<
    Record<string, PendingCommentImage[]>
  >({});
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
  const [composerProfile, setComposerProfile] = useState<ProfileRow | null>(
    null
  );
  const [postAuthorDisplay, setPostAuthorDisplay] = useState<ProfileRow | null>(
    null
  );

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentAuthorId, setCurrentAuthorId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  /** After "Mark as unread", skip auto read until switching posts (mark unread bumps parent state). */
  const skipAutoMarkPostReadRef = useRef(false);
  /** Ignore in-flight comment loads superseded by a newer request or post switch. */
  const commentsLoadGenRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

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
    prefetchMentionUsers(post.author?.id);
    prefetchCommunityPostComments(post.id);
  }, [post.author?.id, post.id]);

  useEffect(() => {
    setDiscardCommentDialogOpen(false);
    setCommentComposerFocused(false);
    setTopCommentPendingImages((prev) => {
      clearPendingCommentImages(prev);
      return [];
    });
    setReplyPendingImages((prev) => {
      for (const pending of Object.values(prev)) {
        clearPendingCommentImages(pending);
      }
      return {};
    });
  }, [post.id]);

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
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const sharePath =
      coachCommunityPathFromAdminPath(pathname) ??
      (pathname.startsWith("/coach/community")
        ? "/coach/community"
        : "/coach/community");
    return `${window.location.origin}${communityPostPath(sharePath, post)}`;
  }, [pathname, post]);

  const needsBodyTruncation = useMemo(
    () => postBodyNeedsTruncation(post.body),
    [post.body]
  );

  const coachPersona = coachPersonaForCommunity(
    pathname,
    impersonatingCoachId,
    viewerIsAdmin
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
  const editableCategories = useMemo(() => {
    const base = isEditorAdmin
      ? categories
      : categories.filter((c) => c.slug !== "announcements");
    if (post.category_id && !base.some((c) => c.id === post.category_id)) {
      return categories.filter(
        (c) => base.some((b) => b.id === c.id) || c.id === post.category_id
      );
    }
    return base;
  }, [categories, isEditorAdmin, post.category_id]);

  useEffect(() => {
    if (editorRole === null) return;
    if (!editCategoryId) return;
    if (editableCategories.some((c) => c.id === editCategoryId)) return;
    const fallback = editableCategories.some((c) => c.id === post.category_id)
      ? post.category_id
      : "";
    setEditCategoryId(fallback);
  }, [editCategoryId, editableCategories, editorRole, post.category_id]);

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

  const loadComments = useCallback(async (options?: { skipCache?: boolean }) => {
    const gen = ++commentsLoadGenRef.current;
    const cached =
      !options?.skipCache ? getCachedCommunityPostComments(post.id) : null;
    if (cached) {
      setComments(cached.comments);
      if (cached.post_author) setPostAuthorDisplay(cached.post_author);
      setCommentsLoading(false);
    } else {
      setCommentsLoading(true);
    }

    try {
      // Prefetch cache is for instant first paint only — always revalidate from API.
      const { comments, post_author } = await fetchCommunityPostComments(
        post.id,
        { skipCache: true }
      );
      if (gen !== commentsLoadGenRef.current) return;
      setComments(comments);
      if (post_author) {
        setPostAuthorDisplay(post_author);
      }
    } catch {
      if (gen !== commentsLoadGenRef.current) return;
      if (!cached) setComments([]);
    } finally {
      if (gen === commentsLoadGenRef.current) {
        setCommentsLoading(false);
      }
    }
  }, [post.id]);

  const reloadComments = useCallback(async () => {
    invalidateCommunityPostCommentsCache(post.id);
    await loadComments({ skipCache: true });
  }, [loadComments, post.id]);

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
    if (presentation !== "overlay") return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [presentation]);

  useEffect(() => {
    if (presentation !== "overlay") return;
    const overlay = overlayRef.current;
    if (!overlay) return;

    const trapWheel = (e: WheelEvent) => {
      const scrollEl = scrollContainerRef.current;
      if (!scrollEl || !scrollEl.contains(e.target as Node)) {
        e.preventDefault();
        return;
      }
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      if (scrollHeight <= clientHeight + 1) {
        e.preventDefault();
        return;
      }
      const dy = e.deltaY;
      if (dy < 0 && scrollTop <= 0) e.preventDefault();
      else if (dy > 0 && scrollTop + clientHeight >= scrollHeight - 1) {
        e.preventDefault();
      }
    };

    overlay.addEventListener("wheel", trapWheel, { passive: false });
    return () => overlay.removeEventListener("wheel", trapWheel);
  }, [presentation, commentsLoading, comments.length, post.id, editing]);

  const headerAuthor = postAuthorDisplay ?? post.author;
  const mentionPrioritizeUserId = post.author?.id;
  const authorName = headerAuthor
    ? displayNameFromProfile(headerAuthor)
    : "Unknown";
  const composerDisplayName = composerProfile
    ? displayNameFromProfile(composerProfile)
    : "You";
  const showCommentComposerActions =
    newComment.trim().length > 0 || topCommentPendingImages.length > 0;
  const commentComposerExpanded =
    commentComposerFocused || showCommentComposerActions;

  const hasUnsavedCommentDraft = useMemo(() => {
    if (newComment.trim()) return true;
    if (topCommentPendingImages.length > 0) return true;
    if (Object.values(replyDrafts).some((draft) => draft.trim())) return true;
    if (Object.values(replyPendingImages).some((images) => images.length > 0)) {
      return true;
    }
    if (editingCommentId) {
      const original = comments.find((c) => c.id === editingCommentId);
      const draft = (commentEditDrafts[editingCommentId] ?? "").trim();
      if (!original) return draft.length > 0;
      return draft !== original.body.trim();
    }
    return false;
  }, [
    commentEditDrafts,
    comments,
    editingCommentId,
    newComment,
    replyDrafts,
    replyPendingImages,
    topCommentPendingImages,
  ]);

  const clearCommentDrafts = useCallback(() => {
    setNewComment("");
    setTopCommentPendingImages((prev) => {
      clearPendingCommentImages(prev);
      return [];
    });
    setReplyDrafts({});
    setReplyPendingImages((prev) => {
      for (const pending of Object.values(prev)) {
        clearPendingCommentImages(pending);
      }
      return {};
    });
    setReplyOpenFor(null);
    setEditingCommentId(null);
    setCommentEditDrafts({});
    setCommentComposerFocused(false);
  }, []);

  const requestClose = useCallback(() => {
    if (submitting) return;
    if (hasUnsavedCommentDraft) {
      setDiscardCommentDialogOpen(true);
      return;
    }
    onClose();
  }, [hasUnsavedCommentDraft, onClose, submitting]);

  const confirmDiscardCommentAndClose = useCallback(() => {
    setDiscardCommentDialogOpen(false);
    clearCommentDrafts();
    onClose();
  }, [clearCommentDrafts, onClose]);

  useEffect(() => {
    onRegisterCloseHandler?.(requestClose);
    return () => onRegisterCloseHandler?.(null);
  }, [onRegisterCloseHandler, requestClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (discardCommentDialogOpen) {
        setDiscardCommentDialogOpen(false);
        e.stopPropagation();
        return;
      }
      if (menuOpen) {
        setMenuOpen(false);
        e.stopPropagation();
        return;
      }
      requestClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [discardCommentDialogOpen, menuOpen, requestClose]);

  const topLevel = useMemo(
    () => comments.filter((c) => c.parent_comment_id === null),
    [comments]
  );

  const commentById = useMemo(() => {
    const m = new Map<string, CommentRow>();
    for (const c of comments) m.set(c.id, c);
    return m;
  }, [comments]);

  const repliesByParent = useMemo(() => {
    const m = new Map<string, CommentRow[]>();
    for (const c of comments) {
      if (!c.parent_comment_id) continue;
      const rootId = threadRootCommentId(c, commentById);
      const arr = m.get(rootId) ?? [];
      arr.push(c);
      m.set(rootId, arr);
    }
    for (const arr of m.values()) {
      arr.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }
    return m;
  }, [comments, commentById]);

  const commentedByMe = useMemo(() => {
    if (post.commented_by_me) return true;
    if (!currentAuthorId) return false;
    return comments.some((c) => c.author_id === currentAuthorId);
  }, [comments, currentAuthorId, post.commented_by_me]);

  const markWinCelebratedIfAdmin = useCallback(() => {
    if (post.category?.slug !== "wins" || editorRole !== "admin" || !currentUserId) {
      return;
    }
    markCommunityWinPostHandled(currentUserId, post.id);
  }, [currentUserId, editorRole, post.category?.slug, post.id]);

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
    try {
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
      if (error) {
        const msg = supabaseErrorMessage(error);
        const hint = communityAccessHint(msg);
        setActionError(hint ? `${msg}\n\n${hint}` : msg);
        return;
      }
      setEditing(false);
      setMenuOpen(false);
      await onPostsChanged();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Something went wrong while saving.";
      setActionError(msg);
    } finally {
      setSaveEditBusy(false);
    }
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
    const pendingImages = topCommentPendingImages;
    if ((!text && pendingImages.length === 0) || submitting) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const authorId = await getCommunityAuthorId(coachPersona);
      if (!authorId) {
        setActionError("Not signed in.");
        return;
      }

      const result = await insertCommunityCommentRow({
        postId: post.id,
        authorId,
        body: text,
        parentCommentId: null,
        pendingImages,
      });
      if ("error" in result) {
        setActionError(result.error);
        return;
      }

      const inserted = result.comment;
      setNewComment("");
      clearPendingCommentImages(pendingImages);
      setTopCommentPendingImages([]);
      setCommentComposerFocused(false);
      setComments((prev) => appendComment(prev, inserted));
      appendCommunityPostCommentsCache(post.id, inserted);
      markWinCelebratedIfAdmin();
      onMarkPostRead(post.id);
      if (onPostLocalUpdate) {
        onPostLocalUpdate(post.id, (p) => ({
          comment_count: p.comment_count + 1,
          commented_by_me: true,
          last_comment_at: inserted.created_at,
        }));
      } else {
        await onPostsChanged();
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Something went wrong while posting your comment.";
      setActionError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    coachPersona,
    markWinCelebratedIfAdmin,
    newComment,
    topCommentPendingImages,
    onMarkPostRead,
    onPostLocalUpdate,
    onPostsChanged,
    post.id,
    submitting,
  ]);

  const handleToggleLike = useCallback(async () => {
    if (likeBusy) return;
    const wasLiked = post.liked_by_me;
    setLikeBusy(true);
    if (onPostLocalUpdate) {
      onPostLocalUpdate(post.id, (p) => ({
        liked_by_me: !wasLiked,
        like_count: Math.max(0, p.like_count + (wasLiked ? -1 : 1)),
      }));
    }
    try {
      await toggleCommunityPostLike(post.id, wasLiked);
      if (!wasLiked) onMarkPostRead(post.id);
      if (!onPostLocalUpdate) await onPostsChanged();
    } catch {
      if (onPostLocalUpdate) {
        onPostLocalUpdate(post.id, (p) => ({
          liked_by_me: wasLiked,
          like_count: Math.max(0, p.like_count + (wasLiked ? 1 : -1)),
        }));
      }
    } finally {
      setLikeBusy(false);
    }
  }, [
    likeBusy,
    onMarkPostRead,
    onPostLocalUpdate,
    onPostsChanged,
    post.id,
    post.liked_by_me,
  ]);

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
        await reloadComments();
      } finally {
        setCommentLikeBusyId(null);
      }
    },
    [commentLikeBusyId, reloadComments]
  );

  const scrollToComments = useCallback(() => {
    commentsAnchorRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const openReplyComposer = useCallback((target: CommentRow) => {
    setReplyOpenFor((current) => {
      const opening = current !== target.id;
      if (opening && target.parent_comment_id) {
        const authorName = target.author
          ? displayNameFromProfile(target.author)
          : "member";
        setReplyDrafts((d) => ({
          ...d,
          [target.id]:
            (d[target.id] ?? "").trim() ||
            mentionTokenForAuthor(target.author_id, authorName),
        }));
      }
      return opening ? target.id : null;
    });
  }, []);

  const submitReply = useCallback(
    async (draftKey: string, threadParentId: string) => {
      const text = (replyDrafts[draftKey] ?? "").trim();
      const pendingImages = replyPendingImages[draftKey] ?? [];
      if ((!text && pendingImages.length === 0) || submitting) return;
      setSubmitting(true);
      setActionError(null);
      try {
        const authorId = await getCommunityAuthorId(coachPersona);
        if (!authorId) {
          setActionError("Not signed in.");
          return;
        }

        const result = await insertCommunityCommentRow({
          postId: post.id,
          authorId,
          body: text,
          parentCommentId: threadParentId,
          pendingImages,
        });
        if ("error" in result) {
          setActionError(result.error);
          return;
        }

        const inserted = result.comment;
        setReplyDrafts((d) => ({ ...d, [draftKey]: "" }));
        clearPendingCommentImages(pendingImages);
        setReplyPendingImages((prev) => {
          const next = { ...prev };
          delete next[draftKey];
          return next;
        });
        setReplyOpenFor(null);
        setComments((prev) => appendComment(prev, inserted));
        appendCommunityPostCommentsCache(post.id, inserted);
        markWinCelebratedIfAdmin();
        onMarkPostRead(post.id);
        if (onPostLocalUpdate) {
          onPostLocalUpdate(post.id, (p) => ({
            comment_count: p.comment_count + 1,
            commented_by_me: true,
            last_comment_at: inserted.created_at,
          }));
        } else {
          await onPostsChanged();
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Something went wrong while posting your reply.";
        setActionError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [
      coachPersona,
      markWinCelebratedIfAdmin,
      replyDrafts,
      replyPendingImages,
      submitting,
      post.id,
      onMarkPostRead,
      onPostLocalUpdate,
      onPostsChanged,
    ]
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
      await reloadComments();
      // Editing a comment body does not change any post-level counter, so a
      // full feed reload is only needed when we cannot patch locally.
      if (!onPostLocalUpdate) await onPostsChanged();
    },
    [
      canManageComment,
      cancelEditingComment,
      commentActionBusyId,
      commentEditDrafts,
      reloadComments,
      onPostLocalUpdate,
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
      await reloadComments();
      if (onPostLocalUpdate) {
        // Approximate the new count locally; the exact value (accounting for
        // any cascaded reply deletes) is reconciled on the next feed load.
        onPostLocalUpdate(post.id, (p) => ({
          comment_count: Math.max(0, p.comment_count - 1),
        }));
      } else {
        await onPostsChanged();
      }
    },
    [
      canManageComment,
      cancelEditingComment,
      commentActionBusyId,
      reloadComments,
      onPostLocalUpdate,
      onPostsChanged,
      post.id,
    ]
  );

  const card = (
      <div
        className={`relative w-full ${
          presentation === "embedded"
            ? "flex min-h-0 flex-1 flex-col"
            : "max-w-[calc(42rem*1.15)]"
        }`}
        onClick={presentation === "overlay" ? (e) => e.stopPropagation() : undefined}
      >
        {presentation === "overlay" ? (
          <button
            type="button"
            onClick={requestClose}
            className="absolute -right-1.5 -top-1.5 z-30 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md hover:bg-slate-50 hover:text-slate-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        ) : null}
        <div
          className={`relative flex min-h-0 w-full flex-col overflow-hidden bg-white ${
            presentation === "embedded"
              ? "min-h-0 flex-1"
              : "max-h-[90dvh] rounded-2xl border border-slate-200 shadow-xl"
          }`}
        >
        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 py-5 sm:px-8"
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
                {!editing ? (
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
                      setEditTitle(post.title);
                      setEditBody(post.body);
                      setEditCategoryId(post.category_id);
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
                    placeholder="Write something…"
                    autoResize
                    maxAutoHeightPx={0}
                    minAutoHeightPx={140}
                    showFormattingToolbar
                    className="w-full border-0 bg-transparent px-0 pb-1 text-[calc(1rem+2px)] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                  />
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
                <div className="pb-3">
                  <h2
                    id="post-detail-title"
                    className="mt-2.5 text-[calc(1.5rem+2px)] font-semibold leading-snug tracking-tight text-slate-900"
                  >
                    {post.title}
                  </h2>
                  <div className="mt-2.5 text-[calc(1rem+2px)] leading-normal text-slate-800">
                    {bodyExpanded || !needsBodyTruncation ? (
                      <CommunityPostMarkdownBody
                        body={post.body}
                        nameById={nameById}
                        profileHrefByUserId={mentionProfileHrefByUserId}
                      />
                    ) : (
                      <>
                        <div className="relative">
                          <div className="line-clamp-9 overflow-hidden break-words">
                            <CommunityPostMarkdownBody
                              body={post.body}
                              nameById={nameById}
                              profileHrefByUserId={mentionProfileHrefByUserId}
                              className="block text-inherit"
                            />
                          </div>
                          <div
                            aria-hidden
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white via-white/90 to-transparent"
                          />
                        </div>
                        <button
                          type="button"
                          className="mt-1 inline-flex items-baseline gap-0.5 font-medium text-sky-600 hover:text-sky-500 hover:underline"
                          onClick={() => setBodyExpanded(true)}
                        >
                          <span className="text-slate-400" aria-hidden>
                            …
                          </span>
                          See more
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            {!editing && post.media.length > 0 ? (
              <CommunityPostMediaGallery items={post.media} />
            ) : null}
            {!editing ? (
              <div>
                <PostEngagementBar
                  postId={post.id}
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
                                prioritizeUserId={mentionPrioritizeUserId}
                                rows={3}
                                className="w-full resize-y rounded-lg border border-slate-200 px-2 py-1.5 text-[17px] text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
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
                            <>
                              {c.body.trim() ? (
                                <MentionBody
                                  body={c.body}
                                  nameById={nameById}
                                  profileHrefByUserId={mentionProfileHrefByUserId}
                                  className="mt-1 text-[17px] text-slate-800"
                                />
                              ) : null}
                              <CommentMediaDisplay
                                media={c.media}
                                className={c.body.trim() ? "mt-2" : "mt-1"}
                              />
                            </>
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
                              className="rounded-md px-2 py-1 text-sm font-medium text-sky-700 transition hover:bg-slate-200/70 hover:underline"
                              onClick={() => openReplyComposer(c)}
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
                                prioritizeUserId={mentionPrioritizeUserId}
                                placeholder="Write a reply…"
                                rows={3}
                                className="w-full resize-y rounded-lg border border-slate-200 px-2 py-1.5 text-[17px] text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                              />
                              <CommentImageComposer
                                pending={replyPendingImages[c.id] ?? []}
                                onChange={(next) =>
                                  setReplyPendingImages((prev) => ({
                                    ...prev,
                                    [c.id]: next,
                                  }))
                                }
                                disabled={submitting}
                                onError={setActionError}
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => void submitReply(c.id, c.id)}
                                  disabled={
                                    submitting ||
                                    (!(replyDrafts[c.id] ?? "").trim() &&
                                      (replyPendingImages[c.id] ?? []).length ===
                                        0)
                                  }
                                  className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
                                >
                                  Reply
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    clearPendingCommentImages(
                                      replyPendingImages[c.id] ?? []
                                    );
                                    setReplyPendingImages((prev) => {
                                      const next = { ...prev };
                                      delete next[c.id];
                                      return next;
                                    });
                                    setReplyOpenFor(null);
                                  }}
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
                                              prioritizeUserId={mentionPrioritizeUserId}
                                              rows={3}
                                              className="w-full resize-y rounded-lg border border-slate-200 px-2 py-1.5 text-[17px] text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
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
                                          <>
                                            {r.body.trim() ? (
                                              <MentionBody
                                                body={r.body}
                                                nameById={nameById}
                                                profileHrefByUserId={
                                                  mentionProfileHrefByUserId
                                                }
                                                className="mt-0.5 text-[17px] text-slate-800"
                                              />
                                            ) : null}
                                            <CommentMediaDisplay
                                              media={r.media}
                                              className={
                                                r.body.trim() ? "mt-2" : "mt-0.5"
                                              }
                                            />
                                          </>
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
                                          <button
                                            type="button"
                                            className="rounded-md px-2 py-1 text-sm font-medium text-sky-700 transition hover:bg-slate-200/70 hover:underline"
                                            onClick={() => openReplyComposer(r)}
                                          >
                                            Reply
                                          </button>
                                        </div>

                                        {replyOpenFor === r.id ? (
                                          <div className="mt-2 space-y-2">
                                            <MentionTextarea
                                              value={replyDrafts[r.id] ?? ""}
                                              onChange={(v) =>
                                                setReplyDrafts((d) => ({
                                                  ...d,
                                                  [r.id]: v,
                                                }))
                                              }
                                              prioritizeUserId={mentionPrioritizeUserId}
                                              placeholder="Write a reply…"
                                              rows={3}
                                              className="w-full resize-y rounded-lg border border-slate-200 px-2 py-1.5 text-[17px] text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                                            />
                                            <CommentImageComposer
                                              pending={replyPendingImages[r.id] ?? []}
                                              onChange={(next) =>
                                                setReplyPendingImages((prev) => ({
                                                  ...prev,
                                                  [r.id]: next,
                                                }))
                                              }
                                              disabled={submitting}
                                              onError={setActionError}
                                            />
                                            <div className="flex gap-2">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  void submitReply(r.id, c.id)
                                                }
                                                disabled={
                                                  submitting ||
                                                  (!(replyDrafts[r.id] ?? "").trim() &&
                                                    (replyPendingImages[r.id] ?? [])
                                                      .length === 0)
                                                }
                                                className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
                                              >
                                                Reply
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  clearPendingCommentImages(
                                                    replyPendingImages[r.id] ?? []
                                                  );
                                                  setReplyPendingImages((prev) => {
                                                    const next = { ...prev };
                                                    delete next[r.id];
                                                    return next;
                                                  });
                                                  setReplyOpenFor(null);
                                                }}
                                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        ) : null}
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
          </div>
        </div>
        {!editing ? (
          <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-8">
            <div className="flex items-end gap-3">
              {composerProfile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={composerProfile.avatar_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="mb-0.5 h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-slate-100"
                />
              ) : (
                <span className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-600">
                  {profileInitialsFromName(composerDisplayName)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div
                  className="overflow-hidden rounded-2xl border border-slate-300 bg-slate-50"
                  onFocus={() => setCommentComposerFocused(true)}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setCommentComposerFocused(false);
                    }
                  }}
                >
                  {commentComposerExpanded &&
                  topCommentPendingImages.length > 0 ? (
                    <div className="border-b border-slate-200 px-3 py-2">
                      <CommentImagePreviews
                        pending={topCommentPendingImages}
                        onChange={setTopCommentPendingImages}
                        disabled={submitting}
                      />
                    </div>
                  ) : null}
                  {commentComposerExpanded ? (
                    <>
                      <MentionTextarea
                        value={newComment}
                        onChange={setNewComment}
                        prioritizeUserId={mentionPrioritizeUserId}
                        placeholder="Your comment"
                        autoResize
                        maxAutoHeightPx={220}
                        className="min-h-[2.75rem] w-full resize-none overflow-hidden border-0 bg-transparent px-3.5 py-2 text-[17px] leading-normal text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-0"
                      />
                      <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-2 py-1.5">
                        {showCommentComposerActions ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setNewComment("");
                                clearPendingCommentImages(
                                  topCommentPendingImages
                                );
                                setTopCommentPendingImages([]);
                                setCommentComposerFocused(false);
                              }}
                              className="text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-800"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={
                                submitting ||
                                (!newComment.trim() &&
                                  topCommentPendingImages.length === 0)
                              }
                              onClick={() => void submitTopComment()}
                              className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white hover:bg-sky-700 disabled:opacity-50"
                            >
                              {submitting ? "Sending…" : "Comment"}
                            </button>
                          </>
                        ) : null}
                        <CommentAttachButton
                          pending={topCommentPendingImages}
                          onChange={setTopCommentPendingImages}
                          disabled={submitting}
                          onError={setActionError}
                          onAttachInteract={() =>
                            setCommentComposerFocused(true)
                          }
                          size="md"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="relative min-h-[2.75rem]">
                      <MentionTextarea
                        value={newComment}
                        onChange={setNewComment}
                        prioritizeUserId={mentionPrioritizeUserId}
                        placeholder="Your comment"
                        autoResize
                        maxAutoHeightPx={72}
                        rows={1}
                        className="min-h-[2.75rem] w-full resize-none overflow-hidden border-0 bg-transparent py-2 pl-3.5 pr-12 text-[17px] leading-normal text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-0"
                      />
                      <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center">
                        <CommentAttachButton
                          pending={topCommentPendingImages}
                          onChange={setTopCommentPendingImages}
                          disabled={submitting}
                          onError={setActionError}
                          onAttachInteract={() =>
                            setCommentComposerFocused(true)
                          }
                          size="md"
                          className="pointer-events-auto"
                        />
                      </div>
                    </div>
                  )}
                </div>
                {actionError ? (
                  <p
                    className="mt-2 whitespace-pre-wrap text-sm text-rose-700"
                    role="alert"
                  >
                    {actionError}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        </div>
      </div>
  );

  const discardDialog = (
    <UnsavedCommentDiscardDialog
      open={discardCommentDialogOpen}
      onStay={() => setDiscardCommentDialogOpen(false)}
      onLeave={confirmDiscardCommentAndClose}
    />
  );

  if (presentation === "embedded") {
    return (
      <>
        {card}
        {discardDialog}
      </>
    );
  }

  return (
    <>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden overscroll-none bg-black/45 p-4"
        onClick={requestClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-detail-title"
      >
        {card}
      </div>
      {discardDialog}
    </>
  );
}
