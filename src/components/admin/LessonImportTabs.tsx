"use client";

import { usePathname } from "next/navigation";

import { PageHeaderUnderlineTabs } from "@/components/layout";

export function LessonImportTabs() {
  const pathname = usePathname();
  const onImport =
    pathname === "/admin/lesson-import" ||
    pathname === "/admin/lesson-import/";
  const onOldLinks =
    pathname === "/admin/lesson-import/old-academy-links" ||
    Boolean(pathname?.startsWith("/admin/lesson-import/old-academy-links/"));
  const onCurriculum = Boolean(pathname?.startsWith("/admin/lesson-import/curriculum"));

  return (
    <PageHeaderUnderlineTabs
      ariaLabel="Lessons"
      items={[
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
          href: "/admin/lesson-import/old-academy-links",
          label: "Old academy links",
          active: onOldLinks,
        },
      ]}
    />
  );
}
