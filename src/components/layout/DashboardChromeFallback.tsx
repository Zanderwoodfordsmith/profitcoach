"use client";

import { useDashboardChrome } from "@/contexts/DashboardChromeContext";
import { DashboardChromeActions } from "./DashboardChromeActions";

const DEFAULT_BLEED =
  "-mx-4 px-4 md:-mx-[60px] md:px-[60px] md:group-data-[ai-docked]/appshell:-mr-[calc(60px_+_28rem)] md:group-data-[ai-docked]/appshell:pr-[calc(60px_+_28rem)]";

/**
 * Sticky chrome-only strip for routes that do not mount a StickyPageHeader.
 * Hidden once a header claims the chrome host (same paint frame via useLayoutEffect).
 */
export function DashboardChromeFallback({
  bleedInset = DEFAULT_BLEED,
}: {
  bleedInset?: string | false;
} = {}) {
  const chrome = useDashboardChrome();
  if (!chrome?.chromeEnabled || chrome.chromeHosted) return null;

  const bleed = typeof bleedInset === "string" ? bleedInset : "";

  return (
    <div
      className={`sticky top-0 z-30 border-b border-slate-200/90 bg-white pb-1 pt-2 shadow-sm ${bleed}`}
    >
      <div className="flex justify-end">
        <DashboardChromeActions compactSearchNavigate />
      </div>
    </div>
  );
}
