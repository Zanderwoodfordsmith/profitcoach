import { AcademyCourseCard } from "@/components/academy/AcademyCourseCard";
import { loadLegacyHub } from "@/lib/academy/legacyHubLoad";
import { legacyLessonCount } from "@/lib/academy/legacyHubCatalog";

type Props = {
  basePath: string;
};

export async function LegacyAcademyCatalogGrid({ basePath }: Props) {
  const catalog = loadLegacyHub();

  return (
    <div className="mx-auto w-[80%] max-w-6xl">
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {catalog.courses.map((course) => (
          <AcademyCourseCard
            key={course.id}
            href={`${basePath}/${course.id}`}
            moduleTitle={course.title}
            description={course.description ?? ""}
            lessonCount={legacyLessonCount(course)}
            hideCoverEyebrow
          />
        ))}
      </div>
    </div>
  );
}
