"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { academyProseClassName } from "@/components/academy/academyProseClassName";

export function AcademyMarkdown({ markdown }: { markdown: string }) {
  if (!markdown.trim()) return null;
  return (
    <div className={academyProseClassName}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
