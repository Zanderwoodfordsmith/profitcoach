"use client";

import { usePathname } from "next/navigation";

import { InitiativesIcon, JobIcon, ProjectIcon } from "@/components/admin/roadmap/roadmapIcons";
import { PageHeaderUnderlineTabs } from "@/components/layout";

export function LessonImportTabs() {
  const pathname = usePathname();
  // Initiatives, then projects, then jobs (like Linear). Jobs is the roadmap board itself.
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
          href: "/admin/roadmap/initiatives",
          label: (
            <span className="inline-flex items-center gap-1.5">
              <InitiativesIcon className="h-4 w-4" aria-hidden />
              Initiatives
            </span>
          ),
          active: onInitiatives,
        },
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
