"use client";

import { useMemo } from "react";

import { useOptimisticPathname } from "@/hooks/useOptimisticPathname";
import {
  PageHeaderUnderlineTabs,
  type PageHeaderUnderlineTabItem,
} from "@/components/layout/PageHeaderUnderlineTabs";

/** The info text beside the Academy title, the same on every tab. */
export const ACADEMY_INFO =
  "Learning and other coaches, all in one place. Community is where you share wins and ask questions. Classroom is the programme, step by step, with the Vault at the bottom. Calendar has the live calls and recordings. Resources has templates, sheets and guides.";

/**
 * The one tab row on every Academy page. Community and Calendar live under
 * /community, Classroom and Resources under /academy; Vault courses count as
 * Classroom.
 */
export function AcademyTabs() {
  const { pathname, markPending } = useOptimisticPathname();
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";

  const items = useMemo(() => {
    const under = (root: string) => pathname === root || pathname.startsWith(`${root}/`);
    const communityRoot = `${prefix}/community`;
    const calendarRoot = `${prefix}/community/calendar`;
    const classroomRoot = `${prefix}/academy/classroom`;
    const resourcesRoot = `${prefix}/academy/resources`;

    const isCalendar = under(calendarRoot);
    const isResources = under(resourcesRoot);

    const tab = (
      href: string,
      label: string,
      description: string,
      active: boolean
    ): PageHeaderUnderlineTabItem => ({
      kind: "link",
      href,
      label,
      description,
      active,
      scroll: false,
      onNavigate: () => markPending(href),
    });

    return [
      tab(
        communityRoot,
        "Community",
        "Posts, wins and questions from other coaches",
        under(communityRoot) && !isCalendar
      ),
      tab(
        classroomRoot,
        "Classroom",
        "The programme, lesson by lesson, plus the Vault",
        under(`${prefix}/academy`) && !isResources
      ),
      tab(calendarRoot, "Calendar", "Live calls, trainings and recordings", isCalendar),
      tab(resourcesRoot, "Resources", "Templates, sheets and guides", isResources),
    ];
  }, [pathname, prefix, markPending]);

  return <PageHeaderUnderlineTabs items={items} ariaLabel="Academy" />;
}
