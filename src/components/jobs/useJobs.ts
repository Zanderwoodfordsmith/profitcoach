"use client";

import { useMemo } from "react";

import { usePractice } from "@/components/practice/PracticeProvider";
import { avaWorkFor, type AvaWork } from "@/lib/launch/avaWork";
import { jobStatusFrom, type JobStatus } from "@/lib/launch/jobStatus";
import type { LaunchItem, LaunchProgress } from "@/lib/launch/progress";
import { threadForSectionRef, type LaunchThread } from "@/lib/launch/threads";
import { BLUEPRINT_SECTIONS } from "@/lib/practiceKnowledge/blueprint";
import { sectionWorkflow } from "@/lib/practiceKnowledge/sectionWorkflow";

import { JOBS } from "./jobParts";

export type JobItem = LaunchItem & { building?: boolean };

export type JobState = {
  thread: LaunchThread;
  status: JobStatus;
  items: JobItem[];
  done: number;
  total: number;
  /** What Ava can write here and what's missing first. Worked out from the Blueprint. */
  ava: AvaWork;
  /** Ava's drafts, messages and answers waiting for BCA (admins only; 0 for coaches). */
  avaOpen: number;
};

/**
 * Each job's checklist and status. Blueprint sections are read from the open
 * Blueprint, so a change shows straight away; the Getting live checks (lead
 * list, campaign live, first call) come from the launch progress.
 */
export function useJobs(progress: LaunchProgress, avaOpen: Record<string, number> = {}): Record<string, JobState> {
  const { knowledge, payload, building } = usePractice();
  return useMemo(() => {
    const sections: Record<string, JobItem[]> = {};
    if (knowledge && payload) {
      const row = { ...knowledge, payload };
      for (const ref of BLUEPRINT_SECTIONS) {
        const thread = threadForSectionRef(ref);
        if (!thread || ref.section.face === "stored") continue;
        const work = sectionWorkflow(ref, row);
        if (!work.tracked) continue;
        (sections[thread] ??= []).push({
          label: ref.section.title,
          done: work.status === "done",
          waitsOn: work.status === "done" ? null : work.owner,
          review: work.status === "review",
          sectionKey: ref.key,
          building: building.active.includes(ref.key),
        });
      }
    }
    const out: Record<string, JobState> = {};
    for (const thread of JOBS) {
      const fromProgress = progress[thread.key]?.items ?? [];
      // Until the Blueprint has loaded, the progress has the sections too.
      const items: JobItem[] =
        knowledge && payload
          ? [...(sections[thread.key] ?? []), ...fromProgress.filter((i) => i.stepKey)]
          : fromProgress;
      const done = items.filter((i) => i.done).length;
      const waiting = avaOpen[thread.key] ?? 0;
      let status = jobStatusFrom(items);
      // Ava has written something BCA hasn't checked yet: the job is being worked on.
      if (waiting && status === "bca_todo") status = "in_progress";
      const ava = avaWorkFor(thread.key, knowledge && payload ? { ...knowledge, payload } : null);
      out[thread.key] = { thread, status, items, done, total: items.length, ava, avaOpen: waiting };
    }
    return out;
  }, [knowledge, payload, building.active, progress, avaOpen]);
}
