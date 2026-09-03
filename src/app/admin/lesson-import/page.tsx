import { AdminAcademyImportStatus } from "@/components/academy/AdminAcademyImportStatus";
import { LessonImportTabs } from "@/components/admin/LessonImportTabs";
import { StickyPageHeader } from "@/components/layout";
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
        title="Academy"
        description={
          <span className="text-lg leading-relaxed text-slate-600">
            Track video, content, and transcript coverage for each Classroom lesson.
          </span>
        }
        tabs={<LessonImportTabs />}
      />
      <AdminAcademyImportStatus
        status={status}
        snapshot={snapshot}
        snapshotUpdatedAt={snapshotUpdatedAt ?? status.snapshotUpdatedAt}
        importOverrides={importOverrides}
      />
    </div>
  );
}
