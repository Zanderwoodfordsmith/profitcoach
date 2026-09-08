"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { BossWorkshopChromeContext } from "@/contexts/BossWorkshopChromeContext";
import { DashboardChromeProvider } from "@/contexts/DashboardChromeContext";
import { supabaseClient } from "@/lib/supabaseClient";
import { CoachAiPanel } from "@/components/profitCoachAi/CoachAiPanel";
import { UsageTracker } from "@/components/analytics/UsageTracker";
import { BossProNavToggle } from "@/components/layout/BossProNavToggle";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardChromeFallback } from "@/components/layout/DashboardChromeFallback";
import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { SalesNavImportToast } from "@/components/leadFinder/SalesNavImportToast";
import { isBossWorkshopPath } from "@/lib/isBossWorkshopPath";
import { isPlaybooksReaderPath } from "@/lib/isPlaybooksReaderPath";
import { useRequireSupabaseSession } from "@/hooks/useRequireSupabaseSession";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const authReady = useRequireSupabaseSession();
  const { clearImpersonation, clearContactImpersonation } = useImpersonation();
  const [signingOut, setSigningOut] = useState(false);
  const bossWorkshopPage = isBossWorkshopPath(pathname);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (isBossWorkshopPath(pathname)) {
      setSidebarOpen(false);
    }
  }, [pathname]);

  const playbooksReader = isPlaybooksReaderPath(pathname);
  const conversationsPage = pathname === "/admin/conversations";
  const supportInboxPage = pathname === "/admin/support";
  const fullHeightInboxPage = conversationsPage || supportInboxPage;
  const sidebarExpanded = sidebarOpen && !playbooksReader;
  const sidebarMounted = !playbooksReader;
  const sidebarCollapsed = sidebarMounted && !sidebarOpen;

  /**
   * Docked AI panel — pushes the canvas from the right (ClickUp-style).
   * Admin-only: the admin layout itself has no role guard (only a session
   * check), so gate the AI explicitly in case a coach opens an /admin URL.
   */
  const { profile: viewerProfile, profileLoading } = useDashboardProfile();
  const aiPanelAvailable = viewerProfile?.role === "admin";
  /** Sparkles shows while role loads so the header doesn't feel empty on first paint. */
  const showAiSparkles = profileLoading || aiPanelAvailable;
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiPanelFullscreen, setAiPanelFullscreen] = useState(false);
  useEffect(() => {
    setAiPanelOpen(window.localStorage.getItem("coach-ai-panel-open") === "1");
  }, []);
  const setAiOpen = (open: boolean) => {
    setAiPanelOpen(open);
    if (!open) setAiPanelFullscreen(false);
    try {
      window.localStorage.setItem("coach-ai-panel-open", open ? "1" : "0");
    } catch {
      /* noop */
    }
  };
  const aiPanelDocked = aiPanelAvailable && aiPanelOpen && !aiPanelFullscreen;

  const shellPadClass = `${
    playbooksReader ? "pl-0" : sidebarExpanded ? "md:pl-56" : "md:pl-14"
  } ${aiPanelDocked ? "md:pr-[28rem]" : ""} transition-[padding] duration-200`;
  const isMinimalWorkshopChrome = bossWorkshopPage && sidebarCollapsed;
  const [workshopTopRightSlot, setWorkshopTopRightSlot] = useState<React.ReactNode>(null);
  const chromeEnabled = !playbooksReader && !isMinimalWorkshopChrome;

  const bossWorkshopChromeValue = useMemo(
    () => ({
      isMinimalWorkshopChrome,
      setWorkshopTopRight: setWorkshopTopRightSlot,
    }),
    [isMinimalWorkshopChrome]
  );

  if (!authReady) {
    return (
      <div className="app-canvas-bg flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-slate-600">Loading…</p>
      </div>
    );
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      clearImpersonation();
      clearContactImpersonation();
      await supabaseClient.auth.signOut();
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div
      data-ai-docked={aiPanelDocked ? true : undefined}
      className={`group/appshell ${
        fullHeightInboxPage ? "h-dvh overflow-hidden" : "min-h-screen"
      } ${shellPadClass} text-slate-900 ${
        playbooksReader ? "bg-[#fbfbfa]" : "app-canvas-bg"
      }`}
    >
      <UsageTracker />
      <DashboardChromeProvider
        variant="admin"
        signingOut={signingOut}
        onSignOut={handleSignOut}
        showAi={showAiSparkles}
        aiPanelOpen={aiPanelOpen}
        profileLoading={profileLoading}
        onToggleAi={() => setAiOpen(!aiPanelOpen)}
        chromeEnabled={chromeEnabled}
      >
        <BossWorkshopChromeContext.Provider value={bossWorkshopChromeValue}>
          {playbooksReader ? null : isMinimalWorkshopChrome && workshopTopRightSlot ? (
            <div className="fixed right-3 top-3 z-[100] flex max-w-[min(22rem,calc(100vw-3rem))] flex-col items-end gap-2 sm:right-6">
              <div className="w-full min-w-0 text-right">{workshopTopRightSlot}</div>
            </div>
          ) : null}
          {!playbooksReader ? (
            <BossProNavToggle
              expanded={sidebarExpanded}
              onToggle={() => setSidebarOpen((o) => !o)}
            />
          ) : null}
          {sidebarMounted ? (
            <DashboardSidebar
              variant="admin"
              collapsed={sidebarCollapsed}
              signingOut={signingOut}
              onSignOut={handleSignOut}
            />
          ) : null}
          <main
            className={`min-w-0 w-full pt-0 ${
              fullHeightInboxPage
                ? "h-dvh overflow-hidden px-4 pb-0 md:px-[60px]"
                : playbooksReader
                ? "min-h-screen px-0 pb-10"
                : `min-h-screen px-4 md:px-[60px] ${
                    sidebarExpanded
                      ? "pb-6 max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
                      : "pb-6"
                  }`
            }`}
          >
            <div
              className={`flex w-full min-w-0 flex-col ${
                fullHeightInboxPage
                  ? "h-full min-h-0 gap-0"
                  : playbooksReader
                    ? "gap-0"
                    : "gap-4"
              }`}
            >
              {chromeEnabled ? <DashboardChromeFallback /> : null}
              {/*
                Full-height inboxes need a flex-1 / min-h-0 chain so the list
                scrolls inside the viewport. Do not put overflow-hidden here —
                StickyPageHeader bleeds with negative horizontal margins into
                main's padding, and overflow on this wrapper clips that bar.
              */}
              {fullHeightInboxPage ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  {children}
                </div>
              ) : (
                children
              )}
            </div>
          </main>
        </BossWorkshopChromeContext.Provider>
      </DashboardChromeProvider>
      <SalesNavImportToast />
      {aiPanelAvailable && aiPanelOpen ? (
        <CoachAiPanel
          onClose={() => setAiOpen(false)}
          fullscreen={aiPanelFullscreen}
          onToggleFullscreen={() => setAiPanelFullscreen((f) => !f)}
          createHubHref="/admin/message-generator"
          sidebarVisible={sidebarMounted}
          sidebarCollapsed={sidebarCollapsed}
        />
      ) : null}
    </div>
  );
}
