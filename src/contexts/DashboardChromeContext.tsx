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
  chromeEnabled: boolean;
  children: ReactNode;
}) {
  const [hostCount, setHostCount] = useState(0);

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
