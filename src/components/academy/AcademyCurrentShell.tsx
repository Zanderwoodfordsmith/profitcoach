"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers2 } from "lucide-react";
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

  const showAdminTabs = prefix === "/admin" || coachIsAdmin;

  const programsRoot = `${prefix}/academy/programs`;
  const resourcesRoot = `${prefix}/academy/resources`;
  const simplifiedRoot = `${prefix}/academy/simplified`;
  const classroomPath = `${prefix}/academy/classroom`;

  const tabItems = useMemo(() => {
    const isResources =
      pathname === resourcesRoot || pathname.startsWith(`${resourcesRoot}/`);
    const isProg =
      pathname === programsRoot || pathname.startsWith(`${programsRoot}/`);
    const isSimplified =
      pathname === simplifiedRoot || pathname.startsWith(`${simplifiedRoot}/`);

    const items: PageHeaderUnderlineTabItem[] = [
      {
        kind: "link",
        href: programsRoot,
        label: "Current",
        active: isProg,
        scroll: false,
      },
      {
        kind: "link",
        href: resourcesRoot,
        label: "Resources",
        active: isResources,
        scroll: false,
      },
    ];

    if (showAdminTabs) {
      items.push({
        kind: "link",
        href: simplifiedRoot,
        label: (
          <span className="inline-flex items-center gap-1.5">
            <Layers2 className="h-3.5 w-3.5 opacity-45" aria-hidden />
            Simplified
          </span>
        ),
        active: isSimplified,
        scroll: false,
        variant: "subtle",
      });
    }

    return items;
  }, [
    pathname,
    showAdminTabs,
    programsRoot,
    resourcesRoot,
    simplifiedRoot,
  ]);

  const description = useMemo(() => {
    if (pathname.startsWith(resourcesRoot)) {
      return (
        <span className="text-lg leading-relaxed text-slate-600">
          Worksheets, SOPs, templates, and reference links for coach delivery and the Profit
          System — searchable and grouped by topic.
        </span>
      );
    }
    if (pathname.startsWith(programsRoot)) {
      return (
        <span className="text-lg leading-relaxed text-slate-600">
          Seven Business Coach Academy programmes on Disco. Open a programme to browse categories
          and lessons — each lesson links through to the matching page when you are ready.
        </span>
      );
    }
    if (pathname.startsWith(simplifiedRoot)) {
      return (
        <span className="text-lg leading-relaxed text-slate-500">
          Admin preview of a streamlined classroom: Start Here, then Get Calls, Win Clients,
          Coach Clients, and Profit Coach OS.
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
  }, [pathname, programsRoot, resourcesRoot, simplifiedRoot, classroomPath]);

  const isSimplified =
    pathname === simplifiedRoot || pathname.startsWith(`${simplifiedRoot}/`);

  return (
    <div
      className={
        isSimplified
          ? "relative isolate -mx-4 flex min-h-[calc(100vh-1.5rem)] flex-col gap-6 px-4 md:-mx-[60px] md:px-[60px]"
          : "flex flex-col gap-6"
      }
    >
      {isSimplified ? (
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
    </div>
  );
}
