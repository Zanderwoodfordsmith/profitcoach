"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { COMMUNITY_EXTERNAL_LINK_CLASS, splitTextWithLinks } from "@/lib/communityAutolink";
import { splitBoldRuns } from "@/lib/commentInlineFormat";
import {
  BROADCAST_MENTION_LABEL,
  COMMUNITY_BROADCAST_MENTION_CLASS,
  COMMUNITY_MENTION_LINK_CLASS,
  COMMUNITY_USER_MENTION_LINK_CLASS,
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

/**
 * Renders plain text + mention tokens as @DisplayName; optional directory
 * profile link. Comment formatting (`**bold**`, `[label](url)`) renders too.
 */
export function MentionBody({
  body,
  nameById,
  profileHrefByUserId,
  className = "",
  stripPreviewMarkdown = false,
}: Props) {
  const runs = stripPreviewMarkdown
    ? [{ text: body, bold: false }]
    : splitBoldRuns(body);

  return (
    <span className={`inline whitespace-pre-wrap break-words ${className}`}>
      {runs.map((run, r) => {
        const nodes = renderSegments(
          run.text,
          nameById,
          profileHrefByUserId,
          stripPreviewMarkdown
        );
        return run.bold ? (
          <strong key={r} className="font-semibold">
            {nodes}
          </strong>
        ) : (
          <Fragment key={r}>{nodes}</Fragment>
        );
      })}
    </span>
  );
}

function renderSegments(
  body: string,
  nameById: Record<string, string>,
  profileHrefByUserId: Record<string, string | undefined> | undefined,
  stripPreviewMarkdown: boolean
): ReactNode[] {
  return splitMentionSegments(body).map((seg, i) => {
    if (seg.kind === "text") {
      const text = stripPreviewMarkdown
        ? stripInlineMarkdownForCommunityPreviewFragment(seg.text)
        : seg.text;
      const urlParts = splitTextWithLinks(text);
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
    if (seg.mentionType === "group") {
      const label =
        seg.labelFromToken ||
        (seg.group ? BROADCAST_MENTION_LABEL[seg.group] : "everyone");
      return (
        <span key={i} className={COMMUNITY_BROADCAST_MENTION_CLASS}>
          {`@${label}`}
        </span>
      );
    }
    if (seg.mentionType === "lesson" && seg.area && seg.courseId && seg.lessonId) {
      return (
        <Link
          key={i}
          href={lessonMentionHref(seg.area, seg.courseId, seg.lessonId, seg.spot)}
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
    if (seg.mentionType === "page" && seg.path) {
      return (
        <Link
          key={i}
          href={seg.path}
          className={COMMUNITY_MENTION_LINK_CLASS}
          onClick={(e) => e.stopPropagation()}
        >
          {`@${seg.labelFromToken ?? "page"}`}
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
            className={COMMUNITY_USER_MENTION_LINK_CLASS}
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
        <span className={COMMUNITY_USER_MENTION_LINK_CLASS}>{mentionLabel}</span>
      </CommunityProfileHoverCard>
    );
  });
}
