"use client";

import Link from "next/link";
import { ChevronRight, MessageSquare } from "lucide-react";

import { BLUEPRINT_GROUPS, sectionKey, type BlueprintLink } from "@/lib/practiceKnowledge/blueprint";
import { pageStatus } from "@/lib/practiceKnowledge/pageStatus";

import { useSectionComments } from "./comments/SectionCommentsContext";
import { BlueprintCover, DownloadMenu } from "./document/DocumentParts";
import { PageIcon } from "./pageIcons";
import { PracticeSteps } from "./PracticeSteps";
import { PageStatusPill, StatusGuide } from "./StatusGuide";
import { usePractice } from "./PracticeProvider";

function unreadOnPage(page: BlueprintLink, threads: Record<string, { unread: number }> | undefined): number {
  if (!threads) return 0;
  return page.sections.reduce((count, section) => count + (threads[sectionKey(page, section)]?.unread ?? 0), 0);
}

/** The blueprint's landing page: where each page stands, and what is waiting on you. */
export function BlueprintHome() {
  const { knowledge, payload, href, stayOnPage } = usePractice();
  const comments = useSectionComments();
  if (!knowledge || !payload) return null;
  const row = { ...knowledge, payload };
  const groups = BLUEPRINT_GROUPS.map((group) => ({
    ...group,
    pages: group.pages.filter((page) => page.slug !== "command"),
  })).filter((group) => group.pages.length > 0);

  return (
    <article>
      <BlueprintCover flush />
      <div className="mx-auto w-full max-w-[52rem] px-3 pb-10 pt-8 md:px-8">
        <PracticeSteps />
        <nav aria-label="Contents" className="mt-10 space-y-12">
          {groups.map((group, index) => (
            <section key={group.label}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="px-4 text-[1.375rem] font-bold tracking-[-0.02em] text-[var(--bp-ink)]">{group.label}</h2>
                {index === 0 ? (
                  <div className="bp-no-print shrink-0">
                    <StatusGuide />
                  </div>
                ) : null}
              </div>
              <ul className="mt-3 space-y-2.5">
                {group.pages.map((page) => {
                  const status = pageStatus(page, row);
                  const unread = unreadOnPage(page, comments?.threads);
                  return (
                    <li key={page.slug}>
                      <Link
                        href={href(page.href)}
                        scroll={stayOnPage ? false : undefined}
                        className="group flex items-start gap-4 rounded-2xl border border-white/80 bg-white/70 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_28px_-18px_rgba(5,30,54,0.55)] backdrop-blur-md transition-[background-color,box-shadow] duration-200 ease-out hover:bg-white/88 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_16px_32px_-16px_rgba(5,30,54,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a8fd4] print:border-[#e8edf3] print:bg-white print:shadow-none print:backdrop-blur-none"
                      >
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#eaf3fb] text-[#0c5290] transition-colors group-hover:bg-[#dcebf8]">
                          <PageIcon slug={page.slug} className="h-6 w-6" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-3">
                            <span className="min-w-0 pt-px text-[1rem] font-semibold leading-6 text-[var(--bp-ink)] group-hover:text-[var(--bp-blue)]">
                              {page.title}
                            </span>
                            <span className="flex shrink-0 items-center gap-2.5 pt-1">
                              {unread > 0 ? (
                                <span
                                  className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold tabular-nums text-[#9b2c2c]"
                                  title={`${unread} comment${unread === 1 ? "" : "s"} to read`}
                                >
                                  <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                                  <span className="sr-only">
                                    {unread} comment{unread === 1 ? "" : "s"} to read.
                                  </span>
                                  <span aria-hidden>{unread}</span>
                                </span>
                              ) : null}
                              {status ? <PageStatusPill status={status} /> : null}
                              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--bp-faint)] transition-colors group-hover:text-[var(--bp-blue)]" aria-hidden />
                            </span>
                          </span>
                          <span className="mt-0.5 block min-h-12 pr-1 text-sm leading-6 text-[var(--bp-muted)] line-clamp-2">{page.summary}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
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
