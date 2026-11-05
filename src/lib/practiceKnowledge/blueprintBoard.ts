import { avaWorkFor, pageScope } from "@/lib/launch/avaWork";

import { BLUEPRINT_GROUPS, BLUEPRINT_SECTIONS, sectionByKey, type BlueprintLink } from "./blueprint";
import { sectionWorkflow } from "./sectionWorkflow";
import type { PracticeKnowledgeRow } from "./types";

/**
 * Admin → Coaches → Blueprint (3 Nov): every coach's Blueprint pages as
 * cards, in the column for whose move it is. Client-safe: the server works
 * the columns out, the page draws them.
 */

/**
 * One status per page (4 Nov), in the order the work happens. The circle
 * fills as it moves along: dotted, quarter, half, three quarters, tick. The
 * coach sees the same five; only BCA sees the tags inside In progress.
 */
export type BoardColumnId = "needs_coach" | "bca_todo" | "in_progress" | "coach_review" | "done";

export const BOARD_COLUMNS: { id: BoardColumnId; label: string; hint: string }[] = [
  { id: "needs_coach", label: "Needs coach", hint: "Waiting on the coach's answers, on this page or in About You." },
  { id: "bca_todo", label: "BCA to do", hint: "Not started: BCA fills it in first, usually from the Blueprint Call." },
  { id: "in_progress", label: "In progress", hint: "We have everything we need. Ready to write: run Ava. Draft to check: read Ava's draft. Check before sending: the coach signed it off." },
  { id: "coach_review", label: "Coach review", hint: "Written and waiting on the coach to sign it off." },
  { id: "done", label: "Done", hint: "Signed off. A later change brings it back to review." },
];

/** Where an In progress page is, for BCA only. */
export type BoardTag = "ava_ready" | "ava_done" | "to_send";

export const BOARD_TAGS: Record<BoardTag, { label: string; hint: string }> = {
  ava_ready: { label: "Ready to write", hint: "Ava has what she needs. Open it and press Run Ava." },
  ava_done: { label: "Draft to check", hint: "Ava's draft is waiting for your check." },
  to_send: { label: "Check before sending", hint: "The coach signed it off. Check it before it goes out." },
};

/**
 * Progress points per page (4 Nov): nothing until work starts, then one point
 * per real step. Check before sending scores the same as Coach review, so a
 * coach signing off never moves the score backwards.
 */
export const PAGE_POINTS_MAX = 5;

export function cardPoints(card: Pick<BoardCard, "column" | "tag">): number {
  if (card.column === "done") return 5;
  if (card.column === "coach_review") return 4;
  if (card.column === "in_progress") return card.tag === "to_send" ? 4 : card.tag === "ava_done" ? 3 : 2;
  return 0;
}

/** A coach's progress: points over the most they could have, as a whole percentage. */
export function progressOf(cards: Pick<BoardCard, "column" | "tag">[]): { points: number; max: number; percent: number } {
  const points = cards.reduce((sum, card) => sum + cardPoints(card), 0);
  const max = cards.length * PAGE_POINTS_MAX;
  return { points, max, percent: max ? Math.round((points / max) * 100) : 0 };
}

/** The pages a coach works through: the overview and hidden groups left out. */
export function boardPages(): BlueprintLink[] {
  return BLUEPRINT_GROUPS.filter((group) => !group.hidden)
    .flatMap((group) => group.pages)
    .filter((page) => page.slug !== "command");
}

export type BoardCard = {
  column: BoardColumnId;
  /** Only on In progress: Ava ready, Ava done or To send. */
  tag: BoardTag | null;
  note: string;
};

function list(labels: string[]): string {
  return labels.length > 2 ? `${labels.slice(0, 2).join(", ")} and ${labels.length - 2} more` : labels.join(" and ");
}

/**
 * Where one coach's page stands, and one line on why. `open` is Ava's items
 * waiting for BCA on it. BCA's move comes first on BCA's board; a page BCA
 * can't start until the coach answers is the coach's move.
 */
export function boardCard(page: BlueprintLink, row: PracticeKnowledgeRow, open: number): BoardCard {
  const items = BLUEPRINT_SECTIONS.filter((ref) => ref.page.slug === page.slug && ref.section.face !== "stored")
    .map((ref) => ({ ref, work: sectionWorkflow(ref, row) }))
    .filter((item) => item.work.tracked);
  if (open > 0) {
    return { column: "in_progress", tag: "ava_done", note: open === 1 ? "1 thing from Ava to check" : `${open} things from Ava to check` };
  }
  if (items.some((item) => item.work.status === "review" && item.work.owner === "bca")) {
    return { column: "in_progress", tag: "to_send", note: "Signed off by the coach: check it before it's sent" };
  }
  const yours = BLUEPRINT_GROUPS.some((group) => group.yours && group.pages.includes(page));
  if (!items.length) {
    return yours
      ? { column: "needs_coach", tag: null, note: "Their answers" }
      : { column: "bca_todo", tag: null, note: "BCA fills in" };
  }

  const ava = avaWorkFor(pageScope(page.slug), row);
  const missingNames = list(ava.missing.map((m) => m.label));
  // Ava can't write until the coach answers, and nothing else here is BCA's.
  const waitsOnCoach = !ava.ready && ava.missing.length > 0 && ava.missing.every((m) => m.coach);
  const bcaTodo = items.filter(
    (item) => item.work.status === "todo" && item.work.owner === "bca" && !(waitsOnCoach && ava.toWrite.includes(item.ref.key))
  );
  if (bcaTodo.length) {
    if (ava.ready) {
      return { column: "in_progress", tag: "ava_ready", note: `Ava can write ${list(ava.toWrite.map((k) => sectionByKey(k)?.section.title ?? k))}` };
    }
    const avaOnly = bcaTodo.every((item) => ava.toWrite.includes(item.ref.key));
    return { column: "bca_todo", tag: null, note: avaOnly && missingNames ? `Ava needs ${missingNames}` : "BCA fills in" };
  }
  if (items.some((item) => item.work.status === "todo")) {
    return { column: "needs_coach", tag: null, note: waitsOnCoach ? `Ava needs their ${missingNames}` : "Their answers" };
  }
  if (items.some((item) => item.work.status === "review")) return { column: "coach_review", tag: null, note: "Their review" };
  return { column: "done", tag: null, note: "Done" };
}
