import { AdminOldAcademyLinks } from "@/components/academy/AdminOldAcademyLinks";
import { LessonImportTabs } from "@/components/admin/LessonImportTabs";
import { StickyPageHeader } from "@/components/layout";
import { loadOldAcademyLinkAudit } from "@/lib/academy/oldAcademyLinkAudit";

export const dynamic = "force-dynamic";

export default async function AdminOldAcademyLinksPage() {
  const report = await loadOldAcademyLinkAudit();

  return (
    <div className="flex flex-col gap-6">
      <StickyPageHeader
        title="Lessons"
        description={
          <span className="text-lg leading-relaxed text-slate-600">
            Lessons still pointing at the dead Disco domain — clear or replace these links.
          </span>
        }
        tabs={<LessonImportTabs />}
      />
      <AdminOldAcademyLinks report={report} />
    </div>
  );
}
