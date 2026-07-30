import { AdminAcademyImportStatus } from "@/components/academy/AdminAcademyImportStatus";
import { StickyPageHeader } from "@/components/layout";
import { loadAcademyImportOverrides } from "@/lib/academy/academyImportOverrides";
import { loadLatestAcademyBodyImportUnresolved } from "@/lib/academy/bodyImportReport";
import { loadAcademyImportSnapshot } from "@/lib/academy/academyImportSnapshot";
import { loadLessonImportStatusReport } from "@/lib/academy/lessonImportStatus";

/** Always read fresh academy_lesson_content rows (import may be running). */
export const dynamic = "force-dynamic";

export default async function AdminLessonImportPage() {
  const [status, { report: snapshot, updatedAt: snapshotUpdatedAt }, importOverrides, bodyImport] =
    await Promise.all([
      loadLessonImportStatusReport(),
      loadAcademyImportSnapshot(),
      loadAcademyImportOverrides().catch(() => []),
      Promise.resolve(loadLatestAcademyBodyImportUnresolved()),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <StickyPageHeader
        title="Lesson import"
        description={
          <span className="text-lg leading-relaxed text-slate-600">
            Track video and transcript import from Old Academy Drive against each programme lesson.
          </span>
        }
      />
      <AdminAcademyImportStatus
        status={status}
        snapshot={snapshot}
        snapshotUpdatedAt={snapshotUpdatedAt ?? status.snapshotUpdatedAt}
        importOverrides={importOverrides}
        bodyImportUnresolved={bodyImport.unresolved}
        bodyImportReportFile={bodyImport.reportFile}
        bodyImportTotalRows={bodyImport.totalRows}
      />
    </div>
  );
}
