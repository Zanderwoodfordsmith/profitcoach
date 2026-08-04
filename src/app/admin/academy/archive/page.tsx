import { redirect } from "next/navigation";

import { firstLessonInCourse } from "@/lib/academy/hubCatalog";
import { loadArchiveHub } from "@/lib/academy/archiveHubLoad";

const BASE = "/admin/academy/archive";

/** Jump straight into the archive lesson player (nested programme sidebar). */
export default async function AdminAcademyArchiveCatalogPage() {
  const catalog = loadArchiveHub();
  const course = catalog.courses[0];
  if (!course) redirect("/admin");
  const first = firstLessonInCourse(course);
  if (!first) redirect("/admin");
  redirect(
    `${BASE}/${encodeURIComponent(course.id)}/${encodeURIComponent(first.id)}`,
  );
}
