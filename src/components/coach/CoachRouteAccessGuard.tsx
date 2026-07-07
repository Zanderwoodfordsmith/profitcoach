"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useCoachAccess } from "@/hooks/useCoachAccess";
import { FeatureGateOverlay } from "@/components/coach/FeatureGateOverlay";
import {
  ACADEMY_COURSE_TITLES,
  academyCourseIdFromPath,
  academyCourseLocked,
  gatedRouteForPath,
} from "@/lib/coachAccess/gatedRoutes";

type Props = {
  children: ReactNode;
};

export function CoachRouteAccessGuard({ children }: Props) {
  const pathname = usePathname();
  const { impersonatingCoachId } = useImpersonation();
  const { hasFeature, loading } = useCoachAccess(impersonatingCoachId);

  if (loading) {
    return <>{children}</>;
  }

  const gatedRoute = gatedRouteForPath(pathname);
  if (gatedRoute && !hasFeature(gatedRoute.feature)) {
    return (
      <FeatureGateOverlay
        title={gatedRoute.title}
        description={gatedRoute.description}
      >
        {children}
      </FeatureGateOverlay>
    );
  }

  const courseId = academyCourseIdFromPath(pathname);
  if (courseId && academyCourseLocked(courseId, hasFeature)) {
    const title = ACADEMY_COURSE_TITLES[courseId] ?? "This programme";
    return (
      <FeatureGateOverlay
        title={title}
        description={`${title} is part of Profit Coach membership. Unlock it to get the full programme, plus every other course in the Classroom.`}
      >
        {children}
      </FeatureGateOverlay>
    );
  }

  return <>{children}</>;
}
