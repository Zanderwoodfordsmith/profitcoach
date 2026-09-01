"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { BossWorkshopChromeContext } from "@/contexts/BossWorkshopChromeContext";
import { supabaseClient } from "@/lib/supabaseClient";
import { CoachAiPanel } from "@/components/profitCoachAi/CoachAiPanel";
import { UsageTracker } from "@/components/analytics/UsageTracker";
import { BossProNavToggle } from "@/components/layout/BossProNavToggle";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardTopActions } from "@/components/layout/DashboardTopActions";
import { MobileDashboardTopBar } from "@/components/layout/MobileDashboardTopBar";
import { SearchTopBarTrigger } from "@/components/search/SearchTopBarTrigger";
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
  const sidebarVisible = sidebarOpen && !playbooksReader;

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

  const shellPadClass = `${sidebarVisible ? "md:pl-56" : "pl-0"} ${
    aiPanelDocked ? "md:pr-[28rem]" : ""
  } transition-[padding] duration-200`;
  const isMinimalWorkshopChrome = bossWorkshopPage && !sidebarVisible;
  const [workshopTopRightSlot, setWorkshopTopRightSlot] = useState<React.ReactNode>(null);

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
      className={`group/appshell min-h-screen ${shellPadClass} text-slate-900 ${
        playbooksReader ? "bg-[#fbfbfa]" : "app-canvas-bg"
      }`}
    >
      <UsageTracker />
      <BossWorkshopChromeContext.Provider value={bossWorkshopChromeValue}>
        {playbooksReader ? null : isMinimalWorkshopChrome ? (
          <>
            {workshopTopRightSlot ? (
              <div className="fixed right-3 top-3 z-[100] flex max-w-[min(22rem,calc(100vw-3rem))] flex-col items-end gap-2 sm:right-6">
                <div className="w-full min-w-0 text-right">{workshopTopRightSlot}</div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <MobileDashboardTopBar
              variant="admin"
              signingOut={signingOut}
              onSignOut={handleSignOut}
            />
            <div className="fixed right-6 top-3 z-[100] hidden items-center gap-3 md:flex">
              {bossWorkshopPage && workshopTopRightSlot ? (
                <div className="min-w-0 shrink text-right">{workshopTopRightSlot}</div>
              ) : null}
              <SearchTopBarTrigger className="shrink-0" />
              <DashboardTopActions
                variant="admin"
                signingOut={signingOut}
                onSignOut={handleSignOut}
                notificationsOnly
                className="!static !right-auto !top-auto z-0 shrink-0"
              />
              {showAiSparkles ? (
                <button
                  type="button"
                  aria-label={aiPanelOpen ? "Close AI panel" : "Open AI panel"}
                  title="Profit Coach AI"
                  disabled={profileLoading}
                  onClick={() => setAiOpen(!aiPanelOpen)}
                  className={`rounded-full p-2 transition disabled:cursor-wait disabled:opacity-60 ${
                    aiPanelOpen
                      ? "bg-sky-100 text-sky-700 hover:bg-sky-200"
                      : "bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Sparkles className="h-6 w-6" />
                </button>
              ) : null}
            </div>
          </>
        )}
        {!playbooksReader ? (
          <BossProNavToggle
            sidebarVisible={sidebarVisible}
            onToggle={() => setSidebarOpen((o) => !o)}
          />
        ) : null}
        {sidebarVisible ? (
          <DashboardSidebar
            variant="admin"
            signingOut={signingOut}
            onSignOut={handleSignOut}
          />
        ) : null}
        <main
          className={`min-h-screen min-w-0 w-full pt-0 ${
            playbooksReader
              ? "px-0 pb-10"
              : `px-4 md:px-[60px] ${
                  sidebarVisible
                    ? "max-md:pt-14 pb-6 max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
                    : "pb-6"
                }`
          }`}
        >
          <div
            className={`flex w-full min-w-0 flex-col ${
              playbooksReader ? "gap-0" : "gap-4"
            }`}
          >
            {children}
          </div>
        </main>
      </BossWorkshopChromeContext.Provider>
      <SalesNavImportToast />
      {aiPanelAvailable && aiPanelOpen ? (
        <CoachAiPanel
          onClose={() => setAiOpen(false)}
          fullscreen={aiPanelFullscreen}
          onToggleFullscreen={() => setAiPanelFullscreen((f) => !f)}
          createHubHref="/admin/message-generator"
          sidebarVisible={sidebarVisible}
        />
      ) : null}
    </div>
  );
}
