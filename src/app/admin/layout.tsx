"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { BossWorkshopChromeContext } from "@/contexts/BossWorkshopChromeContext";
import { supabaseClient } from "@/lib/supabaseClient";
import { UsageTracker } from "@/components/analytics/UsageTracker";
import { BossProNavToggle } from "@/components/layout/BossProNavToggle";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardTopActions } from "@/components/layout/DashboardTopActions";
import { MobileDashboardTopBar } from "@/components/layout/MobileDashboardTopBar";
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
  const shellPadClass = sidebarVisible ? "md:pl-64" : "pl-0";
  const isMinimalWorkshopChrome = bossWorkshopPage && !sidebarVisible;
  const [workshopTopRightSlot, setWorkshopTopRightSlot] = useState<React.ReactNode>(null);

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
      className={`min-h-screen ${shellPadClass} text-slate-900 ${
        playbooksReader ? "bg-[#fbfbfa]" : "bg-slate-100"
      }`}
    >
      <UsageTracker />
      <BossWorkshopChromeContext.Provider value={bossWorkshopChromeValue}>
        {playbooksReader ? null : isMinimalWorkshopChrome ? (
          <div className="fixed right-3 top-1.5 z-[100] flex max-w-[min(22rem,calc(100vw-3rem))] flex-col items-end gap-2 sm:right-5">
            <div className="w-full min-w-0 text-right">{workshopTopRightSlot}</div>
          </div>
        ) : (
          <>
            <MobileDashboardTopBar
              variant="admin"
              signingOut={signingOut}
              onSignOut={handleSignOut}
            />
            <div className="fixed right-5 top-1.5 z-[90] hidden md:block">
              <DashboardTopActions
                variant="admin"
                signingOut={signingOut}
                onSignOut={handleSignOut}
                className="!static !right-auto !top-auto"
              />
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
    </div>
  );
}
