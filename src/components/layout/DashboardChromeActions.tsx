"use client";

import { Sparkles } from "lucide-react";

import { AvaHalo } from "@/components/ava/AvaHalo";
import { useDashboardChrome } from "@/contexts/DashboardChromeContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { DashboardTopActions } from "./DashboardTopActions";
import { SearchTopBarTrigger } from "@/components/search/SearchTopBarTrigger";
import { useDashboardProfile } from "./useDashboardProfile";
import { profileInitialsFromName } from "@/lib/communityProfile";

type DashboardChromeActionsProps = {
  className?: string;
};

/**
 * Search + notifications (+ AI when available). Owned by the sticky page header
 * so dashboard chrome is one bar; titles/tabs are the only per-page change.
 * On phones the photo at the end opens the account sheet (Settings, Log out).
 */
export function DashboardChromeActions({
  className = "",
}: DashboardChromeActionsProps) {
  const chrome = useDashboardChrome();
  const { impersonatingCoachId } = useImpersonation();
  const { profile, profileLoading, avatarLabel, avatarImageUrl } = useDashboardProfile(
    chrome?.avatarOverride
  );
  if (!chrome?.chromeEnabled) return null;

  return (
    <div
      className={`flex max-w-full items-center justify-end gap-1 sm:gap-2 ${className}`}
    >
      <SearchTopBarTrigger className="shrink-0" />
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
          aria-label={chrome.aiPanelOpen ? "Close Ava" : "Open Ava"}
          title="Ava"
          disabled={chrome.profileLoading}
          onClick={chrome.onToggleAi}
          className={`grid place-items-center rounded-full p-2 transition disabled:cursor-wait disabled:opacity-60 ${
            chrome.avaInMobileNav ? "max-md:hidden" : ""
          } ${
            chrome.aiPanelOpen
              ? "bg-sky-100 text-sky-700 hover:bg-sky-200"
              : "bg-transparent text-slate-700 hover:bg-slate-50"
          }`}
        >
          {/* The Halo is admin-only until Ava's new look opens to coaches. */}
          {profile?.role === "admin" && !(chrome.variant === "coach" && impersonatingCoachId) ? (
            <AvaHalo size={24} state={chrome.aiPanelOpen ? "listening" : "idle"} />
          ) : (
            <Sparkles className="h-6 w-6" />
          )}
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Account and settings"
        aria-expanded={chrome.accountSheetOpen}
        onClick={() => chrome.setAccountSheetOpen(true)}
        className="ml-0.5 shrink-0 rounded-full md:hidden"
      >
        {avatarImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarImageUrl}
            alt=""
            className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0c5290] text-[11px] font-semibold text-white">
            {profileLoading ? "" : profileInitialsFromName(avatarLabel)}
          </span>
        )}
      </button>
    </div>
  );
}
