"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { AdminArchiveLink } from "@/components/academy/AdminArchiveLink";
import {
  PageHeaderUnderlineTabs,
  type PageHeaderUnderlineTabItem,
} from "@/components/layout/PageHeaderUnderlineTabs";
import { StickyPageHeader } from "@/components/layout";

export function ClassroomShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";

  const archiveRoot = `${prefix}/academy/archive`;
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
      {
        kind: "link",
        href: actionsRoot,
        label: "My Actions",
        active: isActions,
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
          Your personal actions plus any setup tasks assigned to you by the team.
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
    if (pathname.startsWith(archiveRoot)) {
      return (
        <span className="text-lg leading-relaxed text-slate-500">
          Archive of lessons that are not on the Classroom hub. Classroom content is unchanged —
          this is only what the hub does not surface.
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
    archiveRoot,
    resourcesRoot,
    classroomRoot,
    compassModulesRoot,
    compassRoot,
    actionsRoot,
  ]);

  const isClassroom =
    pathname === classroomRoot || pathname.startsWith(`${classroomRoot}/`);

  return (
    <div
      className={
        isClassroom
          ? "relative isolate -mx-4 flex min-h-[calc(100vh-1.5rem)] flex-col gap-6 px-4 md:-mx-[60px] md:px-[60px]"
          : "flex flex-col gap-6"
      }
    >
      {isClassroom ? (
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="absolute inset-0 bg-[#e9eef4]" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#f7f9fb_0%,#eef3f8_38%,#e4edf6_72%,#dce8f3_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(255,255,255,0.7),transparent_34%),radial-gradient(circle_at_88%_18%,rgba(148,186,224,0.18),transparent_40%),radial-gradient(circle_at_70%_82%,rgba(125,176,214,0.14),transparent_42%)]" />
        </div>
      ) : null}
      <StickyPageHeader
        title="Classroom"
        tabs={<PageHeaderUnderlineTabs items={tabItems} ariaLabel="Classroom area" />}
        description={description}
      />
      {children}
      {isClassroom ? <AdminArchiveLink /> : null}
    </div>
  );
}
