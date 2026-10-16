"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { BLUEPRINT_GROUPS, stillNeeded } from "@/lib/practiceKnowledge/blueprint";

import { BlueprintCover, DownloadMenu } from "./document/DocumentParts";
import { PageIcon } from "./pageIcons";
import { usePractice } from "./PracticeProvider";

/** The blueprint's landing page: the cover, full width, then a simple table of contents. */
export function BlueprintHome() {
  const { knowledge, payload, href, stayOnPage } = usePractice();
  if (!knowledge || !payload) return null;
  const open = new Set(stillNeeded({ ...knowledge, payload }).map((ref) => ref.page.slug));
  const groups = BLUEPRINT_GROUPS.map((group) => ({
    ...group,
    pages: group.pages.filter((page) => page.slug !== "command"),
  })).filter((group) => group.pages.length > 0);

  return (
    <article>
      <BlueprintCover flush />
      <div className="mx-auto w-full max-w-[52rem] px-3 py-10 md:px-8">
        <nav aria-label="Contents" className="space-y-12">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="px-4 text-[1.375rem] font-bold tracking-[-0.02em] text-[var(--bp-ink)]">{group.label}</h2>
              <ul className="mt-3 space-y-1">
                {group.pages.map((page) => (
                  <li key={page.slug}>
                    <Link
                      href={href(page.href)}
                      scroll={stayOnPage ? false : undefined}
                      className="group flex items-center gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-[#f2f6fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a8fd4]"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#eaf3fb] text-[#0c5290] transition-colors group-hover:bg-[#dcebf8]">
                        <PageIcon slug={page.slug} className="h-6 w-6" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-[1rem] font-semibold text-[var(--bp-ink)] group-hover:text-[var(--bp-blue)]">
                          {page.title}
                          {open.has(page.slug) ? (
                            <span className="rounded-full bg-[#fde8e6] px-2 py-px text-[0.6875rem] font-semibold text-[#9b2c2c]">
                              Needs you
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-sm leading-6 text-[var(--bp-muted)]">{page.summary}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--bp-faint)] group-hover:text-[var(--bp-blue)]" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
        <div className="bp-no-print mt-10 flex justify-end">
          <DownloadMenu />
        </div>
      </div>
    </article>
  );
}
