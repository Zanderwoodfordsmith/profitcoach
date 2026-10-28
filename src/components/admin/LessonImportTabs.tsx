"use client";

import { usePathname } from "next/navigation";

import { JobIcon, ProjectIcon } from "@/components/admin/roadmap/roadmapIcons";
import { PageHeaderUnderlineTabs } from "@/components/layout";

export function LessonImportTabs() {
  const pathname = usePathname();
  // Projects (work with an end), then jobs. Jobs is the roadmap board itself. Initiatives are hidden (28 Oct).
  const onInitiatives = Boolean(pathname?.startsWith("/admin/roadmap/initiatives"));
  const onProjects = Boolean(pathname?.startsWith("/admin/roadmap/projects"));
  const onJobs =
    (pathname === "/admin/roadmap" || Boolean(pathname?.startsWith("/admin/roadmap/"))) &&
    !onInitiatives &&
    !onProjects;
  // Archived lesson pages open from the Curriculum board's "Not in Classroom" group.
  const onCurriculum =
    Boolean(pathname?.startsWith("/admin/lesson-import/curriculum")) ||
    Boolean(pathname?.startsWith("/admin/academy/archive/"));

  return (
    <PageHeaderUnderlineTabs
      ariaLabel="Product"
      items={[
        {
          kind: "link" as const,
          href: "/admin/roadmap/projects",
          label: (
            <span className="inline-flex items-center gap-1.5">
              <ProjectIcon className="h-4 w-4" aria-hidden />
              Projects
            </span>
          ),
          active: onProjects,
        },
        {
          kind: "link" as const,
          href: "/admin/roadmap",
          label: (
            <span className="inline-flex items-center gap-1.5">
              <JobIcon className="h-4 w-4" aria-hidden />
              Jobs
            </span>
          ),
          active: onJobs,
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
