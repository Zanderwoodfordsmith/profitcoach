"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";

import { StickyPageHeader } from "@/components/layout";
import { AREAS, LEVELS } from "@/lib/bossData";
import type { PlaybookSummary } from "@/lib/playbookContentTypes";

import { areaHeroGradient, PlaybookCard } from "./PlaybookCard";

type ViewMode = "grid" | "list";

export type PlaybooksLibraryProps = {
  summaries: PlaybookSummary[];
  loading?: boolean;
  error?: string | null;
  eyebrow?: string;
  title: string;
  description: string;
  buildHref: (ref: string) => string;
  /** Client view: locked playbooks (muted cards / list rows). */
  isLocked?: (ref: string) => boolean;
  /** Client view: BOSS score on cards. */
  getScore?: (ref: string) => 0 | 1 | 2 | undefined;
  /** Match dashboard main padding (`-mx-[60px] px-[60px]`). Use `false` for standalone pages. */
  stickyBleedInset?: string | false;
  headerLeading?: ReactNode;
};

function levelLabel(levelId: number): string {
  return LEVELS.find((l) => l.id === levelId)?.name ?? `Level ${levelId}`;
}

export function PlaybooksLibrary({
  summaries,
  loading = false,
  error = null,
  eyebrow,
  title,
  description,
  buildHref,
  isLocked,
  getScore,
  stickyBleedInset,
  headerLeading,
}: PlaybooksLibraryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const grouped = useMemo(() => {
    return AREAS.map((area) => ({
      area,
      items: summaries
        .filter((s) => s.area === area.id)
        .sort((a, b) => a.level - b.level),
    })).filter((g) => g.items.length > 0);
  }, [summaries]);

  const viewToggle = !loading && !error && (
    <div
      className="flex rounded-lg border border-slate-200 p-0.5"
      role="group"
      aria-label="View mode"
    >
      <button
        type="button"
        onClick={() => setViewMode("grid")}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
          viewMode === "grid"
            ? "bg-slate-800 text-white"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        Grid
      </button>
      <button
        type="button"
        onClick={() => setViewMode("list")}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
          viewMode === "list"
            ? "bg-slate-800 text-white"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        List
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        leading={headerLeading}
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={viewToggle}
        bleedInset={stickyBleedInset ?? undefined}
      />

      {loading && <p className="text-sm text-slate-600">Loading…</p>}

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {!loading && !error && viewMode === "grid" && (
        <div className="flex flex-col gap-10">
          {grouped.map(({ area, items }) => (
            <section key={area.id} className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                {area.name}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {items.map((s) => (
                  <PlaybookCard
                    key={s.ref}
                    summary={s}
                    href={buildHref(s.ref)}
                    score={getScore?.(s.ref)}
                    locked={isLocked?.(s.ref) ?? false}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {!loading && !error && viewMode === "list" && (
        <div className="flex flex-col gap-8">
          {grouped.map(({ area, items }) => (
            <section key={area.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                  {area.name}
                </h2>
              </div>
              <ul className="divide-y divide-slate-100">
                {items.map((s) => {
                  const locked = isLocked?.(s.ref) ?? false;
                  const desc = s.description?.trim();
                  const meta = `Level ${s.level} · ${levelLabel(s.level)}`;
                  return (
                    <li key={s.ref}>
                      <Link
                        href={buildHref(s.ref)}
                        className={`group flex gap-4 px-4 py-4 transition hover:bg-slate-50/80 sm:gap-5 sm:px-5 sm:py-5 ${
                          locked ? "opacity-90" : ""
                        }`}
                      >
                        <div
                          className="relative mt-0.5 h-20 w-24 shrink-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5 sm:h-24 sm:w-28"
                          style={{ background: areaHeroGradient(s.area) }}
                        >
                          <div
                            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent"
                            aria-hidden
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0c5290] sm:text-[11px]">
                            {meta}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-lg font-semibold leading-snug tracking-[-0.02em] text-slate-900 transition-colors group-hover:text-[#0c5290]">
                              {s.name}
                            </span>
                            {locked ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                Locked
                              </span>
                            ) : null}
                          </div>
                          <p
                            className={`mt-2 line-clamp-2 text-sm leading-relaxed sm:line-clamp-3 ${
                              desc ? "text-slate-600" : "italic text-slate-400"
                            }`}
                          >
                            {desc || "A concise overview will appear here once content is published."}
                          </p>
                          <p className="mt-3 text-sm font-semibold text-slate-900">
                            Open playbook{" "}
                            <span
                              className="inline-block transition-transform duration-300 group-hover:translate-x-1"
                              aria-hidden
                            >
                              →
                            </span>
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
