"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import {
  communityPostMarkdownUrlTransform,
  prepareCommunityPostMarkdownSource,
} from "@/lib/communityPostMarkdown";
import { COMMUNITY_MENTION_LINK_CLASS } from "@/lib/communityMentions";

type Props = {
  body: string;
  nameById: Record<string, string>;
  profileHrefByUserId?: Record<string, string | undefined>;
  className?: string;
};

const ALLOWED_ELEMENTS = [
  "p",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "br",
  "blockquote",
  "code",
  "a",
] as const;

function reactNodeToPlainText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(reactNodeToPlainText).join("");
  if (typeof node === "object" && "props" in node && node.props) {
    return reactNodeToPlainText(
      (node as { props: { children?: ReactNode } }).props.children
    );
  }
  return "";
}

function buildComponents(
  nameById: Record<string, string>,
  profileHrefByUserId?: Record<string, string | undefined>
): Components {
  return {
    a: ({ href, children }) => {
      if (href?.startsWith("mention:")) {
        const uid = href.slice("mention:".length);
        const fromLink = reactNodeToPlainText(children).replace(/^@/, "");
        const label = nameById[uid] || fromLink || "member";
        const mentionLabel = `@${label}`;
        const profileHref = profileHrefByUserId?.[uid];
        if (profileHref) {
          return (
            <Link
              href={profileHref}
              className={COMMUNITY_MENTION_LINK_CLASS}
              title={uid}
              onClick={(e) => e.stopPropagation()}
            >
              {mentionLabel}
            </Link>
          );
        }
        return (
          <span className={COMMUNITY_MENTION_LINK_CLASS} title={uid}>
            {mentionLabel}
          </span>
        );
      }
      if (
        href &&
        (href.startsWith("http://") || href.startsWith("https://"))
      ) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sky-700 underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </a>
        );
      }
      return <span>{children}</span>;
    },
  };
}

const baseMarkdownClass =
  "min-w-0 whitespace-pre-wrap break-words text-inherit " +
  "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 " +
  "[&_strong]:font-semibold [&_em]:italic " +
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 " +
  "[&_li]:my-0.5 " +
  "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:leading-snug " +
  "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:leading-snug " +
  "[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:leading-snug " +
  "[&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:leading-snug " +
  "[&_h5]:mt-2 [&_h5]:mb-1 [&_h5]:text-[15px] [&_h5]:font-semibold " +
  "[&_h6]:mt-2 [&_h6]:mb-1 [&_h6]:text-[15px] [&_h6]:font-semibold " +
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-200 [&_blockquote]:pl-3 [&_blockquote]:text-slate-600 " +
  "[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.92em] [&_code]:font-mono";

export function CommunityPostMarkdownBody({
  body,
  nameById,
  profileHrefByUserId,
  className = "",
}: Props) {
  const source = useMemo(
    () => prepareCommunityPostMarkdownSource(body, nameById),
    [body, nameById]
  );
  const components = useMemo(
    () => buildComponents(nameById, profileHrefByUserId),
    [nameById, profileHrefByUserId]
  );

  return (
    <div className={`${baseMarkdownClass} ${className}`}>
      <ReactMarkdown
        allowedElements={[...ALLOWED_ELEMENTS]}
        skipHtml
        urlTransform={communityPostMarkdownUrlTransform}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
