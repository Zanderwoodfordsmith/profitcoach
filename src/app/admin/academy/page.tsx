import { AcademyCatalogHome } from "@/components/academy/AcademyCatalogHome";

const BASE = "/admin/academy";

export default async function AdminAcademyPage() {
  return <AcademyCatalogHome basePath={BASE} showSourceEditHint />;
}
