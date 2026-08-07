import { ClassroomCatalogGrid } from "@/components/academy/ClassroomCatalogGrid";

const BASE = "/admin/academy/classroom";

export default async function AdminAcademyClassroomCatalogPage() {
  return <ClassroomCatalogGrid basePath={BASE} />;
}
