import { AcademyCourseCard } from "@/components/academy/AcademyCourseCard";
import { lessonCount, listCoursesFlat } from "@/lib/academy/catalog";
import { loadAcademyCatalogWithDb } from "@/lib/academy/lessonContent";
import { courseVisibleToAccessTier } from "@/lib/academy/accessTierFilter";
import type { CoachAccessTier } from "@/lib/coachAccess/tiers";

type Props = {
  /** Prefix for course card links (e.g. `/coach/academy/classroom`). */
  linkBasePath: string;
  /** When set, filters courses by optional catalog `accessTiers`. */
  viewerAccessTier?: CoachAccessTier | null;
};

export async function AcademyCatalogGrid({
  linkBasePath,
  viewerAccessTier = null,
}: Props) {
  const catalog = await loadAcademyCatalogWithDb();
  const rows = listCoursesFlat(catalog).filter(({ course }) =>
    viewerAccessTier
      ? courseVisibleToAccessTier(course, viewerAccessTier)
      : true
  );

  return (
    <div className="mx-auto w-[80%] max-w-6xl">
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ course }) => (
          <AcademyCourseCard
            key={course.id}
            href={`${linkBasePath}/${course.id}`}
            moduleTitle={course.title}
            description={course.description ?? ""}
            lessonCount={lessonCount(course)}
            compassPillarId={course.compassPillarId}
            coverImageUrl={course.coverImageUrl}
          />
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No courses in the catalog yet.</p>
      ) : null}
    </div>
  );
}
