"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { AdminBlueprintFlow } from "@/components/admin/AdminBlueprintFlow";
import { PageHeaderUnderlineTabs, StickyPageHeader } from "@/components/layout";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import type { AvaCatalog, AvaFileRecord } from "@/lib/agent/avaCatalog";

import { AvaDocument } from "./AvaDocument";

const TABS = [
  { key: "structure", label: "Structure" },
  { key: "skills", label: "Skills" },
  { key: "knowledge", label: "Knowledge" },
  { key: "flow", label: "Flow" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

type NavPage = {
  id: string;
  label: string;
  fileId?: string;
  href?: string;
};

type NavSection = { id: string; label: string; pages: NavPage[] };

function isTab(raw: string | null): TabKey {
  return TABS.some((t) => t.key === raw) ? (raw as TabKey) : "structure";
}

function flattenPages(sections: NavSection[]): NavPage[] {
  return sections.flatMap((section) => section.pages);
}

function skillsNav(catalog: AvaCatalog): NavSection[] {
  return catalog.groups
    .map((group) => {
      const pages = group.capabilityIds
        .map((id) => catalog.capabilities.find((c) => c.id === id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map((cap) => ({
          id: cap.id,
          label: cap.title,
          fileId: cap.fileId,
        }));
      return { id: group.id, label: group.title, pages };
    })
    .filter((section) => section.pages.length);
}

function structureNav(): NavSection[] {
  return [
    {
      id: "always",
      label: "Always on",
      pages: [
        { id: "identity", label: "Identity", fileId: "agent/AGENT.md" },
        { id: "router", label: "Router", fileId: "agent/ROUTER.md" },
      ],
    },
    {
      id: "coach",
      label: "This coach",
      pages: [{ id: "flow", label: "Blueprint flow", href: "/admin/ava?tab=flow" }],
    },
  ];
}

function knowledgeNav(catalog: AvaCatalog): NavSection[] {
  const groups: { id: AvaFileRecord["kind"]; label: string }[] = [
    { id: "reference", label: "References" },
    { id: "practice-skill", label: "Classroom method" },
    { id: "brand", label: "Shared with Brand" },
    { id: "code", label: "In code" },
  ];
  return groups
    .map((group) => ({
      id: group.id,
      label: group.label,
      pages: catalog.files
        .filter((f) => f.kind === group.id)
        .map((f) => ({ id: f.id, label: f.label, fileId: f.id })),
    }))
    .filter((section) => section.pages.length);
}

function navFor(tab: TabKey, catalog: AvaCatalog): NavSection[] {
  if (tab === "skills") return skillsNav(catalog);
  if (tab === "knowledge") return knowledgeNav(catalog);
  return structureNav();
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const headers = await getCoachAuthHeaders(null);
  if (!headers) return null;
  delete headers["x-impersonate-coach-id"];
  return headers;
}

function NavLink({
  page,
  current,
  onOpen,
}: {
  page: NavPage;
  current: boolean;
  onOpen: (page: NavPage) => void;
}) {
  return (
    <button
      type="button"
      aria-current={current ? "page" : undefined}
      onClick={() => onOpen(page)}
      className={`flex w-full items-start rounded-[7px] px-2.5 py-1.5 text-left text-sm leading-snug ${
        current
          ? "bg-[#e0f2fe] font-semibold text-[#075985]"
          : "text-[#334155] hover:bg-[#eef2f7] hover:text-[#0f172a]"
      }`}
    >
      {page.label}
    </button>
  );
}

export function AvaAdmin() {
  const router = useRouter();
  const search = useSearchParams();
  const tab = isTab(search.get("tab"));
  const openId = search.get("open");

  const [catalog, setCatalog] = useState<AvaCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setLocation = useCallback(
    (nextTab: TabKey, open?: string | null) => {
      const params = new URLSearchParams();
      if (nextTab !== "structure") params.set("tab", nextTab);
      if (open) params.set("open", open);
      const q = params.toString();
      router.replace(q ? `/admin/ava?${q}` : "/admin/ava", { scroll: false });
    },
    [router]
  );

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) {
      setError("Sign in again to load Ava.");
      return;
    }
    const res = await fetch("/api/admin/ava/context", { headers });
    const body = (await res.json().catch(() => null)) as AvaCatalog | { error?: string } | null;
    if (!res.ok || !body || !("files" in body)) {
      setError((body as { error?: string } | null)?.error ?? "Could not load Ava.");
      return;
    }
    setError(null);
    setCatalog(body);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo(() => (catalog && tab !== "flow" ? navFor(tab, catalog) : []), [catalog, tab]);
  const pages = useMemo(() => flattenPages(sections), [sections]);
  const selected = pages.find((p) => p.fileId === openId || p.id === openId) ?? pages[0] ?? null;
  const selectedFile = selected?.fileId ? catalog?.files.find((f) => f.id === selected.fileId) : null;
  const selectedCap = catalog?.capabilities.find((c) => c.fileId === selectedFile?.id);

  useEffect(() => {
    if (!catalog || tab === "flow" || openId || !pages[0]?.fileId) return;
    setLocation(tab, pages[0].fileId);
  }, [catalog, tab, openId, pages, setLocation]);

  function openPage(page: NavPage) {
    if (page.href) {
      router.replace(page.href, { scroll: false });
      return;
    }
    if (page.fileId) setLocation(tab, page.fileId);
  }

  const meta = selectedCap
    ? `${selectedCap.modes.join(" · ")} · ${selectedCap.id}`
    : selectedFile
      ? selectedFile.kind
      : undefined;

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
              onClick: () => {
                if (t.key === "flow") setLocation("flow");
                else setLocation(t.key);
              },
            }))}
          />
        }
      />

      {error ? <p className="px-5 py-6 text-sm text-rose-700">{error}</p> : null}
      {!catalog && !error ? (
        <p className="flex items-center gap-2 px-5 py-6 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading Ava…
        </p>
      ) : null}

      {catalog && tab === "flow" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AdminBlueprintFlow />
        </div>
      ) : null}

      {catalog && tab !== "flow" ? (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="w-full shrink-0 border-b border-slate-200/70 bg-[#f8fafc] lg:h-full lg:w-[16.5rem] lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <nav aria-label="Ava pages" className="space-y-1 px-3 py-4">
              {sections.map((section) => (
                <div key={section.id} className="pt-3.5 first:pt-0">
                  <p className="px-2.5 pb-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">
                    {section.label}
                  </p>
                  <ul>
                    {section.pages.map((page) => (
                      <li key={page.id}>
                        <NavLink
                          page={page}
                          current={selected?.id === page.id || selected?.fileId === page.fileId}
                          onOpen={openPage}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          <section className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            {selectedFile ? (
              <AvaDocument
                file={selectedFile}
                title={selected?.label ?? selectedFile.label}
                summary={selectedCap?.summary ?? selectedFile.description}
                meta={meta}
                onCatalog={setCatalog}
              />
            ) : (
              <p className="px-5 py-8 text-sm text-slate-600">Pick a page.</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
