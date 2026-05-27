"use client";

import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";

import { communityCalendarCoverUrl } from "@/lib/communityCalendarDisplay";
import type { CommunityCalendarOccurrence } from "@/lib/communityCalendarTypes";

type Props = {
  occurrence: Pick<CommunityCalendarOccurrence, "cover_image_url" | "description">;
  /** Modal hero — full width of the modal, capped height. */
  variant?: "hero" | "thumbnail";
  className?: string;
};

export function CommunityCalendarCoverImage({
  occurrence,
  variant = "hero",
  className = "",
}: Props) {
  const src = communityCalendarCoverUrl(occurrence);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    if (variant === "thumbnail") return null;
    return (
      <div
        className={`flex min-h-32 w-full items-center justify-center bg-slate-100 text-slate-400 ${className}`}
      >
        <ImageIcon className="h-8 w-8" aria-hidden />
        <span className="sr-only">No cover image</span>
      </div>
    );
  }

  if (variant === "thumbnail") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={className}
      />
    );
  }

  return (
    <div
      className={`relative w-full shrink-0 overflow-hidden bg-slate-100 ${className}`}
    >
      <div className="aspect-[16/9] w-full sm:aspect-[2/1]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover object-center"
        />
      </div>
    </div>
  );
}
