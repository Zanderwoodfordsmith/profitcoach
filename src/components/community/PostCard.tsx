"use client";

import { displayNameFromProfile } from "@/lib/communityProfile";
import { bodyPreviewWithoutRawUuids } from "@/lib/communityMentions";
import type { CommunityPostRow } from "@/components/community/CommunityFeed";

type Props = {
  post: CommunityPostRow;
  onOpen: () => void;
};

function formatPostDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function PostCard({ post, onOpen }: Props) {
  const authorName = post.author
    ? displayNameFromProfile(post.author)
    : "Unknown";
  const preview = bodyPreviewWithoutRawUuids(post.body);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full min-h-[140px] flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow"
    >
      <div className="flex items-start gap-3">
        {post.author?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.author.avatar_url}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-600">
            {authorName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-slate-900">{authorName}</span>
            <span className="text-xs text-slate-500">
              {formatPostDate(post.created_at)}
            </span>
            {post.category ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {post.category.label}
              </span>
            ) : null}
            {post.is_pinned ? (
              <span className="text-xs font-medium text-amber-700">
                Pinned
              </span>
            ) : null}
          </div>
          <h2 className="mt-2 line-clamp-2 text-base font-semibold text-slate-900">
            {post.title}
          </h2>
          <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-slate-600">
            {preview || " "}
          </p>
        </div>
      </div>
    </button>
  );
}
