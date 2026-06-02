"use client";

import Link from "next/link";
import { COMMUNITY_EXTERNAL_LINK_CLASS, splitTextWithHttpUrls } from "@/lib/communityAutolink";
import {
  COMMUNITY_MENTION_LINK_CLASS,
  courseMentionHref,
  lessonMentionHref,
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
          const urlParts = splitTextWithHttpUrls(text);
          return (
            <span key={i}>
              {urlParts.map((part, j) =>
                part.type === "text" ? (
                  <span key={j}>{part.text}</span>
                ) : (
                  <a
                    key={j}
                    href={part.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={COMMUNITY_EXTERNAL_LINK_CLASS}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {part.label}
                  </a>
                )
              )}
            </span>
          );
        }
        if (seg.mentionType === "lesson" && seg.area && seg.courseId && seg.lessonId) {
          return (
            <Link
              key={i}
              href={lessonMentionHref(seg.area, seg.courseId, seg.lessonId)}
              className={COMMUNITY_MENTION_LINK_CLASS}
              onClick={(e) => e.stopPropagation()}
            >
              {`@${seg.labelFromToken ?? "lesson"}`}
            </Link>
          );
        }
        if (seg.mentionType === "course" && seg.area && seg.courseId) {
          return (
            <Link
              key={i}
              href={courseMentionHref(seg.area, seg.courseId)}
              className={COMMUNITY_MENTION_LINK_CLASS}
              onClick={(e) => e.stopPropagation()}
            >
              {`@${seg.labelFromToken ?? "course"}`}
            </Link>
          );
        }
        const userId = seg.userId ?? "";
        const label = nameById[userId] ?? seg.labelFromToken ?? "member";
        const href = profileHrefByUserId?.[userId];
        const mentionLabel = `@${label}`;
        if (href) {
          return (
            <CommunityProfileHoverCard
              key={i}
              userId={userId}
              profile={{ id: userId, full_name: label }}
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
            userId={userId}
            profile={{ id: userId, full_name: label }}
          >
            <span className={COMMUNITY_MENTION_LINK_CLASS}>{mentionLabel}</span>
          </CommunityProfileHoverCard>
        );
      })}
    </span>
  );
}
