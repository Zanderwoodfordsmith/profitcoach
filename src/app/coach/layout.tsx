"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { supabaseClient } from "@/lib/supabaseClient";
import { UsageTracker } from "@/components/analytics/UsageTracker";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { BossProNavToggle } from "@/components/layout/BossProNavToggle";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardChromeFallback } from "@/components/layout/DashboardChromeFallback";
import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { AvaDock } from "@/components/ava/AvaDock";
import { useAvaPageHost } from "@/components/ava/avaPageHost";
import { useCoachAgentAccess } from "@/components/agent/useAgentAccess";
import { SalesNavImportToast } from "@/components/leadFinder/SalesNavImportToast";
import { BossWorkshopChromeContext } from "@/contexts/BossWorkshopChromeContext";
import { DashboardChromeProvider } from "@/contexts/DashboardChromeContext";
import { useCoachAccess } from "@/hooks/useCoachAccess";
import { CoachRouteAccessGuard } from "@/components/coach/CoachRouteAccessGuard";
import { isBossWorkshopPath } from "@/lib/isBossWorkshopPath";
import { isPlaybooksReaderPath } from "@/lib/isPlaybooksReaderPath";
import { useRequireSupabaseSession } from "@/hooks/useRequireSupabaseSession";
import { GetClientsHubWarmup } from "@/components/layout/GetClientsHubWarmup";
import {
  coachAccountLabel,
  rememberCoachAccountLabel,
} from "@/lib/admin/coachDirectoryClient";
import { fetchProfileRole } from "@/lib/getClients/cachedProfileRole";
import { getSessionUser } from "@/lib/supabaseAccessToken";

export default function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const authReady = useRequireSupabaseSession();
  const {
    impersonatingCoachId,
    clearImpersonation,
    clearContactImpersonation,
  } = useImpersonation();
  const [coachName, setCoachName] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [coachAvatarUrl, setCoachAvatarUrl] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!impersonatingCoachId) return;
    let cancelled = false;
    void (async () => {
      const user = await getSessionUser();
      if (cancelled || !user) return;
      const body = (await fetchProfileRole(user.id)) as { role?: string };
      if (cancelled) return;
      if (body.role !== "admin") {
        clearImpersonation();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearImpersonation, impersonatingCoachId]);

  useEffect(() => {
    if (!impersonatingCoachId) {
      setCoachName(null);
      setCoachAvatarUrl(null);
      return;
    }
    const coachId = impersonatingCoachId;
    let cancelled = false;
    async function loadCoachName() {
      const data = (await fetchProfileRole(coachId)) as {
        full_name?: string | null;
        coach_business_name?: string | null;
        avatar_url?: string | null;
      };
      if (!cancelled && data) {
        const name =
          data.full_name?.trim() || data.coach_business_name?.trim() || "";
        if (name) {
          if (!coachAccountLabel(coachId)) {
            rememberCoachAccountLabel(coachId, name);
          }
          setCoachName({ id: coachId, name });
        }
        setCoachAvatarUrl(data.avatar_url ?? null);
      } else if (!cancelled) {
        setCoachAvatarUrl(null);
      }
    }
    loadCoachName();
    return () => {
      cancelled = true;
    };
  }, [impersonatingCoachId]);

  /**
   * Compass and Scorecard are admin-only (Tools & links); coaches go back to
   * Classroom. Ladder redirects live on the page.
   * Admins without impersonation use /admin/signature*.
   */
  useEffect(() => {
    if (!pathname?.startsWith("/coach/signature")) return;
    if (impersonatingCoachId) return;
    let cancelled = false;
    async function gateSignature() {
      const user = await getSessionUser();
      if (cancelled || !user) return;
      const roleBody = (await fetchProfileRole(user.id)) as {
        role?: string;
      };
      if (cancelled) return;
      if (roleBody.role === "admin") {
        if (pathname.startsWith("/coach/signature/scorecard")) {
          router.replace("/admin/signature/scorecard");
        } else if (pathname.startsWith("/coach/signature/ladder")) {
          router.replace("/admin/account?tab=ladder");
        } else {
          router.replace("/admin/signature");
        }
        return;
      }
      if (!pathname.startsWith("/coach/signature/ladder")) {
        router.replace("/coach/academy/classroom");
      }
    }
    void gateSignature();
    return () => {
      cancelled = true;
    };
  }, [pathname, impersonatingCoachId, router]);

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

  const isImpersonatingCoach = Boolean(impersonatingCoachId);
  const isSignaturePage = pathname === "/coach/signature";
  const bossWorkshopPage = isBossWorkshopPath(pathname);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (isBossWorkshopPath(pathname)) {
      setSidebarOpen(false);
    }
  }, [pathname]);

  const membershipPage = pathname === "/coach/membership";
  const conversationsPage = pathname === "/coach/conversations";
  const supportPage = pathname === "/coach/support";
  const prospectsListPage = pathname === "/coach/prospects";
  const campaignsListPage = pathname === "/coach/campaigns";
  const prospectWorkspacePage = pathname.startsWith("/coach/prospects/");
  /** Inbox-style workspaces: panes run to the header and the shell edges. */
  const edgeToEdgeInbox =
    conversationsPage || supportPage || prospectWorkspacePage;
  /** Blueprint scrolls inside the page. The window must not scroll, or the
   * contents column unsticks at the bottom and leaves a white gap. */
  const blueprintPage = pathname.startsWith("/coach/blueprint");
  const fullHeightPage =
    edgeToEdgeInbox || prospectsListPage || campaignsListPage || blueprintPage;
  const fullBleed = isPlaybooksReaderPath(pathname) || membershipPage;
  const playbooksReader = fullBleed;
  const sidebarExpanded = sidebarOpen && !playbooksReader;
  const sidebarMounted = !playbooksReader;
  const sidebarCollapsed = sidebarMounted && !sidebarOpen;

  /**
   * Ava, from the top bar. She floats over the right of the page (the page
   * never moves) and can expand to full screen.
   */
  const { profile: viewerProfile, profileLoading } = useDashboardProfile();
  /** Admin-only docked panel — hidden while impersonating so "View as coach" matches members. */
  const adminAiPanel = viewerProfile?.role === "admin" && !impersonatingCoachId;
  /** Coaches get the panel, Agent only, once an admin switches the agent on for them. */
  const coachAgentPanel = useCoachAgentAccess(viewerProfile?.role === "coach");
  const aiPanelAvailable = adminAiPanel || coachAgentPanel;
  const showAiSparkles = aiPanelAvailable;
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiPanelFullscreen, setAiPanelFullscreen] = useState(false);
  useEffect(() => {
    setAiPanelOpen(window.localStorage.getItem("coach-ai-panel-open") === "1");
  }, []);
  useEffect(() => {
    if (impersonatingCoachId && aiPanelOpen) {
      setAiPanelOpen(false);
      setAiPanelFullscreen(false);
    }
  }, [aiPanelOpen, impersonatingCoachId]);
  const setAiOpen = (open: boolean) => {
    setAiPanelOpen(open);
    if (!open) setAiPanelFullscreen(false);
    try {
      window.localStorage.setItem("coach-ai-panel-open", open ? "1" : "0");
    } catch {
      /* noop */
    }
  };
  /** The Blueprint has Ava built in: the top-bar button opens that one instead. */
  const avaPageHost = useAvaPageHost();

  const shellPadClass = `${
    playbooksReader ? "pl-0" : sidebarExpanded ? "md:pl-56" : "md:pl-14"
  } transition-[padding] duration-200`;
  const isMinimalWorkshopChrome = bossWorkshopPage && sidebarCollapsed;
  const [workshopTopRightSlot, setWorkshopTopRightSlot] = useState<React.ReactNode>(null);
  const { access, hasFeature } = useCoachAccess(impersonatingCoachId);
  const chromeEnabled = !playbooksReader && !isMinimalWorkshopChrome;
  const fetchedName =
    coachName?.id === impersonatingCoachId ? coachName.name : null;
  const accountName = impersonatingCoachId
    ? coachAccountLabel(impersonatingCoachId) || fetchedName
    : null;
  const avatarOverride = isImpersonatingCoach
    ? {
        name: accountName || "Loading...",
        avatarUrl: coachAvatarUrl,
      }
    : null;

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

  return (
    <div
      className={`group/appshell ${
        fullHeightPage ? "h-dvh overflow-hidden" : "min-h-screen"
      } ${shellPadClass} text-slate-900 ${
        membershipPage ? "bg-[#f5f8fc]" : playbooksReader ? "bg-[#fbfbfa]" : "app-canvas-bg"
      }`}
    >
      <UsageTracker />
      <GetClientsHubWarmup />
      <DashboardChromeProvider
        variant="coach"
        signingOut={signingOut}
        onSignOut={handleSignOut}
        avatarOverride={avatarOverride}
        showAi={showAiSparkles || Boolean(avaPageHost)}
        aiPanelOpen={avaPageHost ? avaPageHost.open : aiPanelOpen}
        profileLoading={profileLoading}
        onToggleAi={avaPageHost ? avaPageHost.toggle : () => setAiOpen(!aiPanelOpen)}
        chromeEnabled={chromeEnabled}
      >
      <SearchOverlay />
      <BossWorkshopChromeContext.Provider value={bossWorkshopChromeValue}>
        {!playbooksReader && isMinimalWorkshopChrome && workshopTopRightSlot ? (
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
          variant="coach"
          collapsed={sidebarCollapsed}
          signingOut={signingOut}
          onSignOut={handleSignOut}
          coachHasFeature={hasFeature}
          membershipTierEnforcementEnabled={access.enforcementEnabled}
          coachAccessTier={access.tier}
          avatarOverride={avatarOverride}
        />
      ) : null}
        <main
          className={`min-w-0 w-full pt-0 ${
            edgeToEdgeInbox
              ? `h-dvh overflow-hidden px-0 ${
                  sidebarExpanded
                    ? "pb-0 max-md:pb-[calc(3.5rem+env(safe-area-inset-bottom))]"
                    : "pb-0"
                }`
              : prospectsListPage || campaignsListPage
              ? `h-dvh overflow-hidden px-4 md:px-[60px] ${
                  sidebarExpanded
                    ? "pb-3 max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
                    : "pb-3"
                }`
              : membershipPage
              ? "min-h-screen px-0 pb-0"
              : playbooksReader
              ? "min-h-screen px-0 pb-10"
              : blueprintPage
              ? `h-dvh overflow-hidden px-0 ${
                  sidebarExpanded
                    ? "pb-0 max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
                    : "pb-0"
                }`
              : `min-h-screen px-4 md:px-[60px] ${
                  sidebarExpanded
                    ? "pb-6 max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
                    : "pb-6"
                }`
          }`}
        >
          <div
            className={`flex w-full min-w-0 flex-col ${
              fullHeightPage
                ? "h-full min-h-0 gap-0"
                : isSignaturePage
                  ? "max-w-none gap-0"
                  : playbooksReader
                    ? "w-full gap-0"
                    : "gap-4"
            }`}
          >
            {chromeEnabled ? (
              <DashboardChromeFallback
                bleedInset={
                  membershipPage
                    ? "px-4 md:px-[60px]"
                    : edgeToEdgeInbox || blueprintPage
                      ? "px-4 md:px-6"
                      : undefined
                }
              />
            ) : null}
            {/*
              Full-height routes need a flex-1 / min-h-0 chain so the body
              scrolls inside the viewport. Do not put overflow-hidden here —
              StickyPageHeader bleeds with negative horizontal margins into
              main's padding, and overflow on this wrapper clips that bar.
            */}
            {fullHeightPage ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <CoachRouteAccessGuard>{children}</CoachRouteAccessGuard>
              </div>
            ) : (
              <CoachRouteAccessGuard>{children}</CoachRouteAccessGuard>
            )}
          </div>
        </main>
      </BossWorkshopChromeContext.Provider>
      </DashboardChromeProvider>
      <SalesNavImportToast />
      {aiPanelAvailable && aiPanelOpen && !avaPageHost ? (
        <AvaDock
          onClose={() => setAiOpen(false)}
          fullscreen={aiPanelFullscreen}
          onToggleFullscreen={() => setAiPanelFullscreen((f) => !f)}
        />
      ) : null}
    </div>
  );
}
