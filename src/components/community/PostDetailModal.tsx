"use client";

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
  Link2,
  MoreHorizontal,
  Pencil,
  Trash2,
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
import { PostEngagementBar } from "@/components/community/PostEngagementBar";
import { toggleCommunityPostLike } from "@/lib/communityPostLike";
import {
  fetchStaffAvatarMap,
  mergeAuthorAvatar,
} from "@/lib/communityStaffAvatars";
import { postBodyNeedsTruncation } from "@/lib/communityPostBodyTruncation";
import {
  communityAccessHint,
  supabaseErrorMessage,
} from "@/lib/supabaseErrorMessage";

type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  parent_comment_id: string | null;
  author: ProfileRow | null;
};

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

export function PostDetailModal({
  post,
  categories,
  onClose,
  onPostsChanged,
}: Props) {
  const pathname = usePathname();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [nameById, setNameById] = useState<Record<string, string>>({});
  const [newComment, setNewComment] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyOpenFor, setReplyOpenFor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const commentsAnchorRef = useRef<HTMLDivElement>(null);
  const [postAuthorDisplay, setPostAuthorDisplay] = useState<ProfileRow | null>(
    null
  );
  const postRef = useRef(post);
  postRef.current = post;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editBody, setEditBody] = useState(post.body);
  const [editCategoryId, setEditCategoryId] = useState(post.category_id);
  const [saveEditBusy, setSaveEditBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setPostAuthorDisplay(post.author ?? null);
    setEditTitle(post.title);
    setEditBody(post.body);
    setEditCategoryId(post.category_id);
    setEditing(false);
    setBodyExpanded(false);
  }, [post.id, post.author, post.title, post.body, post.category_id]);

  useEffect(() => {
    void supabaseClient.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
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

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${pathname}?post=${post.id}`;
  }, [pathname, post.id]);

  const needsBodyTruncation = useMemo(
    () => postBodyNeedsTruncation(post.body),
    [post.body]
  );

  const isAuthor =
    Boolean(currentUserId && post.author?.id === currentUserId);

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
      Omit<CommentRow, "author"> & {
        author: ProfileRow | ProfileRow[] | null;
      }
    >;
    const mapped: CommentRow[] = rows.map((row) => ({
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
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchProfilesByIds(need);
        if (!cancelled) setNameById(buildNameMap(rows));
      } catch {
        if (!cancelled) setNameById({});
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
    const { error } = await supabaseClient
      .from("community_posts")
      .update({
        title,
        body,
        category_id: editCategoryId,
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
    editBody,
    editCategoryId,
    editTitle,
    onPostsChanged,
    post.id,
    saveEditBusy,
  ]);

  const submitTopComment = useCallback(async () => {
    const text = newComment.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) {
      setSubmitting(false);
      return;
    }
    const { error } = await supabaseClient
      .from("community_post_comments")
      .insert({
        post_id: post.id,
        author_id: user.id,
        body: text,
        parent_comment_id: null,
      });
    setSubmitting(false);
    if (!error) {
      setNewComment("");
      await loadComments();
      await onPostsChanged();
    }
  }, [newComment, onPostsChanged, post.id, submitting, loadComments]);

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
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user) {
        setSubmitting(false);
        return;
      }
      const { error } = await supabaseClient
        .from("community_post_comments")
        .insert({
          post_id: post.id,
          author_id: user.id,
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
    [replyDrafts, submitting, post.id, loadComments, onPostsChanged]
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
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="flex items-start gap-3">
            {headerAuthor?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={headerAuthor.avatar_url}
                alt=""
                className="h-11 w-11 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-600">
                {authorName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-900">{authorName}</div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatCommentDate(post.created_at)}
                    {post.category ? (
                      <>
                        <span className="mx-1.5 select-none text-slate-400">
                          ·
                        </span>
                        <span>{post.category.label}</span>
                      </>
                    ) : null}
                  </p>
                </div>
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
                      className="absolute right-0 z-20 mt-1 min-w-[11rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                    >
                      {isAuthor ? (
                        <>
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                            onClick={() => {
                              setActionError(null);
                              setEditing(true);
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
                            onClick={() => void copyPostLink()}
                          >
                            <Link2 className="h-4 w-4 shrink-0 opacity-70" />
                            Copy link
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                            onClick={reportPost}
                          >
                            <Flag className="h-4 w-4 shrink-0 opacity-70" />
                            Report to admins
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            disabled={deleteBusy}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                            onClick={() => void handleDeletePost()}
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
                            onClick={() => void copyPostLink()}
                          >
                            <Link2 className="h-4 w-4 shrink-0 opacity-70" />
                            Copy link
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                            onClick={reportPost}
                          >
                            <Flag className="h-4 w-4 shrink-0 opacity-70" />
                            Report to admins
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              {editing ? (
                <div className="mt-3 space-y-3">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xl font-semibold text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    aria-label="Post title"
                  />
                  <MentionTextarea
                    value={editBody}
                    onChange={setEditBody}
                    placeholder="Body…"
                    rows={8}
                    className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-[15px] text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
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
                    id="post-detail-title"
                    className="mt-3 text-2xl font-semibold leading-snug tracking-tight text-slate-900"
                  >
                    {post.title}
                  </h2>
                  <div className="mt-3 text-[15px] text-slate-800">
                    <div
                      className={
                        !bodyExpanded && needsBodyTruncation
                          ? "line-clamp-9 overflow-hidden"
                          : undefined
                      }
                    >
                      <MentionBody body={post.body} nameById={nameById} />
                    </div>
                    {needsBodyTruncation ? (
                      <button
                        type="button"
                        className="mt-1 text-sm font-medium text-sky-700 hover:underline"
                        onClick={() => setBodyExpanded((e) => !e)}
                      >
                        {bodyExpanded ? "See less" : "See more"}
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>

          {actionError && !editing ? (
            <p
              className="mt-3 whitespace-pre-wrap text-sm text-rose-700"
              role="alert"
            >
              {actionError}
            </p>
          ) : null}

          {!editing ? (
            <div className="mt-5">
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

          <div
            ref={commentsAnchorRef}
            id="community-post-comments"
            className="mt-8 border-t border-slate-200 pt-6"
          >
            <h3 className="text-sm font-semibold text-slate-900">Comments</h3>

            {commentsLoading ? (
              <p className="mt-3 text-sm text-slate-500">Loading comments…</p>
            ) : topLevel.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No comments yet.</p>
            ) : (
              <ul className="mt-4 space-y-6">
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
                            <span className="text-sm font-semibold text-slate-900">
                              {ca}
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatCommentDate(c.created_at)}
                            </span>
                          </div>
                          <MentionBody
                            body={c.body}
                            nameById={nameById}
                            className="mt-1 text-sm text-slate-800"
                          />
                          <button
                            type="button"
                            className="mt-2 text-xs font-medium text-sky-700 hover:underline"
                            onClick={() =>
                              setReplyOpenFor((x) =>
                                x === c.id ? null : c.id
                              )
                            }
                          >
                            Reply
                          </button>

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
                                          <span className="text-xs font-semibold text-slate-900">
                                            {ra}
                                          </span>
                                          <span className="text-[10px] text-slate-500">
                                            {formatCommentDate(r.created_at)}
                                          </span>
                                        </div>
                                        <MentionBody
                                          body={r.body}
                                          nameById={nameById}
                                          className="mt-0.5 text-sm text-slate-800"
                                        />
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

            <div className="mt-6 border-t border-slate-100 pt-4">
              <MentionTextarea
                value={newComment}
                onChange={setNewComment}
                placeholder="Add a comment… @mention someone"
                rows={3}
                className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
              <button
                type="button"
                disabled={submitting || !newComment.trim()}
                onClick={() => void submitTopComment()}
                className="mt-2 rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Comment"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end border-t border-slate-200 bg-slate-50 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
