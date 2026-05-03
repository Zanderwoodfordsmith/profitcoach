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
  Flag,
  ImagePlus,
  Link2,
  MoreHorizontal,
  Pencil,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";
import { displayNameFromProfile } from "@/lib/communityProfile";
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
import { MentionTextarea } from "@/components/community/MentionTextarea";
import { CommunityAuthorAvatar } from "@/components/community/CommunityAuthorAvatar";
import { PostEngagementBar } from "@/components/community/PostEngagementBar";
import { toggleCommunityCommentLike } from "@/lib/communityCommentLike";
import { toggleCommunityPostLike } from "@/lib/communityPostLike";
import { isUndefinedRelationError } from "@/lib/communitySupabaseErrors";
import {
  fetchStaffAvatarMap,
  mergeAuthorAvatar,
} from "@/lib/communityStaffAvatars";
import { uploadCommunityPostImage } from "@/lib/communityPostImage";
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
};

function formatCommentDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

async function fetchProfilesByIds(ids: string[]): Promise<ProfileRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, full_name, first_name, last_name, avatar_url")
    .in("id", ids);
  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

function PostDetailOverflowMenu({
  menuRef,
  menuOpen,
  setMenuOpen,
  isAuthor,
  deleteBusy,
  onEdit,
  onCopyLink,
  onReport,
  onDelete,
}: {
  menuRef: RefObject<HTMLDivElement | null>;
  menuOpen: boolean;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAuthor: boolean;
  deleteBusy: boolean;
  onEdit: () => void;
  onCopyLink: () => void | Promise<void>;
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
          className="absolute right-0 z-30 mt-1 min-w-[11rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {isAuthor ? (
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const postTitleRef = useRef<HTMLHeadingElement>(null);
  const [showCompactPostHeader, setShowCompactPostHeader] = useState(false);

  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editBody, setEditBody] = useState(post.body);
  const [editCategoryId, setEditCategoryId] = useState(post.category_id);
  const [saveEditBusy, setSaveEditBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [replaceImageFile, setReplaceImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  const replaceImagePreview = useMemo(
    () =>
      replaceImageFile ? URL.createObjectURL(replaceImageFile) : null,
    [replaceImageFile]
  );

  useEffect(() => {
    if (!replaceImagePreview) return;
    return () => URL.revokeObjectURL(replaceImagePreview);
  }, [replaceImagePreview]);

  useEffect(() => {
    setPostAuthorDisplay(post.author ?? null);
    setEditTitle(post.title);
    setEditBody(post.body);
    setEditCategoryId(post.category_id);
    setEditing(false);
    setBodyExpanded(false);
    setReplaceImageFile(null);
    setRemoveImage(false);
  }, [post.id, post.author, post.title, post.body, post.category_id]);

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
        author:profiles!author_id ( id, full_name, first_name, last_name, avatar_url )
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
    const title = editTitle.trim();
    const body = editBody.trim();
    if (!title || !body || saveEditBusy) return;
    setActionError(null);
    setSaveEditBusy(true);

    let image_url: string | null = post.image_url;
    if (replaceImageFile) {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const up = await uploadCommunityPostImage(
        replaceImageFile,
        session?.access_token
      );
      if ("error" in up) {
        setActionError(up.error);
        setSaveEditBusy(false);
        return;
      }
      image_url = up.image_url;
    } else if (removeImage) {
      image_url = null;
    }

    const { error } = await supabaseClient
      .from("community_posts")
      .update({
        title,
        body,
        category_id: editCategoryId,
        image_url,
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
    setReplaceImageFile(null);
    setRemoveImage(false);
    setMenuOpen(false);
    await onPostsChanged();
  }, [
    editBody,
    editCategoryId,
    editTitle,
    onPostsChanged,
    post.id,
    post.image_url,
    removeImage,
    replaceImageFile,
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
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
                isAuthor={isAuthor}
                deleteBusy={deleteBusy}
                onEdit={() => {
                  setActionError(null);
                  setEditing(true);
                }}
                onCopyLink={copyPostLink}
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
                  <div className="text-base font-semibold leading-tight text-slate-900">
                    {authorName}
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
                    isAuthor={isAuthor}
                    deleteBusy={deleteBusy}
                    onEdit={() => {
                      setActionError(null);
                      setEditing(true);
                    }}
                    onCopyLink={copyPostLink}
                    onReport={reportPost}
                    onDelete={handleDeletePost}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-3 flex w-full min-w-0 gap-3">
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[calc(1.25rem+2px)] font-semibold text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    aria-label="Post title"
                  />
                  <MentionTextarea
                    value={editBody}
                    onChange={setEditBody}
                    placeholder="Body…"
                    rows={8}
                    className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-[calc(1rem+2px)] text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                  {categories.length > 0 ? (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Category
                      </label>
                      <select
                        value={editCategoryId}
                        onChange={(e) => setEditCategoryId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Image (optional)
                    </label>
                    <div className="flex flex-wrap items-start gap-3">
                      {replaceImagePreview ? (
                        <div className="relative inline-block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={replaceImagePreview}
                            alt=""
                            className="max-h-40 max-w-full rounded-lg object-cover ring-1 ring-slate-200"
                          />
                          <button
                            type="button"
                            className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-white shadow hover:bg-slate-900"
                            aria-label="Remove new image"
                            onClick={() => setReplaceImageFile(null)}
                          >
                            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                          </button>
                        </div>
                      ) : post.image_url && !removeImage ? (
                        <div className="relative inline-block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={post.image_url}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="max-h-40 max-w-full rounded-lg object-cover ring-1 ring-slate-200"
                          />
                          <button
                            type="button"
                            className="mt-1 text-xs font-medium text-rose-600 hover:underline"
                            onClick={() => {
                              setRemoveImage(true);
                              setReplaceImageFile(null);
                            }}
                          >
                            Remove image
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">No image</p>
                      )}
                      {removeImage && !replaceImagePreview ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-sky-700 hover:underline"
                          onClick={() => setRemoveImage(false)}
                        >
                          Undo remove
                        </button>
                      ) : null}
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50">
                        <ImagePlus className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                        <span>
                          {post.image_url || replaceImagePreview
                            ? "Replace image"
                            : "Add image"}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            if (f) {
                              setReplaceImageFile(f);
                              setRemoveImage(false);
                            }
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        saveEditBusy ||
                        !editTitle.trim() ||
                        !editBody.trim()
                      }
                      onClick={() => void saveEdit()}
                      className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
                    >
                      {saveEditBusy ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setEditing(false);
                        setEditTitle(post.title);
                        setEditBody(post.body);
                        setEditCategoryId(post.category_id);
                        setReplaceImageFile(null);
                        setRemoveImage(false);
                      }}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
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
                        <p className="m-0">
                          <MentionBody
                            body={post.body}
                            nameById={nameById}
                            profileHrefByUserId={mentionProfileHrefByUserId}
                          />
                        </p>
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
                          <MentionBody
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
              {!editing ? (
                <div className="mt-3">
                  <PostEngagementBar
                    detail
                    likeCount={post.like_count}
                    commentCount={post.comment_count}
                    commentPreviewAuthors={post.comment_preview_authors}
                    likedByMe={post.liked_by_me}
                    disabled={likeBusy}
                    onToggleLike={handleToggleLike}
                    onCommentsClick={scrollToComments}
                  />
                </div>
              ) : null}
            </div>
            {!editing && post.image_url ? (
              <div className="relative shrink-0 self-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.image_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-[92px] w-[92px] rounded-xl object-cover ring-1 ring-slate-200"
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
            ) : topLevel.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">No comments yet.</p>
            ) : (
              <ul className="mt-2 space-y-5">
                {topLevel.map((c) => {
                  const ca = c.author
                    ? displayNameFromProfile(c.author)
                    : "Unknown";
                  const replies = repliesByParent.get(c.id) ?? [];
                  return (
                    <li key={c.id} className="rounded-xl bg-slate-50/80 p-3">
                      <div className="flex gap-2">
                        {c.author?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.author.avatar_url}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
                            {ca.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[15px] font-semibold text-slate-900">
                              {ca}
                            </span>
                            <span className="text-[13px] text-slate-500">
                              {formatCommentDate(c.created_at)}
                            </span>
                          </div>
                          <MentionBody
                            body={c.body}
                            nameById={nameById}
                            profileHrefByUserId={mentionProfileHrefByUserId}
                            className="mt-1 text-[15px] text-slate-800"
                          />
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
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
                                return (
                                  <li
                                    key={r.id}
                                    className="rounded-lg bg-white px-3 py-2"
                                  >
                                    <div className="flex gap-2">
                                      {r.author?.avatar_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={r.author.avatar_url}
                                          alt=""
                                          className="h-7 w-7 shrink-0 rounded-full object-cover"
                                        />
                                      ) : (
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-medium text-slate-600">
                                          {ra.slice(0, 1).toUpperCase()}
                                        </span>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="text-[13px] font-semibold text-slate-900">
                                            {ra}
                                          </span>
                                          <span className="text-[11px] text-slate-500">
                                            {formatCommentDate(r.created_at)}
                                          </span>
                                        </div>
                                        <MentionBody
                                          body={r.body}
                                          nameById={nameById}
                                          profileHrefByUserId={
                                            mentionProfileHrefByUserId
                                          }
                                          className="mt-0.5 text-[15px] text-slate-800"
                                        />
                                        <div className="mt-1">
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
            )}

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
                    {composerDisplayName.slice(0, 1).toUpperCase()}
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
