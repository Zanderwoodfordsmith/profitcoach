"use client";

import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { academyProseClassName } from "@/components/academy/academyProseClassName";
import { lessonMarkdownSanitizeSchema } from "@/lib/academy/lessonMarkdownSanitizeSchema";

export function AcademyMarkdown({ markdown }: { markdown: string }) {
  if (!markdown.trim()) return null;
  return (
    <div className={academyProseClassName}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, lessonMarkdownSanitizeSchema]]}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
