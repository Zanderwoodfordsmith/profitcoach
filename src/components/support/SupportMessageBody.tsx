"use client";

import {
  COMMUNITY_EXTERNAL_LINK_CLASS,
  splitTextWithHttpUrls,
} from "@/lib/communityAutolink";
import { inlineTokens } from "@/lib/articles";

const DEFAULT_CLASS =
  "min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[15px] leading-relaxed";

const LINK_CLASS = `${COMMUNITY_EXTERNAL_LINK_CLASS} break-all`;

function safeHttpHref(href: string): string | null {
  try {
    const u = new URL(href);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

function AutolinkText({ text }: { text: string }) {
  return (
    <>
      {splitTextWithHttpUrls(text).map((part, j) =>
        part.type === "text" ? (
          <span key={j}>{part.text}</span>
        ) : (
          <a
            key={j}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            {part.label}
          </a>
        )
      )}
    </>
  );
}

/** Renders support message text: **bold**, *italic*, [label](url), and bare http(s) links. */
export function SupportMessageBody({
  body,
  className = DEFAULT_CLASS,
  as: Tag = "p",
}: {
  body: string;
  className?: string;
  as?: "p" | "span" | "div";
}) {
  return (
    <Tag className={className}>
      {inlineTokens(body).map((t, i) => {
        if (t.type === "strong") {
          return (
            <strong key={i} className="font-semibold">
              {t.text}
            </strong>
          );
        }
        if (t.type === "em") {
          return <em key={i}>{t.text}</em>;
        }
        if (t.type === "link") {
          const href = safeHttpHref(t.href);
          if (!href) return <span key={i}>{t.text}</span>;
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={LINK_CLASS}
            >
              {t.text}
            </a>
          );
        }
        return <AutolinkText key={i} text={t.text} />;
      })}
    </Tag>
  );
}
