"use client";

import { Lock } from "lucide-react";

import { AcademyCourseCard } from "@/components/academy/AcademyCourseCard";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useCoachAccess } from "@/hooks/useCoachAccess";
import { academyCourseLocked } from "@/lib/coachAccess/gatedRoutes";

export type AcademyCatalogCourse = {
  id: string;
  title: string;
  description: string;
  lessonCount: number;
};

type Props = {
  basePath: string;
  courses: AcademyCatalogCourse[];
};

export function AcademyCatalogCards({ basePath, courses }: Props) {
  const { impersonatingCoachId } = useImpersonation();
  const { hasFeature, loading } = useCoachAccess(impersonatingCoachId);

  return (
    <div className="mx-auto w-[80%] max-w-6xl">
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((course) => {
          const locked = !loading && academyCourseLocked(course.id, hasFeature);
          return (
            <div key={course.id} className="relative">
              <div className={locked ? "opacity-55 grayscale" : ""}>
                <AcademyCourseCard
                  href={`${basePath}/${course.id}`}
                  moduleTitle={course.title}
                  description={course.description}
                  lessonCount={course.lessonCount}
                  hideCoverEyebrow
                />
              </div>
              {locked ? (
                <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#0c5290] shadow-sm ring-1 ring-slate-200">
                  <Lock className="h-3 w-3" aria-hidden />
                  Unlock with membership
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
