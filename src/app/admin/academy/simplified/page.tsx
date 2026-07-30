import { SimplifiedAcademyCatalogGrid } from "@/components/academy/SimplifiedAcademyCatalogGrid";

const BASE = "/admin/academy/simplified";

export default async function AdminAcademySimplifiedCatalogPage() {
  return <SimplifiedAcademyCatalogGrid basePath={BASE} />;
}
