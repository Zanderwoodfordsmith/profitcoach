"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";

import { Caret } from "@/components/admin/roadmap/roadmapUi";

/**
 * Admin → Ava's tables and detail layout, in the roadmap's list style: one
 * table with folding group headings, and a row opens its page with a sidebar
 * of the rest (like Linear).
 */

export type Column = { key: string; label: React.ReactNode; width?: string };

/** A table row: thin line above, quiet hover, the whole row clickable. */
export const ROW = "cursor-pointer border-t border-slate-200 align-middle transition hover:bg-white/70";

export function useFolded() {
  const [folded, setFolded] = useState<Set<string>>(new Set());
  return {
    isOpen: (key: string) => !folded.has(key),
    toggle: (key: string) =>
      setFolded((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      }),
  };
}

export function AvaTable({ columns, children }: { columns: Column[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto lg:overflow-visible">
      <table className="w-full min-w-[52rem] table-fixed text-left text-sm">
        <colgroup>
          {columns.map((c) => (
            <col key={c.key} style={c.width ? { width: c.width } : undefined} />
          ))}
        </colgroup>
        <thead className="text-xs font-medium text-slate-500">
          <tr>
            {columns.map((c, i) => (
              <th
                key={c.key}
                className={`sticky top-0 z-10 bg-[var(--app-canvas-base)] py-2.5 font-medium shadow-[inset_0_-1px_0_rgb(226_232_240)] ${
                  i === 0 ? "pl-[1.625rem] pr-4" : "px-3"
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        {children}
      </table>
    </div>
  );
}

/** A folding group in an AvaTable: heading row, then its rows when open. */
export function AvaGroup({
  id,
  label,
  hint,
  count,
  dot,
  first = false,
  span,
  folded,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  count: number | string;
  dot: string;
  first?: boolean;
  span: number;
  folded: ReturnType<typeof useFolded>;
  children: React.ReactNode;
}) {
  const open = folded.isOpen(id);
  return (
    <tbody>
      <tr>
        <td colSpan={span} className={`pb-0.5 ${first ? "pt-2" : "pt-6"}`}>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => folded.toggle(id)}
            className="inline-flex items-center gap-2.5 py-1 text-left"
          >
            <Caret open={open} />
            <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
            <span className="text-lg font-medium tracking-[-0.01em] text-slate-950">{label}</span>
            <span className="text-sm tabular-nums text-slate-400">{count}</span>
            {hint ? <span className="hidden text-xs text-slate-400 md:inline">{hint}</span> : null}
          </button>
        </td>
      </tr>
      {open ? children : null}
    </tbody>
  );
}

export function EmptyRow({ span, children = "Nothing here." }: { span: number; children?: React.ReactNode }) {
  return (
    <tr className="border-t border-slate-200">
      <td colSpan={span} className="py-3 pl-[1.625rem] text-sm text-slate-400">
        {children}
      </td>
    </tr>
  );
}

export type SideItem = { id: string; label: string; current?: boolean; note?: string; onOpen?: () => void; href?: string };

const SIDE_ITEM = "flex w-full items-baseline gap-2 rounded-[7px] px-2.5 py-1.5 text-left text-sm leading-snug";

/** An open page: the list on the left (desktop), the page on the right. */
export function AvaSplit({
  sections,
  back,
  children,
}: {
  sections: { id: string; label: string; items: SideItem[] }[];
  back?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1">
      <aside className="hidden w-[16.5rem] shrink-0 overflow-y-auto border-r border-[var(--app-subnav-rule)] bg-[var(--app-subnav-bg)] lg:block">
        <nav aria-label="Pages" className="px-3 py-4">
          {sections.map((section) => (
            <div key={section.id} className="pt-4 first:pt-0">
              <p className="px-2.5 pb-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">{section.label}</p>
              <ul>
                {section.items.map((item) => {
                  const cls = `${SIDE_ITEM} ${
                    item.current ? "bg-white font-semibold text-[#0f172a] shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "text-[#334155] hover:bg-white/55 hover:text-[#0f172a]"
                  }`;
                  const inner = (
                    <>
                      <span className="min-w-0 flex-1">{item.label}</span>
                      {item.note ? <span className="shrink-0 text-[11px] font-medium text-slate-400">{item.note}</span> : null}
                    </>
                  );
                  return (
                    <li key={item.id}>
                      {item.href ? (
                        <Link href={item.href} className={cls}>
                          {inner}
                        </Link>
                      ) : (
                        <button type="button" aria-current={item.current ? "page" : undefined} onClick={item.onOpen} className={cls}>
                          {inner}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <section className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-white">
        {/* Phones: the sidebar becomes a picker. */}
        <div className="px-5 pt-4 lg:hidden">
          <select
            aria-label="Open another page"
            value={sections.flatMap((s) => s.items).find((i) => i.current)?.id ?? ""}
            onChange={(e) => {
              const item = sections.flatMap((s) => s.items).find((i) => i.id === e.target.value);
              if (item?.href) window.location.assign(item.href);
              else item?.onOpen?.();
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800"
          >
            {sections.map((s) => (
              <optgroup key={s.id} label={s.label}>
                {s.items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        {back ? (
          <div className="mx-auto w-full max-w-[54rem] px-5 pt-6 md:px-10">
            <button
              type="button"
              onClick={back.onClick}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0c5290] hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              {back.label}
            </button>
          </div>
        ) : null}
        {children}
      </section>
    </div>
  );
}
