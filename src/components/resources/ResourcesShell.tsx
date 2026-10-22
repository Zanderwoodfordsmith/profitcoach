"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, LayoutGrid, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";

import { useImpersonation } from "@/contexts/ImpersonationContext";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import type { ResourceGroup, ResourcePage } from "@/lib/resources/library";
import { RESOURCE_GROUPS } from "@/lib/resources/libraryPublic";

import { PILLARS, PageKindIcon, SECTIONS, SearchTextProvider, Snippet, groupsIn, useLibrarySearch } from "./librarySearch";
import "../practice/document/blueprint.css";
import "./resources.css";

const NAV_KEY = "resources-nav-open";
const NAV_EVENT = "resources-nav-change";

/** Whether the contents rail is open, remembered per browser. */
function useNavOpen() {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener(NAV_EVENT, onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(NAV_EVENT, onChange);
      };
    },
    () => {
      try {
        return window.localStorage.getItem(NAV_KEY) !== "0";
      } catch {
        return true;
      }
    },
    () => true
  );
}

/**
 * The Resources frame, built the way the Practice Blueprint is: a quiet contents rail on the left,
 * flush under the Classroom header, and the page on the app canvas beside it.
 */
export function ResourcesShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
  const base = `${prefix}/academy/resources`;
  const here = pathname.slice(base.length + 1).split("/")[0] ?? "";
  const navOpen = useNavOpen();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const { impersonatingCoachId } = useImpersonation();
  // Page text for the search loads after sign-in, never with the page itself.
  const [searchText, setSearchText] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers || cancelled) return;
      const res = await fetch("/api/academy/resources?search=1", { headers }).catch(() => null);
      const body = (await res?.json().catch(() => null)) as { searchText?: Record<string, string> } | null;
      if (!cancelled && body?.searchText) setSearchText(body.searchText);
    })();
    return () => {
      cancelled = true;
    };
  }, [impersonatingCoachId]);

  // The old link list keeps its own full-width table.
  if (here === "list") return <>{children}</>;

  function toggleNav() {
    try {
      window.localStorage.setItem(NAV_KEY, navOpen ? "0" : "1");
    } catch {
      // Private windows can refuse storage; the rail then stays open.
    }
    window.dispatchEvent(new Event(NAV_EVENT));
  }

  return (
    <SearchTextProvider value={searchText}>
      <div className="bp-doc app-canvas-bg -mx-4 -mb-6 -mt-6 flex min-h-[calc(100dvh-57px)] flex-col md:-mx-[60px] lg:flex-row lg:items-stretch print:m-0 print:bg-white">
        <aside
          className={`rs-no-print relative shrink-0 border-b border-slate-200 bg-white lg:sticky lg:top-[57px] lg:h-[calc(100dvh-57px)] lg:self-start lg:border-b-0 lg:border-r ${
            navOpen ? "lg:w-[17.3rem]" : "lg:w-14"
          }`}
        >
          <div className="lg:h-full lg:overflow-y-auto lg:overscroll-y-none">
            <div className={`flex items-center gap-2 border-b border-slate-200/70 px-3 py-3 ${navOpen ? "justify-between" : "lg:justify-center"}`}>
              <Link
                href={base}
                className={`text-[0.8125rem] font-semibold text-[#0f172a] hover:text-[#0c5290] ${navOpen ? "" : "lg:hidden"}`}
              >
                The Resource Library
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen((open) => !open)}
                aria-expanded={mobileOpen}
                className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.8125rem] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
              >
                Contents
                <ChevronDown className={`h-4 w-4 transition-transform ${mobileOpen ? "rotate-180" : ""}`} aria-hidden />
              </button>
              <button
                type="button"
                onClick={toggleNav}
                aria-expanded={navOpen}
                aria-label={navOpen ? "Collapse contents" : "Expand contents"}
                className="hidden rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:inline-flex"
              >
                {navOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </button>
            </div>
            <div
              className={`px-3 py-4 ${mobileOpen ? "block" : "hidden"} ${navOpen ? "lg:block" : "lg:hidden"}`}
              // On a phone the contents fold away again once a page is picked.
              onClickCapture={(e) => {
                if ((e.target as HTMLElement).closest("a")) setMobileOpen(false);
              }}
            >
              <Contents
                base={base}
                here={here}
                query={query}
                setQuery={setQuery}
                toggled={toggled}
                onToggle={(key, open) => setToggled((t) => ({ ...t, [key]: open }))}
              />
            </div>
          </div>
        </aside>

        <section className="rs-print-root @container flex min-w-0 flex-1 flex-col">{children}</section>
      </div>
    </SearchTextProvider>
  );
}

const ROW = "flex min-w-0 flex-1 items-start gap-2 rounded-[7px] px-2.5 py-1.5 text-sm leading-snug";
const ROW_IDLE = "text-[#475569] hover:bg-[#f1f5f9] hover:text-[#0f172a]";
const ROW_CURRENT = "bg-[#e0f2fe] font-semibold text-[#075985]";
const COUNT = "text-xs font-medium tabular-nums text-[#94a3b8]";

function Contents({
  base,
  here,
  query,
  setQuery,
  toggled,
  onToggle,
}: {
  base: string;
  here: string;
  query: string;
  setQuery: (q: string) => void;
  toggled: Record<string, boolean>;
  onToggle: (key: string, open: boolean) => void;
}) {
  const { words, results, searchText } = useLibrarySearch(query, null);
  const current = RESOURCE_GROUPS.find((g) => g.pages.some((p) => p.slug === here)) ?? null;

  const row = (p: ResourcePage) => (
    <Link
      href={`${base}/${p.slug}`}
      aria-current={p.slug === here ? "page" : undefined}
      className={`${ROW} ${p.slug === here ? ROW_CURRENT : ROW_IDLE}`}
    >
      <PageKindIcon page={p} className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">{p.title}</span>
    </Link>
  );

  // Only the folder you're in opens by itself; a section with a single folder opens it too.
  const folder = (group: ResourceGroup, alone: boolean) => {
    const key = `group:${group.title}`;
    const open = toggled[key] ?? (current === group || alone);
    return (
      <div key={group.title}>
        <button
          type="button"
          onClick={() => onToggle(key, !open)}
          aria-expanded={open}
          className="flex w-full items-center gap-1.5 rounded-[7px] px-2 py-1.5 text-left text-sm font-medium text-[#1e293b] hover:bg-[#f1f5f9]"
        >
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-[#94a3b8] transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
          <span className="min-w-0 flex-1">{group.title}</span>
          <span className={COUNT}>{group.pages.length}</span>
        </button>
        {open ? (
          <ul className="mb-1 ml-[0.85rem] border-l border-slate-200 pl-1.5">
            {group.pages.map((p) => (
              <li key={p.slug} className="flex">
                {row(p)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <label className="relative block">
        <span className="sr-only">Search resources</span>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search inside resources"
          className="w-full rounded-[7px] border border-slate-200 bg-[#f8fafc] py-1.5 pl-8 pr-2.5 text-sm text-[#0f172a] outline-none placeholder:text-[#64748b] focus:border-[#7cc0ef] focus:bg-white focus:ring-2 focus:ring-[#1a8fd4]/20"
        />
      </label>

      {results ? (
        <div>
          <p className="px-2.5 pb-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">
            {results.length === 0 ? "Nothing found" : `${results.length} ${results.length === 1 ? "page" : "pages"}`}
          </p>
          <ul>
            {results.map((p) => (
              <li key={p.slug}>
                <Link href={`${base}/${p.slug}`} onClick={() => setQuery("")} className={`${ROW} ${ROW_IDLE} flex-col gap-0.5`}>
                  <span className="font-medium text-[#0f172a]">{p.title}</span>
                  <span className="text-xs leading-relaxed text-[#64748b]">
                    <Snippet text={searchText[p.slug] ?? ""} words={words} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <nav aria-label="Resources">
          <Link href={base} aria-current={here === "" ? "page" : undefined} className={`flex ${ROW} ${here === "" ? ROW_CURRENT : ROW_IDLE}`}>
            <LayoutGrid className="mt-0.5 h-4 w-4 shrink-0 text-[#0c5290]" aria-hidden />
            <span>Overview</span>
          </Link>
          <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
            {SECTIONS.map((section) => {
              const groups = groupsIn(section.title);
              if (groups.length === 0) return null;
              const key = `section:${section.title}`;
              const open = toggled[key] ?? current?.section === section.title;
              const total = groups.reduce((n, g) => n + g.pages.length, 0);
              return (
                <div key={section.title}>
                  <button
                    type="button"
                    onClick={() => onToggle(key, !open)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-sm font-semibold text-[#0f172a] hover:bg-[#f1f5f9]"
                  >
                    <section.icon className="h-4 w-4 shrink-0 text-[#0c5290]" aria-hidden />
                    <span className="min-w-0 flex-1">{section.title}</span>
                    <span className={COUNT}>{total}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-[#94a3b8] transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden />
                  </button>
                  {open ? (
                    <div className="mb-2 ml-[1.15rem] border-l border-slate-200 pl-1.5">
                      {section.title === "Profit System"
                        ? PILLARS.map((pillar) => {
                            const inPillar = groups.filter((g) => g.pillar === pillar);
                            if (inPillar.length === 0) return null;
                            return (
                              <div key={pillar} className="pt-2 first:pt-1">
                                <p className="px-2 pb-0.5 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[#94a3b8]">{pillar}</p>
                                {inPillar.map((g) => folder(g, false))}
                              </div>
                            );
                          })
                        : groups.map((g) => folder(g, groups.length === 1))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="pt-5">
            <Link href={`${base}/list`} className="block px-2.5 text-xs text-[#64748b] hover:text-[#0f172a]">
              The old Resources list
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
