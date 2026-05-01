import { AcademyCatalogHome } from "@/components/academy/AcademyCatalogHome";

const BASE = "/coach/academy";

export default async function CoachAcademyPage() {
  return <AcademyCatalogHome basePath={BASE} />;
}
