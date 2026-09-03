import { LessonImportTabs } from "@/components/admin/LessonImportTabs";
import { StickyPageHeader } from "@/components/layout";

export default function AdminAcademyArchiveLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col gap-6">
      <StickyPageHeader
        title="Academy"
        description={
          <span className="text-lg leading-relaxed text-slate-600">
            Lessons not surfaced in Classroom — edit content here without changing the live hub.
          </span>
        }
        tabs={<LessonImportTabs />}
      />
      {children}
    </div>
  );
}
