import { AcademyCatalogGrid } from "@/components/academy/AcademyCatalogGrid";

const CLASSROOM_LINK_BASE = "/admin/academy/classroom";

export default async function AdminAcademyNewPreviewPage() {
  return <AcademyCatalogGrid linkBasePath={CLASSROOM_LINK_BASE} />;
}
