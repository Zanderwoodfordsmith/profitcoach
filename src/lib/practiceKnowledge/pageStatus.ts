import { BLUEPRINT_PAGES, BLUEPRINT_SECTIONS, type BlueprintLink } from "./blueprint";
import { sectionWorkflow } from "./sectionWorkflow";
import type { PracticeKnowledgeRow } from "./types";

/**
 * One line for the overview, in the order a coach should act.
 * Needs you: this page still has answers only they can give.
 * BCA to do: BCA still has something to write here.
 * Review: it is written and waiting on them.
 * Done: nothing on the page is still open.
 */
export type PageStatusId = "needs_you" | "bca" | "review" | "done";

export const PAGE_STATUS_ORDER: PageStatusId[] = ["needs_you", "bca", "review", "done"];

export const PAGE_STATUS_COPY: Record<PageStatusId, { label: string; title: string; body: string }> = {
  needs_you: {
    label: "Needs you",
    title: "This page still needs something from you.",
    body: "Answers only you can give. Open it and fill the gaps, or talk them through with Ava.",
  },
  bca: {
    label: "BCA to do",
    title: "BCA writes this page.",
    body: "Nothing for you to fill or review yet. We write it from what you have already given, then it comes back to you.",
  },
  review: {
    label: "Review",
    title: "Something here is ready for you to review.",
    body: "We have written this. Read it, sign it off, or ask for a change.",
  },
  done: {
    label: "Done",
    title: "This page is done.",
    body: "Signed off. You can still edit. A later change brings it back to Review.",
  },
};

/** Where one blueprint page stands, for the overview. Null when the page has nothing to track. */
export function pageStatus(page: BlueprintLink, row: PracticeKnowledgeRow): PageStatusId | null {
  const visible = BLUEPRINT_SECTIONS.filter((ref) => ref.page.slug === page.slug && ref.section.face !== "stored");
  const tracked = visible
    .map((ref) => ({ ref, work: sectionWorkflow(ref, row) }))
    .filter((item) => item.work.tracked);
  if (!tracked.length) return null;

  if (tracked.some((item) => item.work.status === "todo" && item.work.owner === "coach")) return "needs_you";
  if (tracked.some((item) => item.work.status === "todo" && item.work.owner === "bca")) return "bca";
  if (tracked.some((item) => item.work.status === "review" && item.work.owner === "coach")) return "review";
  if (tracked.some((item) => item.work.owner === "bca")) return "bca";
  if (tracked.every((item) => item.work.status === "done")) return "done";
  return "needs_you";
}

export function pageStatusBySlug(slug: string, row: PracticeKnowledgeRow): PageStatusId | null {
  const page = BLUEPRINT_PAGES.find((item) => item.slug === slug);
  return page ? pageStatus(page, row) : null;
}
