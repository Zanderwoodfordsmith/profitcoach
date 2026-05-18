"use client";

import type { ReactNode } from "react";

type HorizontalScrollRegionProps = {
  children: ReactNode;
  className?: string;
  /** Accessible label when horizontal scroll is required */
  ariaLabel?: string;
};

/**
 * Wraps wide content in a horizontal scroll container with edge fade hints.
 */
export function HorizontalScrollRegion({
  children,
  className = "",
  ariaLabel = "Scrollable content",
}: HorizontalScrollRegionProps) {
  return (
    <div className={`relative ${className}`} role="region" aria-label={ariaLabel}>
      <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        {children}
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-slate-50/95 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-slate-50/95 to-transparent"
        aria-hidden
      />
    </div>
  );
}
