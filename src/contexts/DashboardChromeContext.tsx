"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type DashboardChromeAvatarOverride = {
  name: string;
  avatarUrl: string | null;
} | null;

export type DashboardChromeContextValue = {
  variant: "coach" | "admin";
  signingOut: boolean;
  onSignOut: () => void | Promise<void>;
  avatarOverride?: DashboardChromeAvatarOverride;
  showAi: boolean;
  aiPanelOpen: boolean;
  profileLoading: boolean;
  onToggleAi: () => void;
  /** Opens Ava full screen (the sidebar's Ava). Falls back to onToggleAi. */
  onOpenAiFull?: () => void;
  /**
   * Ava sits in the middle of the phone bottom bar (admins and agent-enabled
   * coaches). Other coaches only reach her from the top bar on Blueprint pages.
   */
  avaInMobileNav: boolean;
  /** Phone account sheet (Settings, Support, Log out), opened from the top-bar photo. */
  accountSheetOpen: boolean;
  setAccountSheetOpen: (open: boolean) => void;
  /** False for playbooks reader / minimal workshop — no search/notif/AI. */
  chromeEnabled: boolean;
  /** True while a StickyPageHeader (or chrome-only bar) is hosting the actions. */
  chromeHosted: boolean;
  claimChromeHost: () => () => void;
};

const DashboardChromeContext =
  createContext<DashboardChromeContextValue | null>(null);

export function DashboardChromeProvider({
  variant,
  signingOut,
  onSignOut,
  avatarOverride = null,
  showAi,
  aiPanelOpen,
  profileLoading,
  onToggleAi,
  onOpenAiFull,
  avaInMobileNav = false,
  chromeEnabled,
  children,
}: {
  variant: "coach" | "admin";
  signingOut: boolean;
  onSignOut: () => void | Promise<void>;
  avatarOverride?: DashboardChromeAvatarOverride;
  showAi: boolean;
  aiPanelOpen: boolean;
  profileLoading: boolean;
  onToggleAi: () => void;
  onOpenAiFull?: () => void;
  avaInMobileNav?: boolean;
  chromeEnabled: boolean;
  children: ReactNode;
}) {
  const [hostCount, setHostCount] = useState(0);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);

  const claimChromeHost = useCallback(() => {
    setHostCount((n) => n + 1);
    return () => setHostCount((n) => Math.max(0, n - 1));
  }, []);

  const value = useMemo(
    () => ({
      variant,
      signingOut,
      onSignOut,
      avatarOverride,
      showAi,
      aiPanelOpen,
      profileLoading,
      onToggleAi,
      onOpenAiFull,
      avaInMobileNav,
      accountSheetOpen,
      setAccountSheetOpen,
      chromeEnabled,
      chromeHosted: hostCount > 0,
      claimChromeHost,
    }),
    [
      variant,
      signingOut,
      onSignOut,
      avatarOverride,
      showAi,
      aiPanelOpen,
      profileLoading,
      onToggleAi,
      onOpenAiFull,
      avaInMobileNav,
      accountSheetOpen,
      chromeEnabled,
      hostCount,
      claimChromeHost,
    ]
  );

  return (
    <DashboardChromeContext.Provider value={value}>
      {children}
    </DashboardChromeContext.Provider>
  );
}

export function useDashboardChrome() {
  return useContext(DashboardChromeContext);
}
