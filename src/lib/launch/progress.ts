import { loadGettingLive, type GettingLiveRow } from "@/lib/gettingLive";
import type { GettingLiveStepKey } from "@/lib/gettingLiveSteps";
import { BLUEPRINT_SECTIONS } from "@/lib/practiceKnowledge/blueprint";
import { sectionWorkflow } from "@/lib/practiceKnowledge/sectionWorkflow";
import { findPracticeKnowledge } from "@/lib/practiceKnowledge/store";
import type { PracticeKnowledgeRow } from "@/lib/practiceKnowledge/types";

import { avaWorkFor } from "./avaWork";
import { openForCoaches } from "./jobActivity";
import { LAUNCH_STEP_THREAD, LAUNCH_THREADS, threadForSectionRef } from "./threads";

/** One thing inside a launch job: a Blueprint section or a Getting live check. */
export type LaunchItem = {
  label: string;
  done: boolean;
  /** Who it's waiting on, when it isn't done and we know. */
  waitsOn: "coach" | "bca" | null;
  /** Waiting for the coach to read and sign off, rather than to write. */
  review: boolean;
  /** The Blueprint section ("page:id") this item is, when it is one. */
  sectionKey?: string;
  /** The Getting live check this item is, when it is one. */
  stepKey?: GettingLiveStepKey;
};

export type LaunchJob = {
  key: string;
  /** Share done, 0 to 1. */
  share: number;
  done: boolean;
  items: LaunchItem[];
};

export type LaunchProgress = Record<string, LaunchJob>;

/** Each pinned thread's job for one coach, from their Blueprint and Getting live. */
export function launchProgressFrom(
  row: PracticeKnowledgeRow | null,
  live: GettingLiveRow | null
): LaunchProgress {
  const items: Record<string, LaunchItem[]> = {};
  if (row) {
    for (const ref of BLUEPRINT_SECTIONS) {
      const thread = threadForSectionRef(ref);
      if (!thread || ref.section.face === "stored") continue;
      const work = sectionWorkflow(ref, row);
      if (!work.tracked) continue;
      (items[thread] ??= []).push({
        label: ref.section.title,
        done: work.status === "done",
        waitsOn: work.status === "done" ? null : (work.owner as "coach" | "bca" | null),
        review: work.status === "review",
        sectionKey: ref.key,
      });
    }
  }
  for (const step of live?.steps ?? []) {
    const thread = LAUNCH_STEP_THREAD[step.key];
    if (!thread) continue;
    (items[thread] ??= []).push({ label: step.label, done: step.done, waitsOn: null, review: false, stepKey: step.key });
  }
  const out: LaunchProgress = {};
  for (const thread of LAUNCH_THREADS) {
    if (thread.phase === null) continue;
    const list = items[thread.key] ?? [];
    const done = list.filter((i) => i.done).length;
    out[thread.key] = {
      key: thread.key,
      share: list.length ? done / list.length : 0,
      done: list.length > 0 && done === list.length,
      items: list,
    };
  }
  return out;
}

export async function launchProgressForCoach(coachId: string): Promise<LaunchProgress> {
  const [row, live] = await Promise.all([
    findPracticeKnowledge(coachId),
    loadGettingLive({ coachId }).catch(() => null),
  ]);
  return launchProgressFrom(row, live?.rows.find((r) => r.coach_id === coachId) ?? null);
}

/** Ava on one coach's job, for the admin list: can she write it, and is anything of hers waiting for BCA. */
export type LaunchAva = { ready: boolean; toWrite: number; missing: number; open: number };

/** Everyone on the Getting live list (joined in the last 90 days, or added by hand). */
export async function launchProgressForLaunching(): Promise<
  {
    coachId: string;
    name: string;
    joinedAt: string | null;
    progress: LaunchProgress;
    ava: Record<string, LaunchAva>;
  }[]
> {
  const live = await loadGettingLive();
  const open = await openForCoaches(live.rows.map((r) => r.coach_id)).catch(() => ({}) as Record<string, Record<string, number>>);
  return Promise.all(
    live.rows.map(async (r) => {
      const row = await findPracticeKnowledge(r.coach_id);
      const ava: Record<string, LaunchAva> = {};
      for (const thread of LAUNCH_THREADS) {
        if (thread.phase === null) continue;
        const work = avaWorkFor(thread.key, row);
        const waiting = open[r.coach_id]?.[thread.key] ?? 0;
        if (!work.toWrite.length && !waiting) continue;
        ava[thread.key] = { ready: work.ready, toWrite: work.toWrite.length, missing: work.missing.length, open: waiting };
      }
      return { coachId: r.coach_id, name: r.name, joinedAt: r.joined_at, progress: launchProgressFrom(row, r), ava };
    })
  );
}
