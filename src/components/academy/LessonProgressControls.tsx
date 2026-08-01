"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, FilePenLine } from "lucide-react";

import type { LessonProgressMap, LessonProgressStatus } from "@/lib/academy/lessonProgressTypes";
import { supabaseClient } from "@/lib/supabaseClient";

type LessonProgressContextValue = {
  courseId: string;
  progress: LessonProgressMap;
  getStatus: (lessonId: string) => LessonProgressStatus;
  setStatus: (lessonId: string, status: LessonProgressStatus) => Promise<void>;
  saving: boolean;
};

const LessonProgressContext = createContext<LessonProgressContextValue | null>(null);

function useLessonProgressContext(): LessonProgressContextValue | null {
  return useContext(LessonProgressContext);
}

export function useLessonProgress() {
  const ctx = useLessonProgressContext();
  if (!ctx) {
    throw new Error("useLessonProgress must be used within LessonProgressProvider");
  }
  return ctx;
}

async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  return session?.access_token ?? null;
}

export function LessonProgressProvider({
  courseId,
  activeLessonId,
  children,
}: {
  courseId: string;
  /** When set, records this lesson as last opened for Resume Training. */
  activeLessonId?: string;
  children: ReactNode;
}) {
  const [progress, setProgress] = useState<LessonProgressMap>({});
  const [saving, setSaving] = useState(false);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const token = await getAccessToken();
      if (!token || cancelled) return;

      const response = await fetch(
        `/api/coach/academy/lesson-progress/${encodeURIComponent(courseId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!response.ok) return;

      const body = (await response.json()) as { progress?: LessonProgressMap };
      if (!cancelled) {
        setProgress(body.progress ?? {});
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    if (!activeLessonId) return;
    let cancelled = false;

    async function recordView() {
      const token = await getAccessToken();
      if (!token || cancelled) return;

      await fetch(
        `/api/coach/academy/lesson-progress/${encodeURIComponent(courseId)}/${encodeURIComponent(activeLessonId!)}/view`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
    }

    void recordView();
    return () => {
      cancelled = true;
    };
  }, [courseId, activeLessonId]);

  const getStatus = useCallback(
    (lessonId: string): LessonProgressStatus => progress[lessonId] ?? "not_started",
    [progress],
  );

  const setStatus = useCallback(
    async (lessonId: string, status: LessonProgressStatus) => {
      const previous = progressRef.current[lessonId] ?? "not_started";
      if (previous === status) return;

      const nextProgress = { ...progressRef.current };
      if (status === "not_started") {
        delete nextProgress[lessonId];
      } else {
        nextProgress[lessonId] = status;
      }
      setProgress(nextProgress);

      const token = await getAccessToken();
      if (!token) {
        setProgress((current) => {
          const reverted = { ...current };
          if (previous === "not_started") {
            delete reverted[lessonId];
          } else {
            reverted[lessonId] = previous;
          }
          return reverted;
        });
        return;
      }

      setSaving(true);
      try {
        const response = await fetch(
          `/api/coach/academy/lesson-progress/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status }),
          },
        );

        if (!response.ok) {
          setProgress((current) => {
            const reverted = { ...current };
            if (previous === "not_started") {
              delete reverted[lessonId];
            } else {
              reverted[lessonId] = previous;
            }
            return reverted;
          });
        }
      } finally {
        setSaving(false);
      }
    },
    [courseId],
  );

  const value = useMemo(
    () => ({
      courseId,
      progress,
      getStatus,
      setStatus,
      saving,
    }),
    [courseId, progress, getStatus, setStatus, saving],
  );

  return (
    <LessonProgressContext.Provider value={value}>{children}</LessonProgressContext.Provider>
  );
}

function isCompleted(status: LessonProgressStatus): boolean {
  return status === "completed";
}

function todoToggleClass(done: boolean, size: "sm" | "md", onActiveRow: boolean): string {
  const sizeClass =
    size === "md"
      ? "inline-flex h-9 w-9 items-center justify-center rounded-full border transition"
      : "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition";

  if (done) {
    return `${sizeClass} border-emerald-600 bg-emerald-600 text-white shadow-sm hover:border-emerald-700 hover:bg-emerald-700`;
  }

  if (onActiveRow) {
    return `${sizeClass} border-white/55 bg-transparent text-white/40 hover:border-white hover:text-white/70`;
  }
  return `${sizeClass} border-slate-300/90 bg-transparent text-slate-300 hover:border-slate-400 hover:text-slate-400`;
}

function TodoCheck({
  done,
  size,
}: {
  done: boolean;
  size: "sm" | "md";
}) {
  const iconClass = size === "md" ? "h-4 w-4" : "h-3 w-3";
  return <Check className={iconClass} strokeWidth={done ? 3 : 2.5} aria-hidden />;
}

async function toggleCompleted(
  setStatus: (lessonId: string, status: LessonProgressStatus) => Promise<void>,
  lessonId: string,
  status: LessonProgressStatus,
) {
  await setStatus(lessonId, isCompleted(status) ? "not_started" : "completed");
}

/** Header control — simple done / not-done toggle */
export function LessonProgressHeaderControl({ lessonId }: { lessonId: string }) {
  const ctx = useLessonProgressContext();
  if (!ctx) return null;

  const { getStatus, setStatus, saving } = ctx;
  const status = getStatus(lessonId);
  const done = isCompleted(status);

  return (
    <button
      type="button"
      className={todoToggleClass(done, "md", false)}
      aria-label={done ? "Mark lesson as not done" : "Mark lesson as done"}
      aria-pressed={done}
      disabled={saving}
      onClick={() => {
        void toggleCompleted(setStatus, lessonId, status);
      }}
    >
      <TodoCheck done={done} size="md" />
    </button>
  );
}

/** Sidebar mark — to-do checkbox; click toggles without navigating */
export function LessonProgressSidebarControl({
  lessonId,
  active = false,
  draft = false,
}: {
  lessonId: string;
  /** When the lesson row is the active (selected) one — adjusts contrast on sky bg */
  active?: boolean;
  /** Draft lessons show a document icon instead of the completion tick. */
  draft?: boolean;
  /** @deprecated Menu alignment removed; kept for call-site compatibility */
  align?: "left" | "right";
}) {
  const ctx = useLessonProgressContext();
  if (!ctx) return null;

  if (draft) {
    return (
      <span
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          active
            ? "border-amber-200/80 bg-amber-400/20 text-amber-100"
            : "border-amber-300/80 bg-amber-50 text-amber-600"
        }`}
        title="Draft — admins only"
        aria-label="Draft lesson"
      >
        <FilePenLine className="h-3 w-3" strokeWidth={2.25} aria-hidden />
      </span>
    );
  }

  const { getStatus, setStatus, saving } = ctx;
  const status = getStatus(lessonId);
  const done = isCompleted(status);

  return (
    <button
      type="button"
      className={todoToggleClass(done, "sm", active)}
      aria-label={done ? "Mark lesson as not done" : "Mark lesson as done"}
      aria-pressed={done}
      disabled={saving}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void toggleCompleted(setStatus, lessonId, status);
      }}
    >
      <TodoCheck done={done} size="sm" />
    </button>
  );
}
