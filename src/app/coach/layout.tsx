"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { supabaseClient } from "@/lib/supabaseClient";
import { AdminCoachImpersonationSwitcher } from "@/components/layout/AdminCoachImpersonationSwitcher";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardTopActions } from "@/components/layout/DashboardTopActions";

export default function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    impersonatingCoachId,
    clearImpersonation,
    clearContactImpersonation,
  } = useImpersonation();
  const [coachName, setCoachName] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!impersonatingCoachId) {
      setCoachName(null);
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
      };
      if (!cancelled && data) {
        const name =
          data.full_name ??
          data.coach_business_name ??
          "Coach";
        setCoachName(name);
      } else if (!cancelled) {
        setCoachName("Coach");
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

  return (
    <div className="min-h-screen bg-slate-100 pl-64 text-slate-900">
      {isImpersonatingCoach && (
        <div
          className="fixed right-3 top-3 z-[100] flex max-w-[calc(100vw-17rem)] items-center gap-1.5 rounded-lg border border-amber-300/90 bg-amber-100 py-1 pl-2 pr-1 shadow-md sm:right-5 sm:gap-2 sm:py-1 sm:pl-2.5 sm:pr-1.5"
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
      )}
      <DashboardSidebar
        variant="coach"
      />
      <DashboardTopActions
        variant="coach"
        signingOut={signingOut}
        onSignOut={handleSignOut}
        className={isImpersonatingCoach ? "top-16" : "top-3"}
      />
      <main className="min-h-screen min-w-0 w-full px-6 pb-6 pt-0">
        <div
          className={`flex w-full min-w-0 flex-col ${isSignaturePage ? "max-w-none gap-0" : "gap-4"}`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
