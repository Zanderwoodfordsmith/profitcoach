import Link from "next/link";

import { AcademyResourcesLibrary } from "@/components/academy/AcademyResourcesLibrary";
import { loadAcademyResourcesCatalog } from "@/lib/academy/resources";

/** The original link list, kept while the Resource Library is on test. */
export default async function CoachResourcesListPage() {
  const catalog = await loadAcademyResourcesCatalog();

  return (
    <div className="space-y-4 pt-6">
      <Link href="/coach/academy/resources" className="text-sm font-medium text-sky-700 hover:text-sky-900">
        ← The Resource Library
      </Link>
      <AcademyResourcesLibrary catalog={catalog} />
    </div>
  );
}
