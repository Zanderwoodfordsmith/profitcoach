"use client";

import { useMemo, useState } from "react";
import { Pin } from "lucide-react";
import { displayNameFromProfile } from "@/lib/communityProfile";
import { MentionBody } from "@/components/community/MentionBody";
import { toggleCommunityPostLike } from "@/lib/communityPostLike";
import type { CommunityPostRow } from "@/components/community/CommunityFeed";
import { CommunityAuthorAvatar } from "@/components/community/CommunityAuthorAvatar";
import { PostEngagementBar } from "@/components/community/PostEngagementBar";
import {
  formatCommunityPostTimestamp,
  formatCommunityRelativeActivityAgo,
} from "@/lib/communityRelativeTime";

type Props = {
  post: CommunityPostRow;
  /** Display names for @mentions in the card body (from feed batch lookup). */
  feedMentionNameById: Record<string, string>;
  /** From local feed state: user opened this post before. */
  feedCardHasBeenRead: boolean;
  /** Max comment `created_at` the user has seen in the thread (local). */
  commentsSeenWatermarkIso: string | null;
  onOpen: () => void;
  onPostsChanged: () => void | Promise<void>;
};

export function PostCard({
  post,
  feedMentionNameById,
  feedCardHasBeenRead,
  commentsSeenWatermarkIso,
  onOpen,
  onPostsChanged,
}: Props) {
  const authorName = post.author
    ? displayNameFromProfile(post.author)
    : "Unknown";
  const [likeBusy, setLikeBusy] = useState(false);

  const commentActivity = useMemo(() => {
    const lastIso = post.last_comment_at;
    if (!lastIso) return null;
    const last = new Date(lastIso).getTime();
    const hasUnseen =
      !commentsSeenWatermarkIso ||
      last > new Date(commentsSeenWatermarkIso).getTime();
    const ago = formatCommunityRelativeActivityAgo(lastIso);
    if (!ago) return null;
    if (hasUnseen) {
      return { variant: "new" as const, label: `New comment ${ago}` };
    }
    return { variant: "last" as const, label: `Last comment ${ago}` };
  }, [post.last_comment_at, commentsSeenWatermarkIso]);

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

  const pinnedChromeClass = post.is_pinned ? "border-sky-200" : "";

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
      className={`flex w-full min-h-[132px] cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white py-4 px-[1.125rem] text-left transition hover:border-slate-300 hover:shadow ${pinnedChromeClass} ${
        feedCardHasBeenRead
          ? post.is_pinned
            ? "opacity-50 shadow-[0_1px_2px_rgb(2_132_199/0.18)]"
            : "opacity-50 shadow-sm"
          : post.is_pinned
            ? "opacity-100 shadow-[0_0_0_1px_rgb(186_230_253/0.7),0_8px_20px_-12px_rgb(2_132_199/0.45)]"
            : "opacity-100 shadow-[0_1px_2px_rgb(15_23_42/0.05),0_3px_8px_-3px_rgb(15_23_42/0.08)]"
      }`}
    >
      {/* Row 1: avatar + author only. Row 2: title/body/engagement full width (no blank strip under avatar). */}
      <div className="flex items-start gap-3">
        <CommunityAuthorAvatar profile={post.author} size="md" />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-base font-semibold leading-tight text-slate-900">
              {authorName}
            </span>
            {post.is_pinned ? (
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-900">
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
                <span className="mx-0.5 select-none text-slate-400">·</span>
                <span className="font-semibold text-slate-500">
                  {post.category.label}
                </span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="mt-3 flex w-full min-w-0 gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 py-1.5 text-xl font-semibold leading-snug tracking-tight text-slate-900">
            {post.title}
          </h2>
          <div className="mt-1.5 line-clamp-2 text-base leading-relaxed text-slate-600">
            {post.body.trim() ? (
              <MentionBody
                body={post.body}
                nameById={feedMentionNameById}
                stripPreviewMarkdown
              />
            ) : (
              "\u00a0"
            )}
          </div>
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            <PostEngagementBar
              likeCount={post.like_count}
              commentCount={post.comment_count}
              commentPreviewAuthors={post.comment_preview_authors}
              likedByMe={post.liked_by_me}
              disabled={likeBusy}
              commentRecencyLabel={commentActivity?.label ?? null}
              commentRecencyVariant={commentActivity?.variant ?? null}
              onToggleLike={handleToggleLike}
              onCommentsClick={onOpen}
            />
          </div>
        </div>
        {post.media[0] ? (
          <div className="relative shrink-0 self-start overflow-hidden rounded-xl ring-1 ring-slate-200">
            {post.media[0].kind === "video" ? (
              <video
                src={post.media[0].url}
                muted
                playsInline
                preload="metadata"
                className="h-[92px] w-[92px] object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.media[0].url}
                alt=""
                referrerPolicy="no-referrer"
                className="h-[92px] w-[92px] object-cover"
              />
            )}
            {post.media.length > 1 ? (
              <span className="absolute bottom-1 right-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                +{post.media.length - 1}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
