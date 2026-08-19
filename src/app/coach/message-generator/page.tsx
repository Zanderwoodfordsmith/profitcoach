"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  PageHeaderUnderlineTabs,
  StickyPageHeader,
} from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { ProfitCoachAiWorkspace } from "@/components/profitCoachAi/ProfitCoachAiWorkspace";
import type { ProfitCoachAiTab } from "@/components/profitCoachAi/ProfitCoachAiWorkspace";
import { StudioHubOverview } from "@/components/profitCoachAi/StudioHubOverview";
import {
  parseStudioSkillParam,
  studioDisplayTitle,
} from "@/lib/profitCoachAi/studioHub";

function parseProfitCoachAiTab(search: string | null): ProfitCoachAiTab {
  if (search === "brain") return "brain";
  return "chat";
}

function StudioPageContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAdmin = pathname.startsWith("/admin");
  const basePath = isAdmin
    ? "/admin/message-generator"
    : "/coach/message-generator";
  const activeTab = parseProfitCoachAiTab(searchParams.get("tab"));
  const skillId = parseStudioSkillParam(searchParams.get("skill"));
  const showHub = activeTab === "chat" && !skillId;

  const workspaceSubTabs = useMemo(
    () => (
      <PageHeaderUnderlineTabs
        ariaLabel="Create sections"
        items={[
          {
            kind: "link",
            href: skillId
              ? `${basePath}?skill=${encodeURIComponent(skillId)}`
              : basePath,
            label: skillId ? studioDisplayTitle(skillId) : "Create",
            active: activeTab === "chat",
            scroll: false,
          },
          {
            kind: "link",
            href: `${basePath}?tab=brain`,
            label: "Your brain",
            active: activeTab === "brain",
            scroll: false,
          },
        ]}
      />
    ),
    [basePath, activeTab, skillId],
  );

  const title = isAdmin
    ? "Get Clients"
    : showHub
      ? "Create"
      : skillId
        ? studioDisplayTitle(skillId)
        : "Your brain";

  const description = showHub
    ? undefined
    : activeTab === "brain"
      ? "Saved context every tool here can use: superpowers, proof, and who you help."
      : "Draft, tweak, and save. Open past work from the chats panel.";

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col gap-4">
      <StickyPageHeader
        title={title}
        description={description}
        tabs={isAdmin ? <CoachToolsHubTabs hub="get-clients" /> : workspaceSubTabs}
        below={
          isAdmin ? (
            showHub ? undefined : (
              <div className="flex flex-col gap-2">
                {skillId || activeTab === "brain" ? (
                  <Link
                    href={basePath}
                    className="w-fit text-sm font-medium text-sky-800 hover:text-sky-950"
                  >
                    ← All tools
                  </Link>
                ) : null}
                {workspaceSubTabs}
              </div>
            )
          ) : showHub ? undefined : (
            <Link
              href={basePath}
              className="w-fit text-sm font-medium text-sky-800 hover:text-sky-950"
            >
              ← All tools
            </Link>
          )
        }
      />

      {showHub ? (
        <StudioHubOverview basePath={basePath} />
      ) : (
        <div
          className="flex min-h-0 min-h-[32rem] flex-1 flex-col overflow-hidden rounded-2xl border border-white/70 shadow-xl shadow-slate-200/40"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(14,165,233,0.08), transparent), linear-gradient(to bottom right, rgb(248 250 252), rgba(240,249,255,0.45), rgb(241 245 249))",
          }}
        >
          <ProfitCoachAiWorkspace
            activeTab={activeTab}
            basePath={basePath}
            lockedOutputId={skillId}
          />
        </div>
      )}
    </div>
  );
}

export default function CoachMessageGeneratorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100dvh-4rem)] flex-col gap-4">
          <StickyPageHeader title="Create" />
          <p className="text-sm text-slate-600">Loading…</p>
        </div>
      }
    >
      <StudioPageContent />
    </Suspense>
  );
}
