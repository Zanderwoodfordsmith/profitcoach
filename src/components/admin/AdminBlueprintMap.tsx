"use client";

import { Fragment, useState } from "react";
import { ChevronRight } from "lucide-react";

import { PageHeaderDescriptionInfo } from "@/components/layout/PageHeaderDescriptionInfo";
import {
  BLUEPRINT_GROUPS,
  BLUEPRINT_PAGES,
  SECTION_SOURCES,
  type SectionSource,
} from "@/lib/practiceKnowledge/blueprint";

const SOURCE_KEYS = Object.keys(SECTION_SOURCES) as SectionSource[];

const SOURCE_CLASS: Record<SectionSource, string> = {
  imported: "bg-amber-50 text-amber-800 ring-amber-200",
  from_you: "bg-sky-50 text-sky-800 ring-sky-200",
  we_build: "bg-violet-50 text-violet-800 ring-violet-200",
  standard: "bg-slate-50 text-slate-700 ring-slate-200",
  live: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

const PAGE_NOTES: Record<string, string> = {
  command: "Reads from every page and picks the one next action.",
  blueprint: "Collects every Imported and From you section into one document the coach reviews.",
};

/** Sticks under the Blueprint page header (height set by the layout). */
const STICKY_TH =
  "sticky top-[var(--blueprint-header-h,0px)] z-10 border-y border-slate-200 bg-slate-50 px-4 py-2 font-medium";

/** Side borders, so the gaps between groups can stay transparent. */
const EDGE_L = "border-l border-slate-200";
const EDGE_R = "border-r border-slate-200";
const EDGES = `${EDGE_L} ${EDGE_R}`;

function SourceTag({ source }: { source: SectionSource }) {
  return (
    <span
      title={SECTION_SOURCES[source].hint}
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${SOURCE_CLASS[source]}`}
    >
      {SECTION_SOURCES[source].label}
    </span>
  );
}

export function AdminBlueprintMap() {
  const [filter, setFilter] = useState<SectionSource | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  function toggleGroup(label: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const allCollapsed = collapsed.size === BLUEPRINT_GROUPS.length;
  const allSections = BLUEPRINT_PAGES.flatMap((page) => page.sections);

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${
      active ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-300"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by type">
        <button type="button" aria-pressed={filter === null} onClick={() => setFilter(null)} className={pill(filter === null)}>
          All <span className="opacity-60">{allSections.length}</span>
        </button>
        {SOURCE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(filter === key ? null : key)}
            title={SECTION_SOURCES[key].hint}
            className={pill(filter === key)}
          >
            {SECTION_SOURCES[key].label}{" "}
            <span className="opacity-60">{allSections.filter((s) => s.source === key).length}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(BLUEPRINT_GROUPS.map((g) => g.label)))}
          className="ml-auto rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          {allCollapsed ? "Expand all" : "Collapse all"}
        </button>
      </div>

      <div className="overflow-x-auto lg:overflow-visible">
        <table className="w-full min-w-[44rem] border-separate border-spacing-0 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className={`${STICKY_TH} ${EDGE_L} w-[30%] rounded-tl-xl`}>Section</th>
              <th className={`${STICKY_TH} w-[11%]`}>Type</th>
              <th className={`${STICKY_TH} w-[32%]`}>Built from</th>
              <th className={`${STICKY_TH} ${EDGE_R} rounded-tr-xl`}>Goes to</th>
            </tr>
          </thead>
          <tbody>
            {BLUEPRINT_GROUPS.map((group, index) => {
              const pages = group.pages
                .map((page) => ({
                  page,
                  sections: filter ? page.sections.filter((s) => s.source === filter) : page.sections,
                }))
                .filter(({ sections }) => !filter || sections.length);
              if (!pages.length) return null;
              const open = !collapsed.has(group.label);
              const count = pages.reduce((n, { sections }) => n + sections.length, 0);
              return (
                <Fragment key={group.label}>
                  {index > 0 ? (
                    <tr aria-hidden>
                      <td colSpan={4} className="h-8 bg-transparent" />
                    </tr>
                  ) : null}
                  <tr>
                    <td colSpan={4} className={`border-y border-slate-200 bg-slate-100 p-0 ${EDGES}`}>
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => toggleGroup(group.label)}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.08em] text-slate-600 hover:text-slate-900"
                      >
                        <ChevronRight
                          aria-hidden
                          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
                        />
                        {group.label}
                        <span className="font-medium normal-case tracking-normal text-slate-400">
                          {pages.length} {pages.length === 1 ? "page" : "pages"} · {count}{" "}
                          {count === 1 ? "section" : "sections"}
                        </span>
                      </button>
                    </td>
                  </tr>
                  {open && pages.map(({ page, sections }) => (
                    <Fragment key={page.slug}>
                      <tr>
                        <td colSpan={4} className={`border-b border-slate-100 bg-white px-4 pb-1.5 pt-3 ${EDGES}`}>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900">{page.title}</span>
                            <PageHeaderDescriptionInfo>{page.summary}</PageHeaderDescriptionInfo>
                            {!sections.length ? (
                              <span className="ml-2 text-slate-500">{PAGE_NOTES[page.slug] ?? "No sections yet."}</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {sections.map((section) => (
                        <tr key={section.id} className="align-top">
                          <td className={`border-b border-slate-100 bg-white py-2 pl-8 pr-4 text-slate-800 ${EDGE_L}`}>{section.title}</td>
                          <td className="border-b border-slate-100 bg-white px-4 py-2">
                            <SourceTag source={section.source} />
                          </td>
                          <td className="border-b border-slate-100 bg-white px-4 py-2 text-slate-600">
                            {section.from?.join(" · ") || "—"}
                          </td>
                          <td className={`border-b border-slate-100 bg-white px-4 py-2 text-slate-600 ${EDGE_R}`}>{section.feeds || "—"}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
