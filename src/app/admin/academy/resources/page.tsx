import { AcademyResourcesLibrary } from "@/components/academy/AcademyResourcesLibrary";
import { loadAcademyResourcesCatalog } from "@/lib/academy/resources";

export default async function AdminAcademyResourcesPage() {
  const catalog = await loadAcademyResourcesCatalog();

  return (
    <div className="pt-6">
      <AcademyResourcesLibrary catalog={catalog} canManage />
    </div>
  );
}
