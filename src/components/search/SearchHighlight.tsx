"use client";

import type { ReactNode } from "react";

const MARK_SCOPE =
  "[&_mark]:rounded-sm [&_mark]:bg-amber-200 [&_mark]:px-0.5 [&_mark]:text-amber-950";

/** Renders a server-sanitized headline that may contain `<mark>` tags. */
export function SearchHighlight({
  html,
  fallback,
  className,
}: {
  html: string | null | undefined;
  fallback?: ReactNode;
  className?: string;
}) {
  const cls = [MARK_SCOPE, className].filter(Boolean).join(" ");
  if (html) {
    return (
      <span
        className={cls}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  if (fallback == null || fallback === "") return null;
  return <span className={className}>{fallback}</span>;
}
