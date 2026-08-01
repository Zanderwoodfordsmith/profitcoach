import { ClassroomCatalogGrid } from "@/components/academy/ClassroomCatalogGrid";

const BASE = "/coach/academy/classroom";

export default async function CoachAcademyClassroomCatalogPage() {
  return <ClassroomCatalogGrid basePath={BASE} />;
}
