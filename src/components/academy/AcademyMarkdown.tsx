"use client";

import type { ComponentPropsWithoutRef } from "react";
import type { Element, ElementContent } from "hast";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import {
  academyGuideProseClassName,
  academyProseClassName,
} from "@/components/academy/academyProseClassName";
import { LessonHtmlEmbed } from "@/components/academy/LessonHtmlEmbed";
import { LESSON_EMBED_LANG } from "@/lib/academy/lessonHtmlEmbed";
import { headingLabel, headingSlug } from "@/lib/academy/lessonGuideOutline";
import { lessonMarkdownSanitizeSchema } from "@/lib/academy/lessonMarkdownSanitizeSchema";
import { normalizeLessonMarkdown } from "@/lib/academy/normalizeLessonMarkdown";

const EMBED_CODE_CLASS = `language-${LESSON_EMBED_LANG}`;

/** Pulls the raw HTML out of a ```html-embed fenced code block, if this <pre> is one. */
function embedHtmlFromPreNode(node: Element | undefined): string | null {
  const codeNode = node?.children?.find(
    (child): child is Element => child.type === "element" && child.tagName === "code"
  );
  if (!codeNode) return null;

  const className = codeNode.properties?.className;
  const classes = Array.isArray(className)
    ? className.map(String)
    : typeof className === "string"
      ? [className]
      : [];
  if (!classes.includes(EMBED_CODE_CLASS)) return null;

  return collectText(codeNode.children);
}

function collectText(children: ElementContent[] | undefined): string {
  if (!children) return "";
  return children
    .map((child) => {
      if (child.type === "text") return child.value;
      if (child.type === "element") return collectText(child.children);
      return "";
    })
    .join("");
}

type PreProps = ComponentPropsWithoutRef<"pre"> & { node?: Element };
type HeadingProps = ComponentPropsWithoutRef<"h2"> & { node?: Element };

export function AcademyMarkdown({
  markdown,
  variant = "default",
}: {
  markdown: string;
  /** `guide` sizes the type for long-form reading and anchors its headings. */
  variant?: "default" | "guide";
}) {
  if (!markdown.trim()) return null;
  const normalized = normalizeLessonMarkdown(markdown);
  const guide = variant === "guide";

  const heading =
    (Tag: "h1" | "h2" | "h3") =>
    ({ node, children, ...rest }: HeadingProps) => {
      const id = guide
        ? headingSlug(headingLabel(collectText(node?.children)))
        : undefined;
      return (
        <Tag id={id} {...rest}>
          {children}
        </Tag>
      );
    };

  return (
    <div className={guide ? academyGuideProseClassName : academyProseClassName}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, lessonMarkdownSanitizeSchema]]}
        components={{
          pre({ node, children, ...rest }: PreProps) {
            const embedHtml = embedHtmlFromPreNode(node);
            if (embedHtml !== null) {
              return <LessonHtmlEmbed html={embedHtml} />;
            }
            return <pre {...rest}>{children}</pre>;
          },
          h1: heading("h1"),
          h2: heading("h2"),
          h3: heading("h3"),
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
