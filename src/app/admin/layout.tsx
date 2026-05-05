"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { supabaseClient } from "@/lib/supabaseClient";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardTopActions } from "@/components/layout/DashboardTopActions";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { clearImpersonation, clearContactImpersonation } = useImpersonation();
  const [signingOut, setSigningOut] = useState(false);

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
    <div className="min-h-screen bg-slate-100 pl-64 text-slate-900">
      <DashboardSidebar
        variant="admin"
      />
      <DashboardTopActions
        variant="admin"
        signingOut={signingOut}
        onSignOut={handleSignOut}
      />
      <main className="min-h-screen min-w-0 w-full px-6 pb-6 pt-0">
        <div className="flex w-full min-w-0 flex-col gap-4">
          {children}
        </div>
      </main>
    </div>
  );
}
