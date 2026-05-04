import { AcademyCatalogGrid } from "@/components/academy/AcademyCatalogGrid";

const CLASSROOM_LINK_BASE = "/coach/academy/classroom";

/** Admin preview grid — cards open the real Classroom programme routes. */
export default async function CoachAcademyNewPreviewPage() {
  return <AcademyCatalogGrid linkBasePath={CLASSROOM_LINK_BASE} />;
}
