"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import {
  PageHeaderUnderlineTabs,
  StickyPageHeader,
} from "@/components/layout";
import { ProfitCoachAiWorkspace } from "@/components/profitCoachAi/ProfitCoachAiWorkspace";
import type { ProfitCoachAiTab } from "@/components/profitCoachAi/ProfitCoachAiWorkspace";

function parseProfitCoachAiTab(search: string | null): ProfitCoachAiTab {
  if (search === "brain") return "brain";
  return "chat";
}

function CoachMessageGeneratorContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const basePath = pathname.startsWith("/admin")
    ? "/admin/message-generator"
    : "/coach/message-generator";
  const activeTab = parseProfitCoachAiTab(searchParams.get("tab"));

  const settingsHref = pathname.startsWith("/admin")
    ? "/admin/settings"
    : "/coach/settings";

  const tabs = useMemo(
    () => (
      <PageHeaderUnderlineTabs
        ariaLabel="AI coach sections"
        items={[
          {
            kind: "link",
            href: basePath,
            label: "Chat",
            active: activeTab === "chat",
            scroll: false,
          },
          {
            kind: "link",
            href: `${basePath}?tab=brain`,
            label: "My brain",
            active: activeTab === "brain",
            scroll: false,
          },
        ]}
      />
    ),
    [basePath, activeTab],
  );

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col gap-4">
      <StickyPageHeader
        title="AI Coach"
        description="Choose a skill and optional role, then chat with Profit Coach methodology, playbook excerpts, and your saved brain context. Chats are saved; open Settings to edit superpowers, hobbies, and client results anytime."
        tabs={tabs}
        actions={
          <Link
            href={settingsHref}
            className="text-sm font-medium text-sky-700 hover:underline"
          >
            Settings
          </Link>
        }
      />

      <div
        className="flex min-h-0 min-h-[32rem] flex-1 flex-col overflow-hidden rounded-2xl border border-white/70 shadow-xl shadow-slate-200/40"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(14,165,233,0.08), transparent), linear-gradient(to bottom right, rgb(248 250 252), rgba(240,249,255,0.45), rgb(241 245 249))",
        }}
      >
        <ProfitCoachAiWorkspace activeTab={activeTab} basePath={basePath} />
      </div>
    </div>
  );
}

export default function CoachMessageGeneratorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100dvh-4rem)] flex-col gap-4">
          <StickyPageHeader title="AI Coach" />
          <p className="text-sm text-slate-600">Loading…</p>
        </div>
      }
    >
      <CoachMessageGeneratorContent />
    </Suspense>
  );
}
