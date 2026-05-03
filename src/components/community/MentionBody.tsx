"use client";

import Link from "next/link";
import { splitMentionSegments } from "@/lib/communityMentions";

type Props = {
  body: string;
  nameById: Record<string, string>;
  /** Public directory profile URL by user id, when listed */
  profileHrefByUserId?: Record<string, string | undefined>;
  className?: string;
};

const mentionClass =
  "font-medium text-sky-600 underline-offset-2 hover:text-sky-500 hover:underline";

/** Renders plain text + mention tokens as @DisplayName; optional directory profile link. */
export function MentionBody({
  body,
  nameById,
  profileHrefByUserId,
  className = "",
}: Props) {
  const segments = splitMentionSegments(body);

  return (
    <span className={`inline whitespace-pre-wrap break-words ${className}`}>
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          return <span key={i}>{seg.text}</span>;
        }
        const label =
          nameById[seg.userId] ?? seg.labelFromToken ?? "member";
        const href = profileHrefByUserId?.[seg.userId];
        const mentionLabel = `@${label}`;
        if (href) {
          return (
            <Link
              key={i}
              href={href}
              className={mentionClass}
              title={seg.userId}
              onClick={(e) => e.stopPropagation()}
            >
              {mentionLabel}
            </Link>
          );
        }
        return (
          <span key={i} className={mentionClass} title={seg.userId}>
            {mentionLabel}
          </span>
        );
      })}
    </span>
  );
}
