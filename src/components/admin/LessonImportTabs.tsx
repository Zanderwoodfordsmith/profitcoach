"use client";

import { usePathname } from "next/navigation";

import { PageHeaderUnderlineTabs } from "@/components/layout";

export function LessonImportTabs() {
  const pathname = usePathname();
  const onRoadmap =
    pathname === "/admin/roadmap" ||
    Boolean(pathname?.startsWith("/admin/roadmap/"));
  // Archived lesson pages open from the Curriculum board's "Not in Classroom" group.
  const onCurriculum =
    Boolean(pathname?.startsWith("/admin/lesson-import/curriculum")) ||
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
          href: "/admin/lesson-import/curriculum",
          label: "Curriculum",
          active: onCurriculum,
        },
      ]}
    />
  );
}
