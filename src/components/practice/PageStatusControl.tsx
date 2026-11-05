"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { badgeClass } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { BOARD_COLUMNS, BOARD_TAGS, boardCard, type BoardColumnId } from "@/lib/practiceKnowledge/blueprintBoard";
import type { BlueprintLink } from "@/lib/practiceKnowledge/blueprint";
import { pageStatus } from "@/lib/practiceKnowledge/pageStatus";
import type { WorkflowStatus } from "@/lib/practiceKnowledge/sectionWorkflow";

import { usePractice } from "./PracticeProvider";
import { STAGE_LOOK, StageCircle } from "./StageCircle";
import { PAGE_STATUS_TONE, PILL_LARGE, PageStatusPill } from "./StatusGuide";

/** BCA's pill takes the same colours as the coach's on the overview. */
const COLUMN_TONE: Record<BoardColumnId, (typeof PAGE_STATUS_TONE)[keyof typeof PAGE_STATUS_TONE]> = {
  needs_coach: PAGE_STATUS_TONE.needs_you,
  bca_todo: PAGE_STATUS_TONE.bca,
  in_progress: PAGE_STATUS_TONE.in_progress,
  coach_review: PAGE_STATUS_TONE.review,
  done: PAGE_STATUS_TONE.done,
};

const BCA_OPTIONS: { id: WorkflowStatus; label: string; column: BoardColumnId }[] = [
  { id: "todo", label: "To do", column: "bca_todo" },
  { id: "review", label: "Coach review", column: "coach_review" },
  { id: "done", label: "Done", column: "done" },
];

/**
 * One status per page (4 Nov), beside the page title. The coach sees their
 * four and signs the page off in one go. BCA sees the five board steps, can
 * set the page by hand, and gives the check before anything is sent.
 */
export function PageStatusControl({ page }: { page: BlueprintLink }) {
  const { knowledge, payload, viewer, setPageStatus, signOffPage, approvePageToSend } = usePractice();
  const [open, setOpen] = useState(false);
  if (!knowledge || !payload) return null;
  const row = { ...knowledge, payload };

  if (viewer === "coach") {
    const status = pageStatus(page, row);
    if (!status) return null;
    return (
      <span className="inline-flex items-center gap-2">
        <PageStatusPill status={status} large />
        {status === "review" ? (
          <button
            type="button"
            onClick={() => signOffPage(page.slug)}
            className={buttonClass("main", "small")}
          >
            <Check className="h-4 w-4" aria-hidden />
            Sign off this page
          </button>
        ) : null}
      </span>
    );
  }

  const card = boardCard(page, row, 0);
  const column = BOARD_COLUMNS.find((c) => c.id === card.column)!;
  const sendCheck = card.tag === "to_send";
  return (
    <span className="inline-flex items-center gap-2">
      {sendCheck ? (
        <button
          type="button"
          onClick={() => approvePageToSend(page.slug)}
          className={buttonClass("main", "small")}
        >
          <Check className="h-4 w-4" aria-hidden />
          Approve to send
        </button>
      ) : null}
      <span className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          title={column.hint}
          onClick={() => setOpen((v) => !v)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className={badgeClass(COLUMN_TONE[card.column], `${PILL_LARGE} hover:brightness-95`)}
        >
          <StageCircle look={STAGE_LOOK[card.column]} className="h-3.5 w-3.5" />
          {column.label}
          {card.tag ? <span className="opacity-75">· {BOARD_TAGS[card.tag].label}</span> : null}
          <ChevronDown className={`h-3.5 w-3.5 opacity-70 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {open ? (
          <div role="menu" className="absolute right-0 top-full z-20 mt-1.5 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            <p className="px-2.5 pb-1 pt-1.5 text-xs text-slate-500">Set the whole page</p>
            {BCA_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="menuitem"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  setPageStatus(page.slug, option.id);
                }}
                className="flex w-full items-center rounded-lg px-2 py-1.5 text-left hover:bg-slate-100"
              >
                <span className={badgeClass(COLUMN_TONE[option.column], PILL_LARGE)}>
                  <StageCircle look={STAGE_LOOK[option.column]} className="h-3.5 w-3.5" />
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </span>
    </span>
  );
}
