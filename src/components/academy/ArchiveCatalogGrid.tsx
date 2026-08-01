import { AcademyCatalogCards } from "@/components/academy/AcademyCatalogCards";
import { loadArchiveHub } from "@/lib/academy/archiveHubLoad";
import { hubLessonCount } from "@/lib/academy/hubCatalog";

type Props = {
  basePath: string;
};

export async function ArchiveCatalogGrid({ basePath }: Props) {
  const catalog = loadArchiveHub();

  const courses = catalog.courses.map((course) => ({
    id: course.id,
    title: course.title,
    description: course.description ?? "",
    lessonCount: hubLessonCount(course),
  }));

  return <AcademyCatalogCards basePath={basePath} courses={courses} />;
}
