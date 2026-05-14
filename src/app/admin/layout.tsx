"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { BossWorkshopChromeContext } from "@/contexts/BossWorkshopChromeContext";
import { supabaseClient } from "@/lib/supabaseClient";
import { UsageTracker } from "@/components/analytics/UsageTracker";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardTopActions } from "@/components/layout/DashboardTopActions";
import { isBossWorkshopPath } from "@/lib/isBossWorkshopPath";
import { isPlaybooksReaderPath } from "@/lib/isPlaybooksReaderPath";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { clearImpersonation, clearContactImpersonation } = useImpersonation();
  const [signingOut, setSigningOut] = useState(false);
  const bossWorkshopPage = isBossWorkshopPath(pathname);
  const [bossWorkshopNavOpen, setBossWorkshopNavOpen] = useState(false);

  useEffect(() => {
    if (isBossWorkshopPath(pathname)) {
      setBossWorkshopNavOpen(false);
    }
  }, [pathname]);

  const playbooksReader = isPlaybooksReaderPath(pathname);
  const sidebarVisible =
    (!bossWorkshopPage || bossWorkshopNavOpen) && !playbooksReader;
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
          <div className="fixed right-3 top-3 z-[100] flex max-w-[min(22rem,calc(100vw-3rem))] flex-col items-end gap-2 sm:right-5">
            <div className="w-full min-w-0 text-right">{workshopTopRightSlot}</div>
          </div>
        ) : (
          <DashboardTopActions
            variant="admin"
            signingOut={signingOut}
            onSignOut={handleSignOut}
          />
        )}
        {bossWorkshopPage ? (
          <button
            type="button"
            onClick={() => setBossWorkshopNavOpen((o) => !o)}
            className={`fixed z-[95] flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md hover:bg-slate-50 ${
              sidebarVisible ? "left-3 top-3 md:left-[calc(16rem+0.5rem)]" : "left-3 top-3"
            }`}
            aria-expanded={sidebarVisible}
            aria-label={sidebarVisible ? "Hide main menu" : "Show main menu"}
          >
            {sidebarVisible ? (
              <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
            ) : (
              <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
            )}
          </button>
        ) : null}
        {sidebarVisible ? <DashboardSidebar variant="admin" /> : null}
        <main
          className={`min-h-screen min-w-0 w-full pt-0 ${
            playbooksReader
              ? "px-0 pb-10"
              : `px-[60px] ${
                  sidebarVisible
                    ? "pb-6 max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
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
