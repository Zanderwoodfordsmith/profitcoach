"use client";

import { Sparkles } from "lucide-react";
import { useDashboardChrome } from "@/contexts/DashboardChromeContext";
import { DashboardTopActions } from "./DashboardTopActions";
import { SearchTopBarTrigger } from "@/components/search/SearchTopBarTrigger";

type DashboardChromeActionsProps = {
  className?: string;
  /** Prefer expand-in-place; on very narrow mobile, jump to the search page. */
  compactSearchNavigate?: boolean;
};

/**
 * Search + notifications (+ AI when available). Owned by the sticky page header
 * so dashboard chrome is one bar; titles/tabs are the only per-page change.
 */
export function DashboardChromeActions({
  className = "",
  compactSearchNavigate = false,
}: DashboardChromeActionsProps) {
  const chrome = useDashboardChrome();
  if (!chrome?.chromeEnabled) return null;

  return (
    <div
      className={`flex max-w-full items-center justify-end gap-1 sm:gap-2 ${className}`}
    >
      <SearchTopBarTrigger
        className="shrink-0"
        compactNavigate={compactSearchNavigate}
      />
      <DashboardTopActions
        variant={chrome.variant}
        signingOut={chrome.signingOut}
        onSignOut={chrome.onSignOut}
        avatarOverride={chrome.avatarOverride}
        notificationsOnly
        embedded
        className="shrink-0"
      />
      {chrome.showAi ? (
        <button
          type="button"
          aria-label={chrome.aiPanelOpen ? "Close AI panel" : "Open AI panel"}
          title="Profit Coach AI"
          disabled={chrome.profileLoading}
          onClick={chrome.onToggleAi}
          className={`rounded-full p-2 transition disabled:cursor-wait disabled:opacity-60 ${
            chrome.aiPanelOpen
              ? "bg-sky-100 text-sky-700 hover:bg-sky-200"
              : "bg-transparent text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Sparkles className="h-6 w-6" />
        </button>
      ) : null}
    </div>
  );
}
