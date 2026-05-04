import { LegacyAcademyCatalogGrid } from "@/components/academy/LegacyAcademyCatalogGrid";

const BASE = "/coach/academy/programs";

export default async function CoachAcademyProgramsCatalogPage() {
  return <LegacyAcademyCatalogGrid basePath={BASE} />;
}
