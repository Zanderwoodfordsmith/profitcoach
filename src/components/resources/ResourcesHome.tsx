"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

import type { ResourceGroup, ResourcePage } from "@/lib/resources/library";

import {
  ALL_PAGES,
  KINDS,
  KindTile,
  PILLARS,
  PageKindIcon,
  SECTIONS,
  Snippet,
  groupOf,
  groupsIn,
  kindCount,
  useLibrarySearch,
  type Kind,
} from "./librarySearch";
import { cardClass } from "@/components/ui/Card";

/** Same glass card the Blueprint home lists its pages on. */
const GLASS =
  "rounded-2xl border border-white/80 bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_28px_-18px_rgba(5,30,54,0.55)] backdrop-blur-md";

/** The Resources landing page: the banner, search and filters, then the three ways in. */
export function ResourcesHome() {
  const pathname = usePathname() ?? "";
  const base = `${pathname.startsWith("/admin") ? "/admin" : "/coach"}/academy/resources`;
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const { words, results, searchText } = useLibrarySearch(query, kind);
  const summary = KINDS.filter((k) => k.kind !== "links")
    .map((k) => `${kindCount(k.kind)} ${k.plural}`)
    .join(" · ");

  return (
    <article>
      <header className="bp-cover px-6 pb-9 pt-12 text-white @2xl:px-12 @2xl:pb-10 @2xl:pt-16">
        <h1 className="bp-display text-[2.75rem] font-medium leading-[0.98] tracking-[-0.035em] @2xl:text-[3.75rem]">
          The Resource
          <br />
          <span className="font-normal italic text-[#bfe2fb]">Library</span>
        </h1>
        <p className="mt-5 max-w-[46ch] text-read leading-[1.55] text-white/80">
          Every guide, sheet, deck and template for winning clients, running sessions and using the Profit System. Read it here, search
          inside it, and make your own copy.
        </p>
        <div className="mt-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-white/20 pt-4">
          <p className="text-lg font-semibold tracking-[-0.01em]">{ALL_PAGES.length} resources</p>
          <p className="bp-num text-sm text-white/80">{summary}</p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[52rem] px-3 pb-14 pt-8 md:px-8">
        <div className="space-y-3">
          <label className="relative block">
            <span className="sr-only">Search inside resources</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[var(--bp-faint)]" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search inside every resource"
              className={`${GLASS} w-full py-3.5 pl-12 pr-4 text-read text-[var(--bp-ink)] outline-none placeholder:text-[var(--bp-muted)] focus:ring-2 focus:ring-[#1a8fd4]`}
            />
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Show only">
            {[{ kind: null as Kind | null, label: "All", count: ALL_PAGES.length }, ...KINDS.map((k) => ({ ...k, count: kindCount(k.kind) }))].map(
              (chip) => {
                const on = kind === chip.kind;
                return (
                  <button
                    key={chip.label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setKind(chip.kind)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a8fd4] ${
                      on
                        ? "bg-[var(--bp-navy)] text-white"
                        : "border border-white/80 bg-white/70 text-[var(--bp-muted)] shadow-[0_6px_16px_-12px_rgba(5,30,54,0.5)] hover:bg-white hover:text-[var(--bp-ink)]"
                    }`}
                  >
                    {chip.label} <span className={`bp-num font-medium ${on ? "text-white/70" : "text-[var(--bp-faint)]"}`}>{chip.count}</span>
                  </button>
                );
              }
            )}
          </div>
        </div>

        {results ? (
          <section className="mt-10" aria-live="polite">
            <h2 className="px-4 text-title font-semibold tracking-[-0.02em] text-[var(--bp-ink)]">
              {results.length === 0
                ? "Nothing matches"
                : `${results.length} ${results.length === 1 ? "resource" : kind && !words.length ? KINDS.find((k) => k.kind === kind)?.plural : "resources"}`}
            </h2>
            {results.length === 0 ? (
              <p className="mt-2 px-4 text-[var(--bp-muted)]">Try fewer words, or clear the filter.</p>
            ) : (
              <ul className={`mt-3 divide-y divide-[var(--bp-rule)] overflow-hidden ${GLASS}`}>
                {results.map((p) => (
                  <li key={p.slug}>
                    <Row page={p} base={base} detail={groupOf(p)?.title}>
                      {words.length ? <Snippet text={searchText[p.slug] ?? ""} words={words} /> : p.dek}
                    </Row>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <div className="mt-10 space-y-3">
            {SECTIONS.map((section) => {
              const groups = groupsIn(section.title);
              if (groups.length === 0) return null;
              const isOpen = open[section.title] ?? false;
              const total = groups.reduce((n, g) => n + g.pages.length, 0);
              return (
                <section key={section.title} className={`overflow-hidden ${GLASS}`}>
                  <h2>
                    <button
                      type="button"
                      onClick={() => setOpen((o) => ({ ...o, [section.title]: !isOpen }))}
                      aria-expanded={isOpen}
                      className="group flex w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1a8fd4] md:px-5"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#eaf3fb] text-[#0c5290] transition-colors group-hover:bg-[#dcebf8]">
                        <section.icon className="h-6 w-6" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="text-lg font-semibold tracking-[-0.01em] text-[var(--bp-ink)]">{section.title}</span>
                          <span className="bp-num shrink-0 text-sm font-medium text-[var(--bp-faint)]">{total} resources</span>
                        </span>
                        <span className="mt-0.5 block text-sm leading-6 text-[var(--bp-muted)]">{section.about}</span>
                      </span>
                      <ChevronDown
                        className={`mt-1.5 h-5 w-5 shrink-0 text-[var(--bp-faint)] transition-transform duration-200 group-hover:text-[var(--bp-blue)] ${isOpen ? "rotate-180" : ""}`}
                        aria-hidden
                      />
                    </button>
                  </h2>
                  {isOpen ? (
                    <div className="border-t border-[var(--bp-rule)] bg-white/50 px-4 pb-5 pt-4 md:px-5">
                      {section.title === "Profit System" ? (
                        <PillarBoard groups={groups} base={base} />
                      ) : (
                        <div className="space-y-6">
                          {groups.map((g) => (
                            <GroupList key={g.title} group={g} base={base} />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}

function GroupList({ group, base }: { group: ResourceGroup; base: string }) {
  return (
    <div>
      <h3 className="font-semibold text-[var(--bp-ink)]">{group.title}</h3>
      {group.about ? <p className="text-sm leading-6 text-[var(--bp-muted)]">{group.about}</p> : null}
      <ul className={cardClass("plain", "mt-2 divide-y divide-[var(--bp-rule)] overflow-hidden")}>
        {group.pages.map((p) => (
          <li key={p.slug}>
            <Row page={p} base={base} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The Profit System as the BOSS framework lays it out: one column per pillar, its areas beneath. */
function PillarBoard({ groups, base }: { groups: ResourceGroup[]; base: string }) {
  return (
    <div className="grid gap-5 @3xl:grid-cols-3 @3xl:gap-4">
      {PILLARS.map((pillar) => (
        <div key={pillar}>
          <h3 className="border-b-2 border-[var(--bp-blue)] pb-1.5 text-ui font-semibold text-[var(--bp-navy)]">{pillar}</h3>
          <div className="mt-3 space-y-5">
            {groups
              .filter((g) => g.pillar === pillar)
              .map((g) => (
                <div key={g.title}>
                  <h4 className="text-sm font-semibold text-[var(--bp-ink)]">{g.title}</h4>
                  <ul className="mt-1.5 space-y-0.5">
                    {g.pages.map((p) => (
                      <li key={p.slug}>
                        <Link
                          href={`${base}/${p.slug}`}
                          className="flex items-start gap-2 rounded-lg px-1.5 py-1 text-sm leading-snug text-[var(--bp-body)] hover:bg-white hover:text-[var(--bp-blue)]"
                        >
                          <PageKindIcon page={p} className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{p.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({ page, base, detail, children }: { page: ResourcePage; base: string; detail?: string; children?: ReactNode }) {
  return (
    <Link
      href={`${base}/${page.slug}`}
      className="group flex items-start gap-3.5 px-4 py-3 transition-colors hover:bg-white/80 focus-visible:bg-white focus-visible:outline-none"
    >
      <KindTile type={page.blocks[0]?.type ?? "doc"} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-medium leading-6 text-[var(--bp-ink)] group-hover:text-[var(--bp-blue)]">{page.title}</span>
          {detail ? <span className="shrink-0 text-xs font-medium text-[var(--bp-faint)]">{detail}</span> : null}
        </span>
        {(children ?? page.dek) ? (
          <span className="mt-0.5 block text-sm leading-6 text-[var(--bp-muted)] line-clamp-2">{children ?? page.dek}</span>
        ) : null}
      </span>
      <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-[var(--bp-faint)] group-hover:text-[var(--bp-blue)]" aria-hidden />
    </Link>
  );
}
