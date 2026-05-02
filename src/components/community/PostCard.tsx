"use client";

import { useState } from "react";
import { displayNameFromProfile } from "@/lib/communityProfile";
import { bodyPreviewWithoutRawUuids } from "@/lib/communityMentions";
import { toggleCommunityPostLike } from "@/lib/communityPostLike";
import type { CommunityPostRow } from "@/components/community/CommunityFeed";
import { PostEngagementBar } from "@/components/community/PostEngagementBar";
import { formatCommunityPostTimestamp } from "@/lib/communityRelativeTime";

type Props = {
  post: CommunityPostRow;
  onOpen: () => void;
  onPostsChanged: () => void | Promise<void>;
};

export function PostCard({ post, onOpen, onPostsChanged }: Props) {
  const authorName = post.author
    ? displayNameFromProfile(post.author)
    : "Unknown";
  const preview = bodyPreviewWithoutRawUuids(post.body);
  const [likeBusy, setLikeBusy] = useState(false);

  const handleToggleLike = async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    try {
      await toggleCommunityPostLike(post.id, post.liked_by_me);
      await onPostsChanged();
    } finally {
      setLikeBusy(false);
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex w-full min-h-[132px] cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow"
    >
      {/* Row 1: avatar + author only. Row 2: title/body/engagement full width (no blank strip under avatar). */}
      <div className="flex items-start gap-3">
        {post.author?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.author.avatar_url}
            alt=""
            referrerPolicy="no-referrer"
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-slate-100"
          />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-600">
            {authorName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-base font-semibold leading-tight text-slate-900">
              {authorName}
            </span>
            {post.is_pinned ? (
              <span className="text-xs font-medium text-amber-700">Pinned</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs leading-snug text-slate-500">
            {formatCommunityPostTimestamp(post.created_at)}
            {post.category ? (
              <>
                <span className="mx-1.5 select-none text-slate-400">·</span>
                <span>{post.category.label}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="mt-3 flex w-full min-w-0 gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-lg font-semibold leading-snug tracking-tight text-slate-900">
            {post.title}
          </h2>
          <p className="mt-1.5 line-clamp-3 text-base leading-relaxed text-slate-600">
            {preview || " "}
          </p>
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            <PostEngagementBar
              likeCount={post.like_count}
              commentCount={post.comment_count}
              commentPreviewAuthors={post.comment_preview_authors}
              likedByMe={post.liked_by_me}
              disabled={likeBusy}
              onToggleLike={handleToggleLike}
              onCommentsClick={onOpen}
            />
          </div>
        </div>
        {post.image_url ? (
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
    </article>
  );
}
