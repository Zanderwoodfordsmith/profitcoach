import { AdminAcademyImportStatus } from "@/components/academy/AdminAcademyImportStatus";
import { loadAcademyImportSnapshot } from "@/lib/academy/academyImportSnapshot";
import { loadLessonImportStatusReport } from "@/lib/academy/lessonImportStatus";

export default async function AdminAcademyImportStatusPage() {
  const [status, { report: snapshot, updatedAt: snapshotUpdatedAt }] = await Promise.all([
    loadLessonImportStatusReport(),
    loadAcademyImportSnapshot(),
  ]);

  return (
    <AdminAcademyImportStatus
      status={status}
      snapshot={snapshot}
      snapshotUpdatedAt={snapshotUpdatedAt ?? status.snapshotUpdatedAt}
    />
  );
}
