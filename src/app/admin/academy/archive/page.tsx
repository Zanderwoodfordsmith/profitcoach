import { ArchiveCatalogGrid } from "@/components/academy/ArchiveCatalogGrid";

const BASE = "/admin/academy/archive";

export default async function AdminAcademyArchiveCatalogPage() {
  return <ArchiveCatalogGrid basePath={BASE} />;
}
