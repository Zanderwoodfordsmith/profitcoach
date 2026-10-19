"use client";

import { useMemo } from "react";

import { useOptimisticPathname } from "@/hooks/useOptimisticPathname";

import {
  PageHeaderUnderlineTabs,
  type PageHeaderUnderlineTabItem,
} from "@/components/layout/PageHeaderUnderlineTabs";
import { StickyPageHeader } from "@/components/layout";

export function ClassroomShell({ children }: { children: React.ReactNode }) {
  const { pathname, markPending } = useOptimisticPathname();
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";

  const resourcesRoot = `${prefix}/academy/resources`;
  const vaultRoot = `${prefix}/academy/vault`;
  const classroomRoot = `${prefix}/academy/classroom`;

  const tabItems = useMemo(() => {
    const isResources =
      pathname === resourcesRoot || pathname.startsWith(`${resourcesRoot}/`);
    const isVault = pathname === vaultRoot || pathname.startsWith(`${vaultRoot}/`);
    // System lives under Classroom (banner on the hub), so it keeps this tab lit.
    const isClassroom =
      pathname === classroomRoot || pathname.startsWith(`${classroomRoot}/`);

    const items: PageHeaderUnderlineTabItem[] = [
      {
        kind: "link",
        href: classroomRoot,
        label: "Classroom",
        active: isClassroom,
        scroll: false,
        onNavigate: () => markPending(classroomRoot),
      },
      {
        kind: "link",
        href: resourcesRoot,
        label: "Resources",
        active: isResources,
        scroll: false,
        onNavigate: () => markPending(resourcesRoot),
      },
      {
        kind: "link",
        href: vaultRoot,
        label: "Vault",
        active: isVault,
        scroll: false,
        onNavigate: () => markPending(vaultRoot),
      },
    ];

    return items;
  }, [pathname, resourcesRoot, vaultRoot, classroomRoot, markPending]);

  const description = useMemo(() => {
    if (pathname.startsWith(vaultRoot)) {
      return (
        <span className="text-lg leading-relaxed text-slate-600">
          Bonus programmes outside the main path. Watch them in any order, alongside your Classroom
          work.
        </span>
      );
    }
    if (pathname.startsWith(resourcesRoot)) {
      return (
        <span className="text-lg leading-relaxed text-slate-600">
          Worksheets, SOPs, templates, and reference links for coach delivery and the Profit
          System, searchable and grouped by topic.
        </span>
      );
    }
    if (pathname.startsWith(`${classroomRoot}/system`)) {
      return (
        <span className="text-lg leading-relaxed text-slate-600">
          The step-by-step process to build your advisory portfolio, from market and outreach
          through authority and client delivery. Open any card to jump into the lesson.
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
          Start Here, then your Coach Action Plan and Going Pro. After that, the three paths that
          build your business: Get Calls, Win Clients, and Keep Clients.
        </span>
      );
    }
    return (
      <span className="text-lg leading-relaxed text-slate-600">
        Self-paced training across Connect, Enroll, and Deliver.
      </span>
    );
  }, [pathname, resourcesRoot, vaultRoot, classroomRoot]);

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
