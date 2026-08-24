"use client";

import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  content: string;
  className?: string;
};

const components: Components = {
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 [&:not(:first-child)]:mt-2">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-slate-900">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => (
    <p className="mb-2 text-base font-semibold text-slate-900">{children}</p>
  ),
  h2: ({ children }) => (
    <p className="mb-2 text-base font-semibold text-slate-900">{children}</p>
  ),
  h3: ({ children }) => (
    <p className="mb-1.5 text-[15px] font-semibold text-slate-900">{children}</p>
  ),
  blockquote: ({ children }) => (
    <blockquote
      className="mb-2 border-l-2 border-slate-200 pl-3 text-slate-700 last:mb-0"
    >
      {children}
    </blockquote>
  ),
  code: ({ className, children }) => {
    const isBlock = Boolean(className?.includes("language-"));
    if (isBlock) {
      return (
        <code className="block overflow-x-auto rounded-lg bg-slate-100 px-3 py-2 font-mono text-[13px] text-slate-800">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px] text-slate-800">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto last:mb-0">{children}</pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-sky-700 underline decoration-sky-300/80 underline-offset-2 hover:text-sky-900"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-3 border-slate-200" />,
};

export function ProfitCoachAiMarkdown({ content, className }: Props) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
