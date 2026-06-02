import { AdminAcademyImportStatus } from "@/components/academy/AdminAcademyImportStatus";
import { loadAcademyImportOverrides } from "@/lib/academy/academyImportOverrides";
import { loadLatestAcademyBodyImportUnresolved } from "@/lib/academy/bodyImportReport";
import { loadAcademyImportSnapshot } from "@/lib/academy/academyImportSnapshot";
import { loadLessonImportStatusReport } from "@/lib/academy/lessonImportStatus";

/** Always read fresh academy_lesson_content rows (import may be running). */
export const dynamic = "force-dynamic";

export default async function AdminAcademyImportStatusPage() {
  const [status, { report: snapshot, updatedAt: snapshotUpdatedAt }, importOverrides, bodyImport] =
    await Promise.all([
      loadLessonImportStatusReport(),
      loadAcademyImportSnapshot(),
      loadAcademyImportOverrides().catch(() => []),
      Promise.resolve(loadLatestAcademyBodyImportUnresolved()),
    ]);

  return (
    <AdminAcademyImportStatus
      status={status}
      snapshot={snapshot}
      snapshotUpdatedAt={snapshotUpdatedAt ?? status.snapshotUpdatedAt}
      importOverrides={importOverrides}
      bodyImportUnresolved={bodyImport.unresolved}
      bodyImportReportFile={bodyImport.reportFile}
      bodyImportTotalRows={bodyImport.totalRows}
    />
  );
}
