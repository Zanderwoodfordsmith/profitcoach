"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

import {
  PageHeaderUnderlineTabs,
  type PageHeaderUnderlineTabItem,
} from "@/components/layout/PageHeaderUnderlineTabs";
import { StickyPageHeader } from "@/components/layout";

export function ClassroomShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";

  const resourcesRoot = `${prefix}/academy/resources`;
  const classroomRoot = `${prefix}/academy/classroom`;
  const compassModulesRoot = `${prefix}/academy/compass`;
  const compassRoot = `${prefix}/signature`;
  const actionsRoot = `${prefix}/signature/actions`;

  const tabItems = useMemo(() => {
    const isResources =
      pathname === resourcesRoot || pathname.startsWith(`${resourcesRoot}/`);
    const isClassroom =
      pathname === classroomRoot || pathname.startsWith(`${classroomRoot}/`);
    const isActions =
      pathname === actionsRoot || pathname.startsWith(`${actionsRoot}/`);
    const isCompass =
      pathname === compassRoot || pathname === `${compassRoot}/`;

    const items: PageHeaderUnderlineTabItem[] = [
      {
        kind: "link",
        href: classroomRoot,
        label: "Classroom",
        active: isClassroom,
        scroll: false,
      },
      {
        kind: "link",
        href: actionsRoot,
        label: "My Actions",
        active: isActions,
        scroll: false,
      },
      {
        kind: "link",
        href: resourcesRoot,
        label: "Resources",
        active: isResources,
        scroll: false,
      },
      {
        kind: "link",
        href: compassRoot,
        label: "My Compass",
        active: isCompass,
        scroll: false,
      },
    ];

    return items;
  }, [
    pathname,
    resourcesRoot,
    classroomRoot,
    compassRoot,
    actionsRoot,
  ]);

  const description = useMemo(() => {
    if (pathname.startsWith(actionsRoot)) {
      return (
        <span className="text-lg leading-relaxed text-slate-600">
          Open work from Classroom, grouped like the hub — Start Here, Get Calls, Win Clients, and
          more — plus your own lists.
        </span>
      );
    }
    if (
      pathname === compassRoot ||
      pathname === `${compassRoot}/` ||
      (pathname.startsWith(`${compassRoot}/`) &&
        !pathname.startsWith(actionsRoot) &&
        !pathname.startsWith(`${compassRoot}/ladder`) &&
        !pathname.startsWith(`${compassRoot}/scorecard`))
    ) {
      return (
        <span className="text-lg leading-relaxed text-slate-600">
          Tap the circle beside each line to score. The model updates as you go.
        </span>
      );
    }
    if (pathname.startsWith(resourcesRoot)) {
      return (
        <span className="text-lg leading-relaxed text-slate-600">
          Worksheets, SOPs, templates, and reference links for coach delivery and the Profit
          System — searchable and grouped by topic.
        </span>
      );
    }
    if (pathname.startsWith(`${classroomRoot}/working`)) {
      return (
        <span className="text-lg leading-relaxed text-slate-600">
          Working lessons. Check a recommendation, tweak what is off, and lock it. Video is optional.
        </span>
      );
    }
    if (pathname.startsWith(classroomRoot)) {
      return (
        <span className="text-lg leading-relaxed text-slate-600">
          Start Here, then your Coach Action Plan and Going Pro — followed by the three paths that
          build your business: Get Calls, Win Clients, and Coach Clients.
        </span>
      );
    }
    if (pathname.startsWith(compassModulesRoot)) {
      return (
        <span className="text-lg leading-relaxed text-slate-600">
          Self-paced training aligned with the nine modules on My Compass — Connect, Enroll, and
          Deliver.
        </span>
      );
    }
    return (
      <span className="text-lg leading-relaxed text-slate-600">
        Self-paced training aligned with the nine modules on My Compass — Connect, Enroll, and
        Deliver.
      </span>
    );
  }, [
    pathname,
    resourcesRoot,
    classroomRoot,
    compassModulesRoot,
    compassRoot,
    actionsRoot,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <StickyPageHeader
        title="Classroom"
        tabs={<PageHeaderUnderlineTabs items={tabItems} ariaLabel="Classroom area" />}
        description={description}
      />
      {children}
    </div>
  );
}
