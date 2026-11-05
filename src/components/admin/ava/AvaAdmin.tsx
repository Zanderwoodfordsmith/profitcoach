"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { AdminBlueprintBoxes } from "@/components/admin/AdminBlueprintBoxes";
import { AdminBlueprintFlow } from "@/components/admin/AdminBlueprintFlow";
import { AvaDesignBoard } from "@/components/avaDesign/AvaDesignBoard";
import { PageHeaderUnderlineTabs, StickyPageHeader } from "@/components/layout";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import type { AvaCatalog } from "@/lib/agent/avaCatalog";

import { AvaBrainTab } from "./AvaBrainTab";
import { AvaIntakeTab } from "./AvaIntakeTab";
import { AvaKnowledgeFile, AvaKnowledgeTab } from "./AvaKnowledgeTab";
import { AvaNudgeQueue } from "./AvaNudgeQueue";
import { AvaSkillPage, AvaSkillsTab } from "./AvaSkillsTab";

const TABS = [
  { key: "brain", label: "Brain" },
  { key: "knowledge", label: "Knowledge" },
  { key: "skills", label: "Skills" },
  { key: "intake", label: "Intake" },
  { key: "nudges", label: "Nudges" },
  { key: "flow", label: "Flow" },
  { key: "boxes", label: "Boxes" },
  { key: "design", label: "Design" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const DEFAULT_TAB: TabKey = "knowledge";

/** Links from before the tidy (2 Nov): the old view's tabs and the first new keys. */
const OLD_KEYS: Record<string, TabKey> = { files: "knowledge", access: "skills", structure: "brain" };

function toTab(raw: string | null): TabKey {
  if (raw && OLD_KEYS[raw]) return OLD_KEYS[raw];
  return TABS.some((t) => t.key === raw) ? (raw as TabKey) : DEFAULT_TAB;
}

export function AvaAdmin() {
  const router = useRouter();
  const search = useSearchParams();
  const tab = toTab(search.get("tab"));
  // ?skill= is the old Skills link to one skill.
  const openId = search.get("open") ?? search.get("skill");

  const [catalog, setCatalog] = useState<AvaCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = useCallback(
    (nextTab: TabKey, open?: string | null) => {
      const params = new URLSearchParams();
      if (nextTab !== DEFAULT_TAB) params.set("tab", nextTab);
      if (open) params.set("open", open);
      const q = params.toString();
      router.push(q ? `/admin/ava?${q}` : "/admin/ava", { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    let live = true;
    void (async () => {
      const headers = await getCoachAuthHeaders(null);
      if (!live) return;
      if (!headers) {
        setError("Sign in again to load Ava.");
        return;
      }
      delete headers["x-impersonate-coach-id"];
      const res = await fetch("/api/admin/ava/context", { headers });
      const body = (await res.json().catch(() => null)) as AvaCatalog | { error?: string } | null;
      if (!live) return;
      if (!res.ok || !body || !("files" in body)) {
        setError((body as { error?: string } | null)?.error ?? "Could not load Ava.");
        return;
      }
      setError(null);
      setCatalog(body);
    })();
    return () => {
      live = false;
    };
  }, []);

  const scroll = (node: React.ReactNode) => <div className="min-h-0 flex-1 overflow-y-auto">{node}</div>;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <StickyPageHeader
        title="Ava"
        description="How she thinks, the skills she can open, and the files she loads. Edits go live on her next turn."
        bleedInset="px-4 md:px-6"
        tabs={
          <PageHeaderUnderlineTabs
            ariaLabel="Ava views"
            items={TABS.map((t) => ({
              kind: "button" as const,
              id: t.key,
              label: t.label,
              active: tab === t.key,
              onClick: () => go(t.key),
            }))}
          />
        }
      />

      {error ? <p className="px-5 py-6 text-sm text-rose-700">{error}</p> : null}
      {!catalog && !error && tab !== "intake" && tab !== "nudges" && tab !== "design" ? (
        <p className="flex items-center gap-2 px-5 py-6 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading Ava…
        </p>
      ) : null}

      {catalog && tab === "brain" ? (
        <AvaBrainTab catalog={catalog} openId={openId} onOpen={(id) => go("brain", id)} onCatalog={setCatalog} />
      ) : null}

      {catalog && tab === "knowledge"
        ? openId
          ? (
              <AvaKnowledgeFile
                catalog={catalog}
                openId={openId}
                onOpen={(id) => go("knowledge", id)}
                onBack={() => go("knowledge")}
                onCatalog={setCatalog}
              />
            )
          : scroll(<AvaKnowledgeTab catalog={catalog} onOpen={(id) => go("knowledge", id)} />)
        : null}

      {catalog && tab === "skills"
        ? openId
          ? (
              <AvaSkillPage
                catalog={catalog}
                openId={openId}
                onOpen={(id) => go("skills", id)}
                onBack={() => go("skills")}
                onCatalog={setCatalog}
              />
            )
          : scroll(<AvaSkillsTab catalog={catalog} onOpen={(id) => go("skills", id)} onCatalog={setCatalog} />)
        : null}

      {tab === "intake" ? scroll(<AvaIntakeTab />) : null}
      {tab === "nudges" ? scroll(<AvaNudgeQueue />) : null}
      {catalog && tab === "flow" ? scroll(<AdminBlueprintFlow />) : null}
      {catalog && tab === "boxes" ? scroll(<AdminBlueprintBoxes />) : null}
      {tab === "design" ? scroll(<AvaDesignBoard />) : null}
    </div>
  );
}
