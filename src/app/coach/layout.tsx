"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { supabaseClient } from "@/lib/supabaseClient";
import { Sparkles } from "lucide-react";
import { UsageTracker } from "@/components/analytics/UsageTracker";
import { BossProNavToggle } from "@/components/layout/BossProNavToggle";
import { AdminCoachImpersonationSwitcher } from "@/components/layout/AdminCoachImpersonationSwitcher";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardTopActions } from "@/components/layout/DashboardTopActions";
import { MobileDashboardTopBar } from "@/components/layout/MobileDashboardTopBar";
import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { CoachAiPanel } from "@/components/profitCoachAi/CoachAiPanel";
import { SalesNavImportToast } from "@/components/leadFinder/SalesNavImportToast";
import { BossWorkshopChromeContext } from "@/contexts/BossWorkshopChromeContext";
import { useCoachAccess } from "@/hooks/useCoachAccess";
import { CoachRouteAccessGuard } from "@/components/coach/CoachRouteAccessGuard";
import { isBossWorkshopPath } from "@/lib/isBossWorkshopPath";
import { isPlaybooksReaderPath } from "@/lib/isPlaybooksReaderPath";
import { useRequireSupabaseSession } from "@/hooks/useRequireSupabaseSession";

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
  const [coachName, setCoachName] = useState<string | null>(null);
  const [coachAvatarUrl, setCoachAvatarUrl] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!impersonatingCoachId) return;
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (cancelled || !user) return;
      const res = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const body = (await res.json().catch(() => ({}))) as { role?: string };
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
    let cancelled = false;
    async function loadCoachName() {
      const res = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: impersonatingCoachId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        full_name?: string | null;
        coach_business_name?: string | null;
        avatar_url?: string | null;
      };
      if (!cancelled && data) {
        const name =
          data.full_name ??
          data.coach_business_name ??
          "Coach";
        setCoachName(name);
        setCoachAvatarUrl(data.avatar_url ?? null);
      } else if (!cancelled) {
        setCoachName("Coach");
        setCoachAvatarUrl(null);
      }
    }
    loadCoachName();
    return () => {
      cancelled = true;
    };
  }, [impersonatingCoachId]);

  /**
   * Compass + Actions are coach-accessible (Classroom tabs).
   * Scorecard stays admin-only. Ladder redirects live on the page.
   * Admins without impersonation use /admin/signature*.
   */
  useEffect(() => {
    if (!pathname?.startsWith("/coach/signature")) return;
    if (impersonatingCoachId) return;
    let cancelled = false;
    async function gateSignature() {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (cancelled || !user) return;
      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as {
        role?: string;
      };
      if (cancelled) return;
      if (roleBody.role === "admin") {
        if (pathname.startsWith("/coach/signature/scorecard")) {
          router.replace("/admin/signature/scorecard");
        } else if (pathname.startsWith("/coach/signature/actions")) {
          router.replace("/admin/signature/actions");
        } else if (pathname.startsWith("/coach/signature/ladder")) {
          router.replace("/admin/account?tab=ladder");
        } else {
          router.replace("/admin/signature");
        }
        return;
      }
      if (pathname.startsWith("/coach/signature/scorecard")) {
        router.replace("/coach/academy/classroom");
      }
    }
    void gateSignature();
    return () => {
      cancelled = true;
    };
  }, [pathname, impersonatingCoachId, router]);

  function handleExit() {
    clearImpersonation();
    router.push("/admin");
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
  const fullBleed = isPlaybooksReaderPath(pathname) || membershipPage;
  const playbooksReader = fullBleed;
  const sidebarVisible = sidebarOpen && !playbooksReader;

  /**
   * Docked AI panel (admin preview). ClickUp-style: pushes the canvas from
   * the right instead of overlaying it; can expand to full screen.
   */
  const { profile: viewerProfile, profileLoading } = useDashboardProfile();
  /** Admin-only docked panel — hidden while impersonating so "View as coach" matches members. */
  const aiPanelAvailable =
    viewerProfile?.role === "admin" && !impersonatingCoachId;
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
  const aiPanelDocked = aiPanelAvailable && aiPanelOpen && !aiPanelFullscreen;

  const shellPadClass = `${sidebarVisible ? "md:pl-56" : "pl-0"} ${
    aiPanelDocked ? "md:pr-[28rem]" : ""
  } transition-[padding] duration-200`;
  const topClusterMaxW = sidebarVisible
    ? "max-md:max-w-[calc(100vw-1.5rem)] md:max-w-[calc(100vw-15rem)]"
    : "max-w-[calc(100vw-1.5rem)]";
  const isMinimalWorkshopChrome = bossWorkshopPage && !sidebarVisible;
  const [workshopTopRightSlot, setWorkshopTopRightSlot] = useState<React.ReactNode>(null);
  const { access, hasFeature } = useCoachAccess(impersonatingCoachId);

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
      data-ai-docked={aiPanelDocked ? true : undefined}
      className={`group/appshell min-h-screen overflow-x-hidden ${shellPadClass} text-slate-900 ${
        membershipPage ? "bg-[#f5f8fc]" : playbooksReader ? "bg-[#fbfbfa]" : "app-canvas-bg"
      }`}
    >
      <UsageTracker />
      <BossWorkshopChromeContext.Provider value={bossWorkshopChromeValue}>
        {playbooksReader ? (
          isImpersonatingCoach ? (
            <div className="fixed right-3 top-3 z-[100] flex max-w-[min(22rem,calc(100vw-3rem))] flex-col items-end gap-2 sm:right-6">
              <div
                className="flex max-w-full flex-wrap items-center justify-end gap-1.5 rounded-lg border border-amber-300/90 bg-amber-100 py-1 pl-2 pr-1 shadow-md sm:gap-2 sm:py-1 sm:pl-2.5 sm:pr-1.5"
                role="status"
                aria-label={`Viewing coach dashboard as ${coachName ?? "Coach"}`}
              >
                <span className="shrink-0 rounded bg-amber-200/90 px-1 py-px text-[9px] font-bold uppercase tracking-wider text-amber-950 sm:text-[10px]">
                  Admin
                </span>
                <AdminCoachImpersonationSwitcher
                  coachName={coachName}
                  accessTier={access.tier}
                  enforcementEnabled={access.enforcementEnabled}
                />
                <button
                  type="button"
                  onClick={handleExit}
                  className="shrink-0 rounded-md bg-amber-300/80 px-2 py-0.5 text-[10px] font-semibold text-amber-950 hover:bg-amber-400/90 sm:text-xs"
                >
                  Exit
                </button>
              </div>
            </div>
          ) : null
        ) : isMinimalWorkshopChrome ? (
          workshopTopRightSlot || isImpersonatingCoach ? (
            <div className="fixed right-3 top-3 z-[100] flex max-w-[min(22rem,calc(100vw-3rem))] flex-col items-end gap-2 sm:right-6">
              {workshopTopRightSlot ? (
                <div className="w-full min-w-0 text-right">{workshopTopRightSlot}</div>
              ) : null}
              {isImpersonatingCoach ? (
                <div
                  className="flex max-w-full flex-wrap items-center justify-end gap-1.5 rounded-lg border border-amber-300/90 bg-amber-100 py-1 pl-2 pr-1 shadow-md sm:gap-2 sm:py-1 sm:pl-2.5 sm:pr-1.5"
                  role="status"
                  aria-label={`Viewing coach dashboard as ${coachName ?? "Coach"}`}
                >
                  <span className="shrink-0 rounded bg-amber-200/90 px-1 py-px text-[9px] font-bold uppercase tracking-wider text-amber-950 sm:text-[10px]">
                    Admin
                  </span>
                  <AdminCoachImpersonationSwitcher
                  coachName={coachName}
                  accessTier={access.tier}
                  enforcementEnabled={access.enforcementEnabled}
                />
                  <button
                    type="button"
                    onClick={handleExit}
                    className="shrink-0 rounded-md bg-amber-300/80 px-2 py-0.5 text-[10px] font-semibold text-amber-950 hover:bg-amber-400/90 sm:text-xs"
                  >
                    Exit
                  </button>
                </div>
              ) : null}
            </div>
          ) : null
        ) : (
          <>
            <MobileDashboardTopBar
              variant="coach"
              signingOut={signingOut}
              onSignOut={handleSignOut}
              avatarOverride={
                isImpersonatingCoach
                  ? {
                      name: coachName ?? "Coach",
                      avatarUrl: coachAvatarUrl,
                    }
                  : null
              }
            />
            <div
              className={`fixed right-3 top-3 z-[100] hidden flex-col items-end gap-2 sm:right-6 md:flex ${topClusterMaxW}`}
            >
              <div className="flex max-w-full items-center justify-end gap-3">
                {bossWorkshopPage && workshopTopRightSlot ? (
                  <div className="min-w-0 shrink text-right">{workshopTopRightSlot}</div>
                ) : null}
                <DashboardTopActions
                  variant="coach"
                  signingOut={signingOut}
                  onSignOut={handleSignOut}
                  notificationsOnly
                  avatarOverride={
                    isImpersonatingCoach
                      ? {
                          name: coachName ?? "Coach",
                          avatarUrl: coachAvatarUrl,
                        }
                      : null
                  }
                  className="!static !right-auto !top-auto z-0 shrink-0"
                />
                {showAiSparkles ? (
                  <button
                    type="button"
                    aria-label={
                      aiPanelOpen ? "Close AI panel" : "Open AI panel"
                    }
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
            {isImpersonatingCoach ? (
              <div
                className="flex items-center gap-1.5 rounded-lg border border-amber-300/90 bg-amber-100 py-1 pl-2 pr-1 shadow-md sm:gap-2 sm:py-1 sm:pl-2.5 sm:pr-1.5"
                role="status"
                aria-label={`Viewing coach dashboard as ${coachName ?? "Coach"}`}
              >
                <span className="shrink-0 rounded bg-amber-200/90 px-1 py-px text-[9px] font-bold uppercase tracking-wider text-amber-950 sm:text-[10px]">
                  Admin
                </span>
                <AdminCoachImpersonationSwitcher
                  coachName={coachName}
                  accessTier={access.tier}
                  enforcementEnabled={access.enforcementEnabled}
                />
                <button
                  type="button"
                  onClick={handleExit}
                  className="shrink-0 rounded-md bg-amber-300/80 px-2 py-0.5 text-[10px] font-semibold text-amber-950 hover:bg-amber-400/90 sm:text-xs"
                >
                  Exit
                </button>
              </div>
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
          variant="coach"
          signingOut={signingOut}
          onSignOut={handleSignOut}
          coachHasFeature={hasFeature}
          membershipTierEnforcementEnabled={access.enforcementEnabled}
          coachAccessTier={access.tier}
          avatarOverride={
            isImpersonatingCoach
              ? {
                  name: coachName ?? "Coach",
                  avatarUrl: coachAvatarUrl,
                }
              : null
          }
        />
      ) : null}
        <main
          className={`min-h-screen min-w-0 w-full pt-0 ${
            membershipPage
              ? "px-0 pb-0"
              : playbooksReader
              ? "px-0 pb-10"
              : `px-4 md:px-[60px] ${
                  sidebarVisible
                    ? "max-md:pt-14 pb-6 max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
                    : isMinimalWorkshopChrome
                      ? "max-md:pt-14 pb-6"
                      : "pb-6"
                }`
          }`}
        >
          <div
            className={`flex w-full min-w-0 flex-col ${
              isSignaturePage ? "max-w-none gap-0" : playbooksReader ? "w-full gap-0" : "gap-4"
            }`}
          >
            <CoachRouteAccessGuard>{children}</CoachRouteAccessGuard>
          </div>
        </main>
      </BossWorkshopChromeContext.Provider>
      <SalesNavImportToast />
      {aiPanelAvailable && aiPanelOpen ? (
        <CoachAiPanel
          onClose={() => setAiOpen(false)}
          fullscreen={aiPanelFullscreen}
          onToggleFullscreen={() => setAiPanelFullscreen((f) => !f)}
          createHubHref="/coach/message-generator"
          sidebarVisible={sidebarVisible}
        />
      ) : null}
    </div>
  );
}
