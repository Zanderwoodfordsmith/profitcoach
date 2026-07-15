import type { CoachAccessTier } from "@/lib/coachAccess/tiers";
import { effectiveCalendarAccessTier } from "@/lib/coachAccess/tiers";
import type { AcademyCourse } from "@/lib/academy/types";

export function courseVisibleToAccessTier(
  course: Pick<AcademyCourse, "accessTiers">,
  viewerTier: CoachAccessTier
): boolean {
  const tiers = course.accessTiers;
  if (!tiers || tiers.length === 0) return true;
  const effective = effectiveCalendarAccessTier(viewerTier);
  return tiers.includes(viewerTier) || tiers.includes(effective);
}

export function filterAcademyCoursesByTier<T extends Pick<AcademyCourse, "accessTiers">>(
  courses: T[],
  viewerTier: CoachAccessTier | null | undefined
): T[] {
  if (!viewerTier) return courses;
  return courses.filter((course) => courseVisibleToAccessTier(course, viewerTier));
}
