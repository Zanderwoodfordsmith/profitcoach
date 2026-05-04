import { AcademyCourseCard } from "@/components/academy/AcademyCourseCard";
import { lessonCount, listCoursesFlat, loadAcademyCatalog } from "@/lib/academy/catalog";

type Props = {
  /** Prefix for course card links (e.g. `/coach/academy/classroom`). */
  linkBasePath: string;
};

export async function AcademyCatalogGrid({ linkBasePath }: Props) {
  const catalog = await loadAcademyCatalog();
  const rows = listCoursesFlat(catalog);

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
