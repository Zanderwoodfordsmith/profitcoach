"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ChevronRight, EyeOff, Info } from "lucide-react";

import {
  ALWAYS_READS,
  BLUEPRINT_GROUPS,
  type BlueprintGroup,
  type BlueprintLink,
  type BlueprintSection,
  type FieldSpec,
  sectionKey,
} from "@/lib/practiceKnowledge/blueprint";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { FIELD_WHY } from "@/lib/practiceKnowledge/fieldWhy";
import { isNewsletterOverviewKey } from "@/lib/practiceKnowledge/newsletters";
import { BLUEPRINT_OUTPUTS } from "@/lib/practiceKnowledge/outputs";
import { todoOwner, type WorkflowOwner } from "@/lib/practiceKnowledge/sectionWorkflow";

/**
 * Admin → Ava → Boxes: the Blueprint as a table. Group, page and section fold;
 * each row is one box the Blueprint asks for, or one piece BCA writes. Who it
 * waits on uses the same colours as the section pills. The newsletter and its
 * pieces live in Get Clients → Content, so they are left out.
 */

const NEWSLETTER_PIECES = new Set(["content:cover", "content:inbox", "content:post", "content:inmail", "content:article"]);

function inNewsletterTab(key: string): boolean {
  return isNewsletterOverviewKey(key) || NEWSLETTER_PIECES.has(key);
}

/** Boxes the app uses outside the writers' contracts. */
const APP_USES: Partial<Record<FieldSpec["path"], string[]>> = {
  "identity.phone": ["BCA's coach brief"],
  "identity.practice_email": ["Practice emails"],
  "identity.timezone": ["Booked calls"],
  "identity.location": ["Coach website"],
  "identity.linkedin_url": ["LinkedIn import", "Coach website"],
  "working_times.prospect_call_hours": ["Calls"],
};

/** Same looks as the section pills: the coach's To do, and BCA's quiet blue. */
const WHO_LOOK: Record<WorkflowOwner, { label: string; cls: string }> = {
  coach: { label: "Coach", cls: "bg-rose-200 text-rose-900 ring-rose-300" },
  bca: { label: "BCA", cls: "bg-sky-100 text-[#0c5290] ring-sky-200" },
};

type Row =
  | { kind: "box"; field: FieldSpec; who: WorkflowOwner; hidden: boolean; usedBy: string[]; reach: number }
  | { kind: "written"; who: WorkflowOwner; hidden: boolean; usedBy: string[]; reads: string[]; goesTo?: string };

type SectionModel = { key: string; section: BlueprintSection; rows: Row[] };
type PageModel = { page: BlueprintLink; sections: SectionModel[] };
type GroupModel = { group: BlueprintGroup; pages: PageModel[] };

function buildModel(): GroupModel[] {
  const labels = new Map<string, string>();
  const readers = new Map<string, string[]>();
  const needers = new Map<string, string[]>();
  const push = (map: Map<string, string[]>, key: string, value: string) => {
    const list = map.get(key) ?? [];
    if (!list.includes(value)) list.push(value);
    map.set(key, list);
  };
  for (const group of BLUEPRINT_GROUPS)
    for (const page of group.pages)
      for (const section of page.sections) {
        for (const field of section.fields ?? []) labels.set(field.path, field.label);
        if (section.source !== "we_build") continue;
        for (const path of section.uses?.fields ?? []) push(readers, path, section.title);
        for (const need of section.needs ?? []) push(needers, need, section.title);
      }
  // Outputs written outside the Blueprint (LinkedIn, brochure, website) declare their own reads and needs.
  for (const output of BLUEPRINT_OUTPUTS) {
    for (const path of output.uses?.fields ?? []) push(readers, path, output.title);
    for (const need of output.needs ?? []) push(needers, need, output.title);
  }
  // Written pieces by title, so a box read only by the voice guide still counts everything the guide feeds.
  const usersByTitle = new Map<string, string[]>();
  for (const group of BLUEPRINT_GROUPS)
    for (const page of group.pages)
      for (const section of page.sections)
        if (section.source === "we_build") usersByTitle.set(section.title, needers.get(sectionKey(page, section)) ?? []);
  const reachOf = (direct: string[]): number => {
    const seen = new Set<string>();
    const queue = [...direct];
    while (queue.length) {
      const name = queue.shift() as string;
      if (seen.has(name)) continue;
      seen.add(name);
      queue.push(...(usersByTitle.get(name) ?? []));
    }
    return seen.size;
  };

  return BLUEPRINT_GROUPS.map((group) => ({
    group,
    pages: group.pages
      .filter((page) => page.sections.length)
      .map((page) => ({
        page,
        sections: page.sections
          .filter((section) => !inNewsletterTab(sectionKey(page, section)))
          .map((section) => {
          const key = sectionKey(page, section);
          const who = todoOwner({ group, page, section, key });
          const hidden = section.face === "stored";
          if (section.source === "we_build") {
            const output = BLUEPRINT_OUTPUTS.find((o) => o.section === key);
            return {
              key,
              section,
              rows: [
                {
                  kind: "written" as const,
                  who,
                  hidden,
                  usedBy: needers.get(key) ?? [],
                  reads: (section.uses?.fields ?? []).map((p) => labels.get(p) ?? p),
                  goesTo: output?.goesTo,
                },
              ],
            };
          }
          return {
            key,
            section,
            rows: (section.fields ?? []).map((field) => {
              const usedBy = [
                ...(ALWAYS_READS.includes(field.path) ? ["Every writer"] : (readers.get(field.path) ?? [])),
                ...(APP_USES[field.path] ?? []),
              ];
              return { kind: "box" as const, field, who, hidden, usedBy, reach: reachOf(usedBy) };
            }),
          };
        }),
      }))
      .filter((page) => page.sections.length),
  }));
}

type Filter = "all" | "coach" | "bca" | "written" | "hidden" | "unused";

function rowMatches(row: Row, filter: Filter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "coach":
    case "bca":
      return row.who === filter;
    case "written":
      return row.kind === "written";
    case "hidden":
      return row.hidden;
    case "unused":
      return row.kind === "box" ? row.reach <= 1 : !row.usedBy.length && !row.goesTo;
  }
}

/** Opens on hover or focus. Navy, like the Blueprint's info tips. */
function Pop({ trigger, label, children, align = "left" }: { trigger: ReactNode; label: string; children: ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center"
      >
        {trigger}
      </button>
      {open ? (
        <span
          role="tooltip"
          className={`absolute top-full z-30 mt-1.5 w-72 rounded-xl bg-[#06223d] px-3.5 py-3 text-left text-ui font-normal text-white shadow-[0_14px_30px_-12px_rgba(5,30,54,0.6)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}

function InfoPop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Pop label={`About ${label}`} trigger={<Info className="h-3.5 w-3.5 text-slate-400 hover:text-[#0c5290]" aria-hidden />}>
      {children}
    </Pop>
  );
}

function PopList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <span className="block [&+&]:mt-2.5">
      <span className="block text-kicker font-semibold uppercase text-sky-200">{title}</span>
      <span className="mt-1 block space-y-0.5">
        {items.map((item) => (
          <span key={item} className="block">
            {item}
          </span>
        ))}
      </span>
    </span>
  );
}

function WhoPill({ who }: { who: WorkflowOwner }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${WHO_LOOK[who].cls}`}>
      {WHO_LOOK[who].label}
    </span>
  );
}

const USED_LOOK = "bg-slate-100 text-slate-800 hover:ring-1 hover:ring-inset hover:ring-slate-300";
/** Rose, like a To do: nothing reads it, so it may be a box to cut. */
const UNUSED_LOOK = "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200";

function UsedBy({ row }: { row: Row }) {
  const count = row.usedBy.length + (row.kind === "written" && row.goesTo ? 1 : 0);
  const badge = (
    <span
      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums ${
        count ? USED_LOOK : UNUSED_LOOK
      }`}
    >
      {count}
    </span>
  );
  return (
    <Pop label="What uses it" align="right" trigger={badge}>
      {row.kind === "written" ? (
        <>
          <PopList title="Goes to" items={row.goesTo ? [row.goesTo] : []} />
          <PopList title="Used by" items={row.usedBy} />
          <PopList title={`Reads ${row.reads.length} boxes`} items={row.reads} />
          {!count && !row.reads.length ? <span>Nothing uses it and it reads no boxes.</span> : null}
          {!count && row.reads.length ? <span className="mt-2.5 block text-sky-100">Nothing uses it.</span> : null}
        </>
      ) : count ? (
        <>
          <PopList title="Used by" items={row.usedBy} />
          {row.reach > count ? (
            <span className="mt-2.5 block text-sky-100">Through these, it reaches {row.reach - count} more.</span>
          ) : null}
        </>
      ) : (
        <span>No writer reads this box.</span>
      )}
    </Pop>
  );
}

function Chevron({ open }: { open: boolean }) {
  return <ChevronRight aria-hidden className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`} />;
}

function HiddenMark() {
  return (
    <Pop
      label="Hidden from the coach"
      trigger={
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:text-slate-800">
          <EyeOff className="h-3 w-3" aria-hidden />
        </span>
      }
    >
      The coach never sees this on their Blueprint. It is kept for the writers, or it shows somewhere else in the app.
    </Pop>
  );
}

const COLS = 5;
const CELL = "px-3 py-2.5 align-top";

export function AdminBlueprintBoxes() {
  const model = useMemo(() => buildModel(), []);
  const [filter, setFilter] = useState<Filter>("all");
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allIds = useMemo(
    () =>
      model.flatMap(({ group, pages }) => [
        `g:${group.label}`,
        ...pages.flatMap(({ page, sections }) => [`p:${page.slug}`, ...sections.filter((s) => s.rows[0]?.kind === "box").map((s) => `s:${s.key}`)]),
      ]),
    [model]
  );

  const allRows = model.flatMap((g) => g.pages.flatMap((p) => p.sections.flatMap((s) => s.rows)));
  const count = (f: Filter) => allRows.filter((row) => rowMatches(row, f)).length;
  const tiles: { key: Filter; label: string; tone?: string }[] = [
    { key: "all", label: "Everything" },
    { key: "coach", label: "Coach answers" },
    { key: "bca", label: "BCA does" },
    { key: "written", label: "Written by BCA" },
    { key: "hidden", label: "Hidden from coach" },
    { key: "unused", label: "Used once or never", tone: "text-rose-700" },
  ];

  return (
    <div className="mx-auto max-w-[92rem] px-4 py-8 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-subhead font-semibold text-slate-900">Blueprint boxes</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Every box the Blueprint asks for and every piece BCA writes, by page and section. Use it to decide what stays and what goes.
            The newsletter and its pieces live in Get Clients, Content, so they are not listed.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setClosed(new Set())} className={buttonClass("second", "small")}>
            Expand all
          </button>
          <button type="button" onClick={() => setClosed(new Set(allIds))} className={buttonClass("second", "small")}>
            Collapse all
          </button>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6" role="group" aria-label="Filter">
        {tiles.map((tile) => {
          const active = filter === tile.key;
          return (
            <button
              key={tile.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(active && tile.key !== "all" ? "all" : tile.key)}
              className={`rounded-xl px-3.5 py-3 text-left ring-1 transition-colors ${
                active ? "bg-[#06223d] text-white ring-[#06223d]" : "bg-white ring-slate-200 hover:ring-slate-300"
              }`}
            >
              <span className={`block text-2xl font-semibold tabular-nums ${active ? "text-white" : (tile.tone ?? "text-slate-900")}`}>{count(tile.key)}</span>
              <span className={`mt-0.5 block text-xs ${active ? "text-sky-100" : "text-slate-500"}`}>{tile.label}</span>
            </button>
          );
        })}
      </div>

      <div className={cardClass("plain", "mt-6 overflow-x-auto lg:overflow-visible")}>
        <table className="w-full min-w-[60rem] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[34%]" />
            <col className="w-[30%]" />
            <col className="w-[6rem]" />
            <col className="w-[5.5rem]" />
          </colgroup>
          <thead>
            <tr className="text-left text-kicker font-semibold uppercase text-slate-500">
              <th className="rounded-tl-2xl border-b border-slate-200 bg-slate-50 px-3 py-3 pl-5">Name</th>
              <th className="border-b border-slate-200 bg-slate-50 px-3 py-3">Why we need it</th>
              <th className="border-b border-slate-200 bg-slate-50 px-3 py-3">Ava asks</th>
              <th className="border-b border-slate-200 bg-slate-50 px-3 py-3">Who</th>
              <th className="rounded-tr-2xl border-b border-slate-200 bg-slate-50 px-3 py-3">Used by</th>
            </tr>
          </thead>
          <tbody>
            {model.map(({ group, pages }) => {
              const visiblePages = pages
                .map((p) => ({ ...p, sections: p.sections.map((s) => ({ ...s, rows: s.rows.filter((r) => rowMatches(r, filter)) })).filter((s) => s.rows.length) }))
                .filter((p) => p.sections.length);
              if (!visiblePages.length) return null;
              const groupOpen = !closed.has(`g:${group.label}`);
              return (
                <Fragment key={group.label}>
                  <tr>
                    <td colSpan={COLS} className="px-3 pb-2 pl-4 pt-8">
                      <button type="button" aria-expanded={groupOpen} onClick={() => toggle(`g:${group.label}`)} className="flex items-center gap-2 text-left">
                        <Chevron open={groupOpen} />
                        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#0c5290]">{group.label}</span>
                        <span className="text-xs text-slate-400">
                          {visiblePages.length} {visiblePages.length === 1 ? "page" : "pages"}
                        </span>
                      </button>
                    </td>
                  </tr>
                  {groupOpen
                    ? visiblePages.map(({ page, sections }) => {
                        const pageOpen = !closed.has(`p:${page.slug}`);
                        return (
                          <Fragment key={page.slug}>
                            <tr className="border-t border-slate-100">
                              <td colSpan={COLS} className="px-3 py-3 pl-9">
                                <button type="button" aria-expanded={pageOpen} onClick={() => toggle(`p:${page.slug}`)} className="flex items-center gap-2 text-left">
                                  <Chevron open={pageOpen} />
                                  <span className="text-ui font-semibold text-slate-900">{page.title}</span>
                                  <span className="text-xs text-slate-400">{sections.reduce((n, s) => n + s.rows.length, 0)}</span>
                                </button>
                                {pageOpen ? <p className="mt-0.5 pl-6 text-xs text-slate-500">{page.summary}</p> : null}
                              </td>
                            </tr>
                            {pageOpen
                              ? sections.map(({ key, section, rows }) => {
                                  if (rows[0]?.kind === "written") {
                                    const row = rows[0];
                                    return (
                                      <tr key={key} className="border-t border-slate-100 hover:bg-slate-50/70">
                                        <td className={`${CELL} pl-[3.75rem]`}>
                                          <span className="flex items-center gap-1.5">
                                            <span className="font-medium text-slate-800 [overflow-wrap:anywhere]">{section.title}</span>
                                            {section.about ? <InfoPop label={section.title}>{section.about}</InfoPop> : null}
                                            {row.hidden ? <HiddenMark /> : null}
                                          </span>
                                        </td>
                                        <td className={`${CELL} text-slate-600`}>{section.feeds ?? "—"}</td>
                                        <td className={`${CELL} text-slate-300`}>—</td>
                                        <td className={CELL}><WhoPill who={row.who} /></td>
                                        <td className={CELL}><UsedBy row={row} /></td>
                                      </tr>
                                    );
                                  }
                                  const sectionOpen = !closed.has(`s:${key}`);
                                  return (
                                    <Fragment key={key}>
                                      <tr className="border-t border-slate-100">
                                        <td colSpan={COLS} className="px-3 py-2.5 pl-[3.75rem]">
                                          <span className="flex items-center gap-1.5">
                                            <button type="button" aria-expanded={sectionOpen} onClick={() => toggle(`s:${key}`)} className="flex items-center gap-1.5 text-left">
                                              <Chevron open={sectionOpen} />
                                              <span className="font-medium text-slate-800 [overflow-wrap:anywhere]">{section.title}</span>
                                            </button>
                                            {section.about ? <InfoPop label={section.title}>{section.about}</InfoPop> : null}
                                            {rows[0]?.hidden ? <HiddenMark /> : null}
                                            {!sectionOpen ? <span className="text-xs text-slate-400">{rows.length}</span> : null}
                                          </span>
                                        </td>
                                      </tr>
                                      {sectionOpen
                                        ? rows.map((row) =>
                                            row.kind === "box" ? (
                                              <tr key={row.field.path} className="hover:bg-slate-50/70">
                                                <td className={`${CELL} pl-[5.75rem] text-slate-700`}>
                                                  {row.field.label}
                                                  {row.field.required ? <span className="ml-0.5 text-rose-500" title="Required">*</span> : null}
                                                </td>
                                                <td className={`${CELL} text-slate-600`}>{FIELD_WHY[row.field.path] ?? row.field.help ?? "—"}</td>
                                                <td className={`${CELL} ${row.field.ask ? "text-slate-600" : "text-slate-300"}`}>{row.field.ask ?? "—"}</td>
                                                <td className={CELL}><WhoPill who={row.who} /></td>
                                                <td className={CELL}><UsedBy row={row} /></td>
                                              </tr>
                                            ) : null
                                          )
                                        : null}
                                    </Fragment>
                                  );
                                })
                              : null}
                          </Fragment>
                        );
                      })
                    : null}
                </Fragment>
              );
            })}
            <tr>
              <td colSpan={COLS} className="h-4" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
