"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useCoachAccess } from "@/hooks/useCoachAccess";
import { FeatureGateOverlay } from "@/components/coach/FeatureGateOverlay";
import { adminPreviewCoachRouteForPath } from "@/lib/coachAccess/adminPreviewRoutes";
import {
  ACADEMY_COURSE_TITLES,
  academyCourseIdFromPath,
  academyCourseLocked,
  gatedRouteForPath,
} from "@/lib/coachAccess/gatedRoutes";
import { supabaseClient } from "@/lib/supabaseClient";

type Props = {
  children: ReactNode;
};

export function CoachRouteAccessGuard({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const { hasFeature, loading } = useCoachAccess(impersonatingCoachId);
  const [roleLoading, setRoleLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setRoleLoading(true);
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user) {
        if (!cancelled) {
          setIsAdmin(false);
          setRoleLoading(false);
        }
        return;
      }
      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as {
        role?: string;
      };
      if (!cancelled) {
        setIsAdmin(roleBody.role === "admin");
        setRoleLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const previewRoute = adminPreviewCoachRouteForPath(pathname);
  // Admins “View as coach” should match the coach product surface: no preview routes.
  const canAccessAdminPreview = isAdmin && !impersonatingCoachId;

  useEffect(() => {
    if (roleLoading || canAccessAdminPreview || !previewRoute) return;
    router.replace(previewRoute.fallback);
  }, [roleLoading, canAccessAdminPreview, previewRoute, router]);

  if (previewRoute && (roleLoading || !canAccessAdminPreview)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4">
        <p className="text-sm text-slate-600">
          {roleLoading ? "Loading…" : "Redirecting…"}
        </p>
      </div>
    );
  }

  if (loading || roleLoading) {
    return <>{children}</>;
  }

  // Admins browsing the coach surface as themselves are not gated.
  // Use “View as coach” to see real membership locks for a specific coach.
  if (isAdmin && !impersonatingCoachId) {
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
