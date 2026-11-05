"use client";

import { CommunityPostMediaGallery } from "@/components/community/CommunityPostMediaGallery";
import type { CommunityCommentMediaItem } from "@/lib/communityCommentMedia";

export function CommentMediaDisplay({
  media,
  className = "",
}: {
  media: CommunityCommentMediaItem[];
  className?: string;
}) {
  if (media.length === 0) return null;

  const images = media.filter((item) => item.kind === "image");
  // Videos, voice notes and documents use the post gallery's players and file links.
  const others = media.filter((item) => item.kind !== "image");

  return (
    <div className={`space-y-2 ${className}`}>
      {images.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {images.map((item) => (
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
      ) : null}
      {others.length > 0 ? (
        <CommunityPostMediaGallery items={others} variant="compact" />
      ) : null}
    </div>
  );
}
