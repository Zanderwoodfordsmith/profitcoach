"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useCoachClientHubAccess } from "@/hooks/useCoachClientHubAccess";

type Props = {
  children: ReactNode;
};

export function CoachClientHubGate({ children }: Props) {
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const { allowed, loading } = useCoachClientHubAccess(impersonatingCoachId);

  useEffect(() => {
    if (!loading && !allowed) {
      router.replace("/coach/community");
    }
  }, [allowed, loading, router]);

  if (loading) {
    return <p className="text-sm text-slate-600">Loading…</p>;
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
