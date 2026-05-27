"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { supabaseClient } from "@/lib/supabaseClient";
import { UsageTracker } from "@/components/analytics/UsageTracker";
import { BossProNavToggle } from "@/components/layout/BossProNavToggle";
import { AdminCoachImpersonationSwitcher } from "@/components/layout/AdminCoachImpersonationSwitcher";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardTopActions } from "@/components/layout/DashboardTopActions";
import { MobileDashboardTopBar } from "@/components/layout/MobileDashboardTopBar";
import { BossWorkshopChromeContext } from "@/contexts/BossWorkshopChromeContext";
import { useCoachClientHubAccess } from "@/hooks/useCoachClientHubAccess";
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

  /** Admins belong on /admin/signature; /coach/signature is for coaches (or admins while impersonating). */
  useEffect(() => {
    if (!pathname?.startsWith("/coach/signature")) return;
    if (impersonatingCoachId) return;
    let cancelled = false;
    async function redirectAdminIfNeeded() {
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
        router.replace("/admin/signature");
      }
    }
    void redirectAdminIfNeeded();
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

  const playbooksReader = isPlaybooksReaderPath(pathname);
  const sidebarVisible = sidebarOpen && !playbooksReader;
  const shellPadClass = sidebarVisible ? "md:pl-64" : "pl-0";
  const topClusterMaxW = sidebarVisible
    ? "max-md:max-w-[calc(100vw-1.5rem)] md:max-w-[calc(100vw-17rem)]"
    : "max-w-[calc(100vw-1.5rem)]";
  const isMinimalWorkshopChrome = bossWorkshopPage && !sidebarVisible;
  const [workshopTopRightSlot, setWorkshopTopRightSlot] = useState<React.ReactNode>(null);
  const { allowed: coachClientHubAllowed } = useCoachClientHubAccess(
    impersonatingCoachId
  );
  const { hasFeature } = useCoachAccess(impersonatingCoachId);

  useEffect(() => {
    if (!isMinimalWorkshopChrome) {
      setWorkshopTopRightSlot(null);
    }
  }, [isMinimalWorkshopChrome]);

  const bossWorkshopChromeValue = useMemo(
    () => ({
      isMinimalWorkshopChrome,
      setWorkshopTopRight: setWorkshopTopRightSlot,
    }),
    [isMinimalWorkshopChrome]
  );

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <p className="text-sm text-slate-600">Loading…</p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen overflow-x-hidden ${shellPadClass} text-slate-900 ${
        playbooksReader ? "bg-[#fbfbfa]" : "bg-slate-100"
      }`}
    >
      <UsageTracker />
      <BossWorkshopChromeContext.Provider value={bossWorkshopChromeValue}>
        {playbooksReader ? (
          isImpersonatingCoach ? (
            <div className="fixed right-3 top-1.5 z-[100] flex max-w-[min(22rem,calc(100vw-3rem))] flex-col items-end gap-2 sm:right-5">
              <div
                className="flex max-w-full flex-wrap items-center justify-end gap-1.5 rounded-lg border border-amber-300/90 bg-amber-100 py-1 pl-2 pr-1 shadow-md sm:gap-2 sm:py-1 sm:pl-2.5 sm:pr-1.5"
                role="status"
                aria-label={`Viewing coach dashboard as ${coachName ?? "Coach"}`}
              >
                <span className="shrink-0 rounded bg-amber-200/90 px-1 py-px text-[9px] font-bold uppercase tracking-wider text-amber-950 sm:text-[10px]">
                  Admin
                </span>
                <AdminCoachImpersonationSwitcher coachName={coachName} />
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
          <div className="fixed right-3 top-1.5 z-[100] flex max-w-[min(22rem,calc(100vw-3rem))] flex-col items-end gap-2 sm:right-5">
            <div className="w-full min-w-0 text-right">{workshopTopRightSlot}</div>
            {isImpersonatingCoach ? (
              <div
                className="flex max-w-full flex-wrap items-center justify-end gap-1.5 rounded-lg border border-amber-300/90 bg-amber-100 py-1 pl-2 pr-1 shadow-md sm:gap-2 sm:py-1 sm:pl-2.5 sm:pr-1.5"
                role="status"
                aria-label={`Viewing coach dashboard as ${coachName ?? "Coach"}`}
              >
                <span className="shrink-0 rounded bg-amber-200/90 px-1 py-px text-[9px] font-bold uppercase tracking-wider text-amber-950 sm:text-[10px]">
                  Admin
                </span>
                <AdminCoachImpersonationSwitcher coachName={coachName} />
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
              className={`fixed right-3 top-1.5 z-[100] hidden flex-col items-end gap-2 sm:right-5 md:flex ${topClusterMaxW}`}
            >
              <DashboardTopActions
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
                className="!static !right-auto !top-auto z-0"
              />
            {isImpersonatingCoach ? (
              <div
                className="flex items-center gap-1.5 rounded-lg border border-amber-300/90 bg-amber-100 py-1 pl-2 pr-1 shadow-md sm:gap-2 sm:py-1 sm:pl-2.5 sm:pr-1.5"
                role="status"
                aria-label={`Viewing coach dashboard as ${coachName ?? "Coach"}`}
              >
                <span className="shrink-0 rounded bg-amber-200/90 px-1 py-px text-[9px] font-bold uppercase tracking-wider text-amber-950 sm:text-[10px]">
                  Admin
                </span>
                <AdminCoachImpersonationSwitcher coachName={coachName} />
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
          showCoachDeliveryNav={coachClientHubAllowed}
          coachHasFeature={hasFeature}
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
            playbooksReader
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
    </div>
  );
}
