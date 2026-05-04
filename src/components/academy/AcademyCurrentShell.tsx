"use client";

import { useEffect, useMemo, useState } from "react";
import { FlaskConical } from "lucide-react";
import { usePathname } from "next/navigation";

import {
  PageHeaderUnderlineTabs,
  type PageHeaderUnderlineTabItem,
} from "@/components/layout/PageHeaderUnderlineTabs";
import { StickyPageHeader } from "@/components/layout";
import { supabaseClient } from "@/lib/supabaseClient";

export function AcademyCurrentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
  const [coachIsAdmin, setCoachIsAdmin] = useState(false);

  useEffect(() => {
    if (prefix !== "/coach") {
      setCoachIsAdmin(false);
      return;
    }
    let cancelled = false;
    async function load() {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user || cancelled) return;
      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as { role?: string };
      if (!cancelled && roleBody.role === "admin") {
        setCoachIsAdmin(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [prefix]);

  const showNewTab = prefix === "/admin" || coachIsAdmin;

  const programsRoot = `${prefix}/academy/programs`;
  const newRoot = `${prefix}/academy/new`;
  const classroomPath = `${prefix}/academy/classroom`;

  const tabItems = useMemo(() => {
    const isProg = pathname === programsRoot || pathname.startsWith(`${programsRoot}/`);
    const isNew = pathname === newRoot || pathname.startsWith(`${newRoot}/`);

    const items: PageHeaderUnderlineTabItem[] = [
      {
        kind: "link",
        href: programsRoot,
        label: "Current",
        active: isProg,
        scroll: false,
      },
    ];

    if (showNewTab) {
      items.push({
        kind: "link",
        href: newRoot,
        label: (
          <span className="inline-flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5 opacity-45" aria-hidden />
            New
          </span>
        ),
        active: isNew,
        scroll: false,
        variant: "subtle",
      });
    }

    return items;
  }, [pathname, prefix, showNewTab, programsRoot, newRoot]);

  const description = useMemo(() => {
    if (pathname.startsWith(programsRoot)) {
      return (
        <span className="text-lg leading-relaxed text-slate-600">
          Seven Business Coach Academy programmes on Disco. Open a programme to browse categories
          and lessons — each lesson links through to the matching page when you are ready.
        </span>
      );
    }
    if (pathname.startsWith(newRoot)) {
      return (
        <span className="text-lg leading-relaxed text-slate-500">
          Admin preview of the in-app course grid (same catalog as the Classroom deep links).
        </span>
      );
    }
    if (pathname.startsWith(classroomPath)) {
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
  }, [pathname, programsRoot, newRoot, classroomPath]);

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
