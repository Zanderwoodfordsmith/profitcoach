"use client";

import { useEffect, useMemo, useState } from "react";
import { Columns3, Info, Rows3, Search } from "lucide-react";

import { ViewToggle } from "@/components/admin/roadmap/roadmapUi";

import type {
  AvaCatalog,
  AvaFileUser,
  AvaKnowledgeGroup,
  AvaKnowledgeRow,
} from "@/lib/agent/avaCatalog";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";

import { HINT, KIND_ORDER, UNUSED_CHIP, UsedByChips } from "./AvaChips";
import { AvaDocument } from "./AvaDocument";
import {
  AvaGroup,
  AvaSplit,
  AvaTable,
  EmptyRow,
  ROW,
  useFolded,
  type Column,
} from "./AvaList";

/**
 * Admin → Ava → Knowledge: every knowledge file in one table, grouped by when
 * it is read, each with what reads it. A row opens the file beside the list.
 */

type MemorySource = { source: string; label: string; count: number | null };

const GROUPS: {
  id: AvaKnowledgeGroup | "search";
  label: string;
  hint: string;
  dot: string;
}[] = [
  {
    id: "every",
    label: "Every chat",
    hint: "Ava reads these at the start of every chat.",
    dot: "bg-[#0c5290]",
  },
  {
    id: "skill",
    label: "When a skill opens it",
    hint: "Read only when a skill, a Blueprint writer or another tool needs it.",
    dot: "bg-sky-500",
  },
  {
    id: "search",
    label: "Search only",
    hint: "Ava's memory. She finds these with search when a chat needs them. Read-only.",
    dot: "bg-slate-400",
  },
  {
    id: "unused",
    label: "Not used by anything",
    hint: "Nothing reads these. Cut them, or give them a job.",
    dot: "bg-rose-500",
  },
];

/** The sidebar leaves out Search only: those aren't files. */
const FILE_GROUPS = GROUPS.filter(
  (g): g is (typeof GROUPS)[number] & { id: AvaKnowledgeGroup } =>
    g.id !== "search",
);

/** "Used by" as one column, or one column per kind of reader: side by side until Zander picks. */
type UsedView = "kinds" | "one";

const KIND_COLUMN: Record<AvaFileUser["kind"], string> = {
  ava: "Ava skills",
  writer: "Blueprint writers",
  create: "Create hub",
  feature: "Other tools",
};

const SIZE_COLUMN: Column = {
  key: "size",
  label: (
    <span className="inline-flex items-center gap-1" title="Measured in tokens">
      Size
      <Info
        className="h-3.5 w-3.5 text-slate-400"
        aria-label="Measured in tokens"
      />
    </span>
  ),
  width: "6rem",
};

function columnsFor(view: UsedView): Column[] {
  return [
    { key: "file", label: "File" },
    SIZE_COLUMN,
    {
      key: "edited",
      label: "Last change",
      width: view === "kinds" ? "7.5rem" : "9rem",
    },
    ...(view === "kinds"
      ? KIND_ORDER.map((kind) => ({
          key: kind,
          label: KIND_COLUMN[kind],
          width: "13%",
        }))
      : [{ key: "used", label: "Used by", width: "40%" }]),
  ];
}

/** Today, 1d, 6d, 1w, 2w; just the month once it is over a month old. */
function since(iso: string): string {
  const then = new Date(iso);
  const start = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(new Date()) - start(then)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days < 7) return `${days}d`;
  if (days < 31) return `${Math.floor(days / 7)}w`;
  // Older: the month alone (Aug), with the year when it isn't this one (Aug 2025).
  return then.toLocaleDateString("en-GB", {
    month: "short",
    year:
      then.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

function fullDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function matches(row: AvaKnowledgeRow, q: string): boolean {
  if (!q) return true;
  const hay = [row.label, row.id, ...row.usedBy.map((u) => u.label)]
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

function Row({
  row,
  view,
  onOpen,
}: {
  row: AvaKnowledgeRow;
  view: UsedView;
  onOpen: (id: string) => void;
}) {
  return (
    <tr onClick={() => onOpen(row.id)} className={ROW}>
      <td className="py-2.5 pl-[1.625rem] pr-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(row.id);
          }}
          title={row.id}
          className="flex min-w-0 max-w-full items-baseline gap-2 text-left"
        >
          <span className="shrink-0 font-medium text-slate-900 hover:text-[#0c5290]">
            {row.label}
          </span>
          <span className="truncate font-mono text-[11px] text-slate-400">
            {row.id}
          </span>
        </button>
      </td>
      <td className="px-3 py-2.5 text-slate-600 tabular-nums">
        {row.missing ? (
          <span className="font-semibold text-amber-700">Missing</span>
        ) : (
          <span
            title={`${row.tokens.toLocaleString()} tokens, ${row.chars.toLocaleString()} characters`}
          >
            {row.tokens.toLocaleString()}
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 tabular-nums">
        {row.editedAt ? (
          <span title={`Edited here, ${fullDate(row.editedAt)}`}>
            {since(row.editedAt)}{" "}
            <span className="text-xs text-sky-700">here</span>
          </span>
        ) : row.repoAt ? (
          <span title={`The repo file, ${fullDate(row.repoAt)}`}>
            {since(row.repoAt)}
          </span>
        ) : (
          <span className="text-slate-400">In code</span>
        )}
        {!row.editable ? (
          <span className="ml-1.5 text-xs text-slate-400">read-only</span>
        ) : null}
      </td>
      {!row.usedBy.length ? (
        <td
          colSpan={view === "kinds" ? KIND_ORDER.length : 1}
          className="px-3 py-2"
        >
          <span className={UNUSED_CHIP}>Not used</span>
        </td>
      ) : view === "kinds" ? (
        KIND_ORDER.map((kind) => {
          const users = row.usedBy.filter((u) => u.kind === kind);
          return (
            <td key={kind} className="px-3 py-2">
              {users.length ? (
                <UsedByChips users={users} max={2} bare />
              ) : (
                <span className="text-slate-300">–</span>
              )}
            </td>
          );
        })
      ) : (
        <td className="px-3 py-2">
          <UsedByChips users={row.usedBy} max={3} />
        </td>
      )}
    </tr>
  );
}

export function AvaKnowledgeTab({
  catalog,
  onOpen,
}: {
  catalog: AvaCatalog;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [memory, setMemory] = useState<MemorySource[] | null>(null);
  const folded = useFolded();
  const [view, setView] = useState<UsedView>("kinds");
  const columns = columnsFor(view);

  useEffect(() => {
    let live = true;
    void (async () => {
      const headers = await getCoachAuthHeaders(null);
      if (!headers) return;
      delete headers["x-impersonate-coach-id"];
      const res = await fetch("/api/admin/ava/memory", { headers });
      const body = (await res.json().catch(() => null)) as {
        sources?: MemorySource[];
      } | null;
      if (live) setMemory(body?.sources ?? []);
    })();
    return () => {
      live = false;
    };
  }, []);

  const q = query.trim();
  const rows = useMemo(
    () => catalog.knowledge.filter((row) => matches(row, q)),
    [catalog.knowledge, q],
  );
  const memoryRows = (memory ?? []).filter(
    (m) => !q || m.label.toLowerCase().includes(q.toLowerCase()),
  );
  const span = columns.length;

  return (
    <div className="mx-auto w-full max-w-[80rem] px-5 pb-10 pt-5 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">{HINT}</p>
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle
            value={view}
            onChange={setView}
            options={[
              { key: "kinds", label: "Used by in columns", icon: Columns3 },
              { key: "one", label: "Used by in one", icon: Rows3 },
            ]}
          />
          <label className="flex w-full items-center gap-2 rounded-lg sm:w-72 border border-slate-200 bg-white px-3 py-1.5 focus-within:border-sky-400">
            <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span className="sr-only">Filter knowledge</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name, file or what uses it"
              className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
          </label>
        </div>
      </div>

      <div className="mt-3">
        <AvaTable columns={columns}>
          {GROUPS.map((group, gi) => {
            if (group.id === "search") {
              if (q && !memoryRows.length) return null;
              return (
                <AvaGroup
                  key={group.id}
                  id={group.id}
                  label={group.label}
                  hint={group.hint}
                  count={memory ? memoryRows.length : "…"}
                  dot={group.dot}
                  span={span}
                  folded={folded}
                >
                  {memory === null ? (
                    <EmptyRow span={span}>Loading…</EmptyRow>
                  ) : null}
                  {memoryRows.map((m) => (
                    <tr
                      key={m.source}
                      className="border-t border-slate-200 align-middle"
                    >
                      <td className="py-2.5 pl-[1.625rem] pr-4 font-medium text-slate-900">
                        {m.label}
                      </td>
                      <td
                        colSpan={span - 1}
                        className="px-3 py-2.5 text-slate-600 tabular-nums"
                      >
                        {m.count === null
                          ? "Could not count"
                          : `${m.count.toLocaleString()} ${m.count === 1 ? "item" : "items"}`}
                      </td>
                    </tr>
                  ))}
                </AvaGroup>
              );
            }
            const list = rows.filter((row) => row.group === group.id);
            if (!list.length && q) return null;
            return (
              <AvaGroup
                key={group.id}
                id={group.id}
                label={group.label}
                hint={group.hint}
                count={list.length}
                dot={group.dot}
                first={gi === 0}
                span={span}
                folded={folded}
              >
                {list.map((row) => (
                  <Row key={row.id} row={row} view={view} onOpen={onOpen} />
                ))}
                {!list.length ? <EmptyRow span={span} /> : null}
              </AvaGroup>
            );
          })}
        </AvaTable>
      </div>
    </div>
  );
}

/** One knowledge file open, with the rest in the sidebar. */
export function AvaKnowledgeFile({
  catalog,
  openId,
  onOpen,
  onBack,
  onCatalog,
}: {
  catalog: AvaCatalog;
  openId: string;
  onOpen: (id: string) => void;
  onBack: () => void;
  onCatalog: (catalog: AvaCatalog) => void;
}) {
  const file = catalog.files.find((f) => f.id === openId) ?? null;
  const row = catalog.knowledge.find((k) => k.id === openId);
  const sections = FILE_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: catalog.knowledge
      .filter((k) => k.group === group.id)
      .map((k) => ({
        id: k.id,
        label: k.label,
        current: k.id === openId,
        onOpen: () => onOpen(k.id),
      })),
  })).filter((s) => s.items.length);

  return (
    <AvaSplit
      sections={sections}
      back={{ label: "All knowledge", onClick: onBack }}
    >
      {row?.usedBy.length ? (
        <div className="mx-auto mt-4 flex w-full max-w-[54rem] flex-wrap items-center gap-1.5 px-5 md:px-10">
          <span className="text-[0.6875rem] font-semibold text-slate-400">
            Used by
          </span>
          <UsedByChips users={row.usedBy} max={12} />
        </div>
      ) : null}
      {file ? (
        <AvaDocument
          file={file}
          title={file.label}
          summary={
            catalog.capabilities.find((c) => c.fileId === file.id)?.summary ??
            (file.description || undefined)
          }
          meta={row && !row.usedBy.length ? "not used by anything" : undefined}
          onCatalog={onCatalog}
        />
      ) : (
        <p className="mx-auto max-w-[54rem] px-5 py-8 text-sm text-slate-600 md:px-10">
          That file is not in the list.
        </p>
      )}
    </AvaSplit>
  );
}
