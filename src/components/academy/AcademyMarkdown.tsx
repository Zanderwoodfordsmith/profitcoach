"use client";

import ReactMarkdown from "react-markdown";

export function AcademyMarkdown({ markdown }: { markdown: string }) {
  if (!markdown.trim()) return null;
  return (
    <div className="max-w-none text-base leading-relaxed text-slate-700 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-1 [&_p]:my-3 [&_strong]:font-semibold [&_a]:text-sky-700 [&_a]:underline">
      <ReactMarkdown>{markdown}</ReactMarkdown>
    </div>
  );
}
