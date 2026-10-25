"use client";

import Link from "next/link";
import { ChevronRight, MessageSquare } from "lucide-react";

import { BLUEPRINT_GROUPS, sectionKey, type BlueprintLink } from "@/lib/practiceKnowledge/blueprint";
import { pageStatus } from "@/lib/practiceKnowledge/pageStatus";

import { useSectionComments } from "./comments/SectionCommentsContext";
import { BlueprintCover } from "./document/DocumentParts";
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
  const { knowledge, payload, href, stayOnPage, viewer, decision } = usePractice();
  const comments = useSectionComments();
  if (!knowledge || !payload) return null;
  const row = { ...knowledge, payload };
  const groups = BLUEPRINT_GROUPS.map((group) => ({
    ...group,
    pages: group.pages.filter((page) => page.slug !== "command"),
  })).filter((group) => group.pages.length > 0);
  const yours = groups.filter((group) => group.yours);
  const later = groups.filter((group) => !group.yours);

  // Until the coach has answered their own cards, everything BCA builds sits back:
  // still there and still clickable, just quieter, so the next job is obvious.
  const yoursAnswered = yours.every((group) => group.pages.every((page) => pageStatus(page, row) !== "needs_you"));
  const quiet = viewer === "coach" && !yoursAnswered;
  const callBooked = Boolean(payload.review.decision_call_booked_at?.value);
  const handover =
    viewer !== "coach"
      ? null
      : !yoursAnswered
        ? "Finish the cards above and have your Blueprint Call. Then we get to work."
        : !decision?.locked_at
          ? callBooked
            ? "Your Blueprint Call is booked. Once we have agreed your market and offer, we get to work."
            : "Your cards are done. Next is your Blueprint Call, then we get to work."
          : "We are building your practice. Each card moves to Review when it is ready for you to check.";

  const renderGroup = (group: (typeof groups)[number], index: number) => (
    <section key={group.label} className={`bp-home-group${index % 2 ? " bp-home-group-alt" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="px-4 text-title font-semibold text-[var(--bp-ink)]">{group.label}</h2>
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
                className="bp-glass-card group flex items-start gap-4 rounded-2xl px-4 py-3.5"
              >
                <span className="bp-glass-tile flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-[#0c5290]">
                  <PageIcon slug={page.slug} className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0 pt-px text-base font-semibold leading-6 text-[var(--bp-ink)] group-hover:text-[var(--bp-blue)]">
                      {page.title}
                    </span>
                    <span className="flex shrink-0 items-center gap-2.5 pt-1">
                      {unread > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 text-caption font-semibold tabular-nums text-[#9b2c2c]"
                          title={`${unread} comment${unread === 1 ? "" : "s"} to read`}
                        >
                          <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                          <span className="sr-only">
                            {unread} comment{unread === 1 ? "" : "s"} to read.
                          </span>
                          <span aria-hidden>{unread}</span>
                        </span>
                      ) : null}
                      {status && !(quiet && !group.yours) ? <PageStatusPill status={status} /> : null}
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
  );

  return (
    <article>
      <BlueprintCover flush />
      <div className="bp-home-field">
        <div className="mx-auto w-full max-w-[52rem] px-3 pb-14 pt-8 md:px-8">
          <PracticeSteps />
          <nav aria-label="Contents" className="mt-10 space-y-12">
            {yours.map((group, index) => renderGroup(group, index))}
            {later.length ? (
              <div>
                {handover ? (
                  <div className="bp-build-strip mb-9 rounded-2xl px-6 py-6 text-center text-white">
                    <span aria-hidden className="bp-build-mark mx-auto flex h-10 w-10 items-center justify-center rounded-full text-[10px] font-semibold tracking-[0.06em]">
                      BCA
                    </span>
                    <p className="bp-display mt-3 text-title font-semibold">Everything below, we build for you.</p>
                    <p className="mx-auto mt-1.5 max-w-[46ch] text-ui leading-6 text-white/80">{handover}</p>
                  </div>
                ) : null}
                <div className={`space-y-12${quiet ? " bp-home-quiet" : ""}`}>
                  {later.map((group, index) => renderGroup(group, yours.length + index))}
                </div>
              </div>
            ) : null}
          </nav>
        </div>
      </div>
    </article>
  );
}
