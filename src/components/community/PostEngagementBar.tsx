"use client";

import { MessageCircle, ThumbsUp } from "lucide-react";
import {
  profileInitialsFromProfile,
} from "@/lib/communityProfile";
import type { ProfileRow } from "@/components/community/CommunityFeed";
import { CommunityProfileHoverCard } from "@/components/community/CommunityProfileHoverCard";

type Props = {
  likeCount: number;
  commentCount: number;
  commentPreviewAuthors: ProfileRow[];
  likedByMe: boolean;
  detail?: boolean;
  disabled?: boolean;
  /** Shown to the right of comment preview avatars (e.g. “New comment 22h ago”). */
  commentRecencyLabel?: string | null;
  commentRecencyVariant?: "new" | "last" | null;
  onToggleLike: () => void | Promise<void>;
  onCommentsClick: () => void;
};

export function PostEngagementBar({
  likeCount,
  commentCount,
  commentPreviewAuthors,
  likedByMe,
  detail = false,
  disabled = false,
  commentRecencyLabel = null,
  commentRecencyVariant = null,
  onToggleLike,
  onCommentsClick,
}: Props) {
  const likeBtn = (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        void onToggleLike();
      }}
      className={
        detail
          ? `inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
              likedByMe
                ? "border-sky-300 bg-sky-50 text-sky-800"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            } disabled:opacity-50`
          : "inline-flex items-center gap-1.5 text-[15px] text-slate-500 hover:text-slate-700 disabled:opacity-50"
      }
      aria-pressed={likedByMe}
    >
      <ThumbsUp
        className={`shrink-0 ${detail ? "h-4 w-4" : "h-[18px] w-[18px]"} ${likedByMe ? "fill-sky-700 text-sky-700" : ""}`}
        strokeWidth={detail ? 2 : 1.75}
      />
      {detail ? <span>Like</span> : null}
      <span className="tabular-nums">{likeCount}</span>
    </button>
  );

  const commentBtn = (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onCommentsClick();
      }}
      className={
        detail
          ? "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          : "inline-flex items-center gap-1.5 text-[15px] text-slate-500 hover:text-slate-700 disabled:opacity-50"
      }
    >
      <MessageCircle
        className={`shrink-0 ${detail ? "h-4 w-4" : "h-[18px] w-[18px]"} ${
          commentCount > 0 ? "fill-sky-700 text-sky-700" : ""
        }`}
        strokeWidth={detail ? 2 : 1.75}
      />
      <span>
        <span className="tabular-nums">{commentCount}</span>
        {detail ? (commentCount === 1 ? " comment" : " comments") : null}
      </span>
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {likeBtn}
      {commentBtn}
      {commentPreviewAuthors.length > 0 || commentRecencyLabel ? (
        <div className="flex min-w-0 items-center gap-2 pl-1">
          {commentPreviewAuthors.length > 0 ? (
            <div className="flex shrink-0 -space-x-2">
              {commentPreviewAuthors.map((a, i) => (
                <CommunityProfileHoverCard
                  key={`${a.id}-${i}`}
                  userId={a.id}
                  profile={{
                    id: a.id,
                    full_name: a.full_name ?? null,
                    first_name: a.first_name ?? null,
                    last_name: a.last_name ?? null,
                    avatar_url: a.avatar_url ?? null,
                    role: a.role ?? null,
                  }}
                >
                  <span
                    className="relative inline-flex h-7 w-7 shrink-0 overflow-hidden rounded-full ring-2 ring-white"
                    style={{ zIndex: commentPreviewAuthors.length - i }}
                  >
                    {a.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.avatar_url}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-slate-200 text-[10px] font-medium text-slate-600">
                        {profileInitialsFromProfile(a)}
                      </span>
                    )}
                  </span>
                </CommunityProfileHoverCard>
              ))}
            </div>
          ) : null}
          {commentRecencyLabel ? (
            <span
              className={`min-w-0 truncate text-xs font-medium ${
                commentRecencyVariant === "new"
                  ? "text-sky-600"
                  : "text-slate-400"
              }`}
            >
              {commentRecencyLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
