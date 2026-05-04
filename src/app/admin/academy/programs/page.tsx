import { LegacyAcademyCatalogGrid } from "@/components/academy/LegacyAcademyCatalogGrid";

const BASE = "/admin/academy/programs";

export default async function AdminAcademyProgramsCatalogPage() {
  return <LegacyAcademyCatalogGrid basePath={BASE} />;
}
