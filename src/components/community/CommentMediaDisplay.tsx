"use client";

import type { CommunityCommentMediaItem } from "@/lib/communityCommentMedia";

export function CommentMediaDisplay({
  media,
  className = "",
}: {
  media: CommunityCommentMediaItem[];
  className?: string;
}) {
  if (media.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {media.map((item) => (
        <a
          key={item.url}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block max-w-full"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            className="max-h-56 max-w-full rounded-lg object-cover ring-1 ring-slate-200"
          />
        </a>
      ))}
    </div>
  );
}
