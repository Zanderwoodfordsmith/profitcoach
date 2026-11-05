"use client";

import { badgeClass, type BadgeTone } from "@/components/ui/Badge";
import { COACH_LOOK, StageCircle } from "./StageCircle";
import { PAGE_STATUS_COPY, PAGE_STATUS_ORDER, type PageStatusId } from "@/lib/practiceKnowledge/pageStatus";

export const PAGE_STATUS_TONE: Record<PageStatusId, BadgeTone> = {
  needs_you: "red",
  bca: "grey",
  in_progress: "blue",
  review: "amber",
  done: "green",
};

/** The larger size, for a page's title line. */
export const PILL_LARGE = "gap-1.5 px-3 py-1 text-ui";

export function PageStatusPill({ status, large = false }: { status: PageStatusId; large?: boolean }) {
  const copy = PAGE_STATUS_COPY[status];
  return (
    <span
      title={copy.title}
      className={badgeClass(PAGE_STATUS_TONE[status], large ? PILL_LARGE : "gap-1.5 px-2.5 py-1 text-[13px]")}
    >
      <StageCircle look={COACH_LOOK[status]} className="h-3.5 w-3.5" />
      {copy.label}
    </span>
  );
}

/** The five statuses in order, each with what it means; with counts when given (the overview's How it works). */
export function StatusSteps({ counts }: { counts?: Partial<Record<PageStatusId, number>> }) {
  return (
    <ol>
      {PAGE_STATUS_ORDER.map((id, index) => {
        const copy = PAGE_STATUS_COPY[id];
        const last = index === PAGE_STATUS_ORDER.length - 1;
        const count = counts?.[id];
        return (
          <li key={id} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3">
            <span className="relative flex flex-col items-center">
              <StageCircle look={COACH_LOOK[id]} className="mt-1 h-3.5 w-3.5" />
              {last ? null : <span className="mt-1 w-px flex-1 bg-[#e3eef8]" aria-hidden />}
            </span>
            <div className={last ? "pb-0.5" : "pb-6"}>
              <span className="flex items-center justify-between gap-3">
                <PageStatusPill status={id} />
                {count === undefined ? null : (
                  <span className="text-sm tabular-nums text-[var(--bp-muted)]">
                    {count} {count === 1 ? "page" : "pages"}
                  </span>
                )}
              </span>
              <p className="mt-1.5 text-sm leading-6 text-[var(--bp-body)]">{copy.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
