"use client";

import Link from "next/link";
import {
  COMMUNITY_MENTION_LINK_CLASS,
  splitMentionSegments,
} from "@/lib/communityMentions";
import { stripInlineMarkdownForCommunityPreviewFragment } from "@/lib/communityPostMarkdown";
import { CommunityProfileHoverCard } from "@/components/community/CommunityProfileHoverCard";

type Props = {
  body: string;
  nameById: Record<string, string>;
  /** Public directory profile URL by user id, when listed */
  profileHrefByUserId?: Record<string, string | undefined>;
  className?: string;
  /** Strip markdown/list noise from plain text segments (feed card previews). */
  stripPreviewMarkdown?: boolean;
};

/** Renders plain text + mention tokens as @DisplayName; optional directory profile link. */
export function MentionBody({
  body,
  nameById,
  profileHrefByUserId,
  className = "",
  stripPreviewMarkdown = false,
}: Props) {
  const segments = splitMentionSegments(body);

  return (
    <span className={`inline whitespace-pre-wrap break-words ${className}`}>
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          const text = stripPreviewMarkdown
            ? stripInlineMarkdownForCommunityPreviewFragment(seg.text)
            : seg.text;
          return <span key={i}>{text}</span>;
        }
        const label =
          nameById[seg.userId] ?? seg.labelFromToken ?? "member";
        const href = profileHrefByUserId?.[seg.userId];
        const mentionLabel = `@${label}`;
        if (href) {
          return (
            <CommunityProfileHoverCard
              key={i}
              userId={seg.userId}
              profile={{ id: seg.userId, full_name: label }}
            >
              <Link
                href={href}
                className={COMMUNITY_MENTION_LINK_CLASS}
                onClick={(e) => e.stopPropagation()}
              >
                {mentionLabel}
              </Link>
            </CommunityProfileHoverCard>
          );
        }
        return (
          <CommunityProfileHoverCard
            key={i}
            userId={seg.userId}
            profile={{ id: seg.userId, full_name: label }}
          >
            <span className={COMMUNITY_MENTION_LINK_CLASS}>{mentionLabel}</span>
          </CommunityProfileHoverCard>
        );
      })}
    </span>
  );
}
