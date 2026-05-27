"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useCoachAccess } from "@/hooks/useCoachAccess";
import type { CoachFeature } from "@/lib/coachAccess/tiers";

type Props = {
  feature: CoachFeature;
  children: ReactNode;
  redirectTo?: string;
};

export function CoachFeatureGate({
  feature,
  children,
  redirectTo = "/coach/community",
}: Props) {
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const { hasFeature, loading } = useCoachAccess(impersonatingCoachId);

  useEffect(() => {
    if (!loading && !hasFeature(feature)) {
      router.replace(redirectTo);
    }
  }, [feature, hasFeature, loading, redirectTo, router]);

  if (loading) {
    return <p className="text-sm text-slate-600">Loading…</p>;
  }

  if (!hasFeature(feature)) {
    return null;
  }

  return <>{children}</>;
}
