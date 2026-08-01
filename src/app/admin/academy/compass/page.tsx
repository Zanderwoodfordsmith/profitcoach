import { AcademyCatalogGrid } from "@/components/academy/AcademyCatalogGrid";

const LINK_BASE = "/admin/academy/compass";

export default async function AdminAcademyClassroomCatalogPage() {
  return <AcademyCatalogGrid linkBasePath={LINK_BASE} />;
}
