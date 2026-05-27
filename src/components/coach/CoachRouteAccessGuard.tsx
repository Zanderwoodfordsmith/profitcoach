"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useCoachAccess } from "@/hooks/useCoachAccess";
import type { CoachFeature } from "@/lib/coachAccess/tiers";

const ROUTE_FEATURES: { prefix: string; feature: CoachFeature }[] = [
  { prefix: "/coach/prospects", feature: "nav.marketing" },
  { prefix: "/coach/calls", feature: "nav.marketing" },
  { prefix: "/coach/funnel-analyzer", feature: "nav.marketing" },
  { prefix: "/coach/boss-pro", feature: "nav.marketing" },
  { prefix: "/coach/message-generator", feature: "nav.marketing" },
  { prefix: "/coach/clients", feature: "nav.delivery" },
  { prefix: "/coach/playbooks", feature: "nav.delivery" },
  { prefix: "/coach/contacts", feature: "nav.delivery" },
  { prefix: "/coach/signature", feature: "nav.compass" },
  { prefix: "/coach/academy", feature: "nav.classroom" },
];

function requiredFeatureForPath(pathname: string | null): CoachFeature | null {
  if (!pathname) return null;
  const match = ROUTE_FEATURES.find((route) => pathname.startsWith(route.prefix));
  return match?.feature ?? null;
}

type Props = {
  children: ReactNode;
};

export function CoachRouteAccessGuard({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const { hasFeature, loading } = useCoachAccess(impersonatingCoachId);

  const requiredFeature = requiredFeatureForPath(pathname);

  useEffect(() => {
    if (!loading && requiredFeature && !hasFeature(requiredFeature)) {
      router.replace("/coach/community");
    }
  }, [hasFeature, loading, requiredFeature, router]);

  if (loading) {
    return <p className="text-sm text-slate-600">Loading…</p>;
  }

  if (requiredFeature && !hasFeature(requiredFeature)) {
    return null;
  }

  return <>{children}</>;
}
