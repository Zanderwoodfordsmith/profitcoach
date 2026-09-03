import Link from "next/link";

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
        title="Academy"
        description={
          <span className="text-lg leading-relaxed text-slate-600">
            Lessons still pointing at the dead Disco domain — clear or replace these links.
          </span>
        }
        tabs={<LessonImportTabs />}
      />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Growth system overview</h2>
        <p className="mt-1 text-sm text-slate-600">
          Internal preview of the recommended coaching business journey. The horizontal
          system map lives in Classroom → System.
        </p>
        <Link
          href="/admin/growth-system"
          className="mt-3 inline-flex text-sm font-semibold text-sky-700 hover:text-sky-900"
        >
          Open overview →
        </Link>
      </div>
      <AdminOldAcademyLinks report={report} />
    </div>
  );
}
