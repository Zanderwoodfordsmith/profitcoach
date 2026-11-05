import type { GettingLiveStepKey } from "@/lib/gettingLiveSteps";

import type { LaunchItem } from "./progress";

/**
 * A launch job's status, one of six (Zander, 2 Nov). The circle fills as it
 * moves along: dashed when it needs the coach, a quarter when BCA has it to
 * do, half while BCA is working on it, three quarters when it waits for the
 * coach to check, a tick when done. "To do" (stored as later; "Not started" until 2 Nov) is a job
 * nobody can start yet, or one with nothing to track for this coach yet.
 * The words match the Blueprint's own section pills (Needs you, BCA to do,
 * Review, Done).
 */
export type JobStatus = "later" | "needs_you" | "bca_todo" | "in_progress" | "review" | "done";

export const JOB_STATUSES: JobStatus[] = ["needs_you", "bca_todo", "in_progress", "review", "done", "later"];

/** Each status has one colour: the circle and the chip always match. */
export const JOB_STATUS_META: Record<JobStatus, { label: string; coachLabel?: string; chip: string; color: string }> = {
  needs_you: { label: "Needs coach", coachLabel: "Needs you", chip: "bg-orange-100 text-orange-800", color: "text-orange-500" },
  bca_todo: { label: "BCA to do", chip: "bg-sky-100 text-sky-800", color: "text-sky-600" },
  in_progress: { label: "In progress", chip: "bg-blue-100 text-blue-800", color: "text-blue-600" },
  review: { label: "Review", chip: "bg-yellow-100 text-yellow-800", color: "text-yellow-500" },
  done: { label: "Done", chip: "bg-emerald-100 text-emerald-800", color: "text-emerald-600" },
  later: { label: "To do", chip: "bg-slate-100 text-slate-500", color: "text-slate-400" },
};

/**
 * Who each Getting live check waits on. Replies, calls and clients are
 * results, not work anyone can do, so they wait on nobody.
 */
const STEP_OWNER: Partial<Record<GettingLiveStepKey, "coach" | "bca">> = {
  about_you: "coach",
  blueprint_call: "coach",
  blueprint_written: "bca",
  // BCA rewrites the profile first; the coach's part shows in its sections.
  linkedin_updated: "bca",
  leads_found: "bca",
  campaign_set_up: "bca",
  signed_off: "coach",
  campaign_live: "bca",
};

export type JobStatusItem = Pick<LaunchItem, "done" | "waitsOn" | "review" | "stepKey"> & {
  /** Being written right now (Ava or BCA at work). */
  building?: boolean;
};

function ownerOf(item: JobStatusItem): "coach" | "bca" | null {
  if (item.waitsOn) return item.waitsOn;
  return item.stepKey ? (STEP_OWNER[item.stepKey] ?? null) : null;
}

/**
 * Getting live checks happen in order, so only the first open one in a job
 * can be anyone's turn: "Coach agrees" doesn't need the coach until the
 * campaign is written. Later open checks count as not done, but not as work.
 */
function actionable(items: JobStatusItem[]): JobStatusItem[] {
  let firstOpenStep = true;
  return items.filter((i) => {
    if (!i.stepKey || i.done) return true;
    const keep = firstOpenStep;
    firstOpenStep = false;
    return keep;
  });
}

export function jobStatusFrom(all: JobStatusItem[]): JobStatus {
  if (all.length === 0) return "later";
  if (all.every((i) => i.done)) return "done";
  const items = actionable(all);
  const open = items.filter((i) => !i.done);
  if (open.some((i) => i.review && ownerOf(i) === "coach")) return "review";
  if (open.some((i) => !i.review && ownerOf(i) === "coach")) return "needs_you";
  const started = items.some((i) => i.done || i.review || i.building);
  const bcaOpen = open.some((i) => ownerOf(i) === "bca");
  if (started && (bcaOpen || open.some((i) => i.building))) return "in_progress";
  if (bcaOpen) return "bca_todo";
  // Only results left (first reply, call, client): nothing anyone can do yet.
  return started ? "in_progress" : "later";
}

/** One item's own status, for the rows inside a job. */
export function itemStatus(item: JobStatusItem): JobStatus {
  return jobStatusFrom([item]);
}
