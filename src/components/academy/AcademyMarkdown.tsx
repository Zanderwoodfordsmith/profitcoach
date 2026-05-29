"use client";

import type { ComponentPropsWithoutRef } from "react";
import type { Element, ElementContent } from "hast";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { academyProseClassName } from "@/components/academy/academyProseClassName";
import { LessonHtmlEmbed } from "@/components/academy/LessonHtmlEmbed";
import { LESSON_EMBED_LANG } from "@/lib/academy/lessonHtmlEmbed";
import { lessonMarkdownSanitizeSchema } from "@/lib/academy/lessonMarkdownSanitizeSchema";

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

export function AcademyMarkdown({ markdown }: { markdown: string }) {
  if (!markdown.trim()) return null;
  return (
    <div className={academyProseClassName}>
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
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
