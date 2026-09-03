import { CurriculumDecisionsView } from "@/components/academy/CurriculumDecisionsView";
import { LessonImportTabs } from "@/components/admin/LessonImportTabs";
import { StickyPageHeader } from "@/components/layout";

export default function AdminLessonImportCurriculumPage() {
  return (
    <div className="flex flex-col gap-6">
      <StickyPageHeader
        title="Academy"
        description={
          <span className="text-lg leading-relaxed text-slate-600">
            Outcome titles we are taking. Current lessons we are keeping. Locked
            Sep 2026.
          </span>
        }
        tabs={<LessonImportTabs />}
      />
      <CurriculumDecisionsView />
    </div>
  );
}
