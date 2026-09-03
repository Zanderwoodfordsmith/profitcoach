"use client";

import { usePathname } from "next/navigation";

import { PageHeaderUnderlineTabs } from "@/components/layout";

export function LessonImportTabs() {
  const pathname = usePathname();
  const onRoadmap =
    pathname === "/admin/roadmap" ||
    Boolean(pathname?.startsWith("/admin/roadmap/"));
  const onImport =
    pathname === "/admin/lesson-import" ||
    pathname === "/admin/lesson-import/";
  const onOldLinks =
    pathname === "/admin/lesson-import/old-academy-links" ||
    Boolean(pathname?.startsWith("/admin/lesson-import/old-academy-links/"));
  const onCurriculum = Boolean(pathname?.startsWith("/admin/lesson-import/curriculum"));
  const onArchivedLessons =
    pathname === "/admin/academy/archive" ||
    Boolean(pathname?.startsWith("/admin/academy/archive/"));

  return (
    <PageHeaderUnderlineTabs
      ariaLabel="Academy"
      items={[
        {
          kind: "link" as const,
          href: "/admin/roadmap",
          label: "Roadmap",
          active: onRoadmap,
        },
        {
          kind: "link" as const,
          href: "/admin/lesson-import",
          label: "Import status",
          active: onImport,
        },
        {
          kind: "link" as const,
          href: "/admin/lesson-import/curriculum",
          label: "Curriculum",
          active: onCurriculum,
        },
        {
          kind: "link" as const,
          href: "/admin/academy/archive",
          label: "Archived lessons",
          active: onArchivedLessons,
        },
        {
          kind: "link" as const,
          href: "/admin/lesson-import/old-academy-links",
          label: "Archive links",
          active: onOldLinks,
        },
      ]}
    />
  );
}
