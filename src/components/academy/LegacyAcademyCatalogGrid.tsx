import { AcademyCatalogCards } from "@/components/academy/AcademyCatalogCards";
import { loadLegacyHub } from "@/lib/academy/legacyHubLoad";
import { legacyLessonCount } from "@/lib/academy/legacyHubCatalog";

type Props = {
  basePath: string;
};

export async function LegacyAcademyCatalogGrid({ basePath }: Props) {
  const catalog = loadLegacyHub();

  const courses = catalog.courses.map((course) => ({
    id: course.id,
    title: course.title,
    description: course.description ?? "",
    lessonCount: legacyLessonCount(course),
  }));

  return <AcademyCatalogCards basePath={basePath} courses={courses} />;
}
