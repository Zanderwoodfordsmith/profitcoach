"use client";

import { useCallback, useEffect, useState } from "react";

import type { WorkingLessonId } from "@/lib/academy/workingLessons";

const STORAGE_KEY = "working-lesson-progress-v1";

type ProgressMap = Partial<Record<WorkingLessonId, "completed">>;

function readProgress(): ProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ProgressMap;
  } catch {
    return {};
  }
}

function writeProgress(next: ProgressMap) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function useWorkingLessonProgress() {
  const [progress, setProgress] = useState<ProgressMap>({});

  useEffect(() => {
    setProgress(readProgress());
  }, []);

  const isDone = useCallback(
    (id: WorkingLessonId) => progress[id] === "completed",
    [progress],
  );

  const setDone = useCallback((id: WorkingLessonId, done: boolean) => {
    setProgress((current) => {
      const next = { ...current };
      if (done) next[id] = "completed";
      else delete next[id];
      writeProgress(next);
      return next;
    });
  }, []);

  const completedCount = Object.values(progress).filter((s) => s === "completed").length;

  return { progress, isDone, setDone, completedCount };
}
