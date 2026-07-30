import { SimplifiedAcademyCatalogGrid } from "@/components/academy/SimplifiedAcademyCatalogGrid";

const BASE = "/coach/academy/simplified";

export default async function CoachAcademySimplifiedCatalogPage() {
  return <SimplifiedAcademyCatalogGrid basePath={BASE} />;
}
