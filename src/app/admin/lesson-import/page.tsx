import Link from "next/link";

import { AdminAcademyImportStatus } from "@/components/academy/AdminAcademyImportStatus";
import { LessonImportTabs } from "@/components/admin/LessonImportTabs";
import { StickyPageHeader } from "@/components/layout";
import { cardClass } from "@/components/ui/Card";
import { loadAcademyImportOverrides } from "@/lib/academy/academyImportOverrides";
import { loadAcademyImportSnapshot } from "@/lib/academy/academyImportSnapshot";
import { loadLessonImportStatusReport } from "@/lib/academy/lessonImportStatus";

/** Always read fresh academy_lesson_content rows (import may be running). */
export const dynamic = "force-dynamic";

export default async function AdminLessonImportPage() {
  const [status, { report: snapshot, updatedAt: snapshotUpdatedAt }, importOverrides] =
    await Promise.all([
      loadLessonImportStatusReport(),
      loadAcademyImportSnapshot(),
      loadAcademyImportOverrides().catch(() => []),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <StickyPageHeader
        title="Product"
        description={
          <span className="text-lg leading-relaxed text-slate-600">
            Track video, content, and transcript coverage for each Classroom lesson.
          </span>
        }
        tabs={<LessonImportTabs />}
      />
      <div className={cardClass("plain", "p-5")}>
        <h2 className="text-base font-semibold text-slate-900">Growth system overview</h2>
        <p className="mt-1 text-sm text-slate-600">
          Internal preview of the recommended coaching business journey. The horizontal
          system map lives in Classroom → System.
        </p>
        <Link
          href="/admin/growth-system"
          className="mt-3 inline-flex text-sm font-medium text-sky-700 hover:text-sky-900"
        >
          Open overview →
        </Link>
      </div>
      <AdminAcademyImportStatus
        status={status}
        snapshot={snapshot}
        snapshotUpdatedAt={snapshotUpdatedAt ?? status.snapshotUpdatedAt}
        importOverrides={importOverrides}
      />
    </div>
  );
}
