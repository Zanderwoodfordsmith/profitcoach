import { AcademyCatalogGrid } from "@/components/academy/AcademyCatalogGrid";

const LINK_BASE = "/coach/academy/classroom";

export default async function CoachAcademyClassroomCatalogPage() {
  return <AcademyCatalogGrid linkBasePath={LINK_BASE} />;
}
