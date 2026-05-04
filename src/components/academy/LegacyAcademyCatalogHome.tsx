import { AcademyCourseCard } from "@/components/academy/AcademyCourseCard";
import { StickyPageHeader } from "@/components/layout";
import { loadLegacyHub } from "@/lib/academy/legacyHubLoad";
import { legacyLessonCount } from "@/lib/academy/legacyHubCatalog";

type Props = {
  basePath: string;
};

export async function LegacyAcademyCatalogHome({ basePath }: Props) {
  const catalog = loadLegacyHub();

  return (
    <div className="flex flex-col gap-6">
      <StickyPageHeader
        title="Classroom"
        description={
          <span className="text-lg leading-relaxed text-slate-600">
            Your seven legacy Business Coach Academy programmes. Open a programme to browse
            categories and lessons — each lesson links through to the matching page on Disco.
          </span>
        }
      />

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
    </div>
  );
}
