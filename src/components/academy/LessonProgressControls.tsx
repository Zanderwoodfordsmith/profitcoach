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
import { Check, Circle, CircleAlert } from "lucide-react";

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
  children,
}: {
  courseId: string;
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

const STATUS_OPTIONS: {
  status: LessonProgressStatus;
  label: string;
  description: string;
  icon: typeof Check;
  iconClassName: string;
  activeClassName: string;
}[] = [
  {
    status: "completed",
    label: "Complete",
    description: "Finished this lesson",
    icon: Check,
    iconClassName: "text-white",
    activeClassName: "bg-emerald-500 border-emerald-500",
  },
  {
    status: "needs_review",
    label: "Needs review",
    description: "Watched — revisit or need help",
    icon: CircleAlert,
    iconClassName: "text-white",
    activeClassName: "bg-amber-400 border-amber-400",
  },
  {
    status: "not_started",
    label: "Clear",
    description: "Reset progress",
    icon: Circle,
    iconClassName: "text-slate-400",
    activeClassName: "bg-white border-slate-300",
  },
];

function statusButtonClass(status: LessonProgressStatus, size: "sm" | "md"): string {
  const base =
    size === "md"
      ? "inline-flex h-9 w-9 items-center justify-center rounded-full border-2 transition"
      : "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition";

  if (status === "completed") {
    return `${base} border-emerald-500 bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 hover:border-emerald-600`;
  }
  if (status === "needs_review") {
    return `${base} border-amber-400 bg-amber-400 text-white shadow-sm hover:bg-amber-500 hover:border-amber-500`;
  }
  return `${base} border-slate-300 bg-white text-slate-400 hover:border-slate-400 hover:text-slate-500`;
}

function StatusGlyph({
  status,
  size,
}: {
  status: LessonProgressStatus;
  size: "sm" | "md";
}) {
  const iconClass = size === "md" ? "h-4 w-4" : "h-3 w-3";
  if (status === "completed") {
    return <Check className={iconClass} strokeWidth={3} aria-hidden />;
  }
  if (status === "needs_review") {
    return <CircleAlert className={iconClass} strokeWidth={2.5} aria-hidden />;
  }
  return <Circle className={iconClass} strokeWidth={2} aria-hidden />;
}

function LessonProgressMenu({
  lessonId,
  currentStatus,
  onClose,
  align,
}: {
  lessonId: string;
  currentStatus: LessonProgressStatus;
  onClose: () => void;
  align: "left" | "right";
}) {
  const ctx = useLessonProgressContext();
  if (!ctx) return null;

  const { setStatus } = ctx;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className={`absolute top-full z-30 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg ${
        align === "right" ? "right-0" : "left-0"
      }`}
      role="menu"
    >
      <p className="px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        Lesson progress
      </p>
      {STATUS_OPTIONS.map((option) => {
        const active = currentStatus === option.status;
        const Icon = option.icon;
        return (
          <button
            key={option.status}
            type="button"
            role="menuitem"
            className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-slate-50 ${
              active ? "bg-slate-50" : ""
            }`}
            onClick={() => {
              void setStatus(lessonId, option.status);
              onClose();
            }}
          >
            <span
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${option.activeClassName}`}
            >
              <Icon className={`h-3.5 w-3.5 ${option.iconClassName}`} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-slate-900">{option.label}</span>
              <span className="block text-xs text-slate-500">{option.description}</span>
            </span>
            {active ? (
              <Check className="ml-auto h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Header control — top right of lesson title row */
export function LessonProgressHeaderControl({ lessonId }: { lessonId: string }) {
  const ctx = useLessonProgressContext();
  const [open, setOpen] = useState(false);
  if (!ctx) return null;

  const { getStatus, saving } = ctx;
  const status = getStatus(lessonId);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className={statusButtonClass(status, "md")}
        aria-label="Set lesson progress"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={saving}
        onClick={() => setOpen((value) => !value)}
      >
        <StatusGlyph status={status} size="md" />
      </button>
      {open ? (
        <LessonProgressMenu
          lessonId={lessonId}
          currentStatus={status}
          onClose={() => setOpen(false)}
          align="right"
        />
      ) : null}
    </div>
  );
}

/** Sidebar mark — synced with header; click opens menu without navigating */
export function LessonProgressSidebarControl({
  lessonId,
  align = "right",
}: {
  lessonId: string;
  align?: "left" | "right";
}) {
  const ctx = useLessonProgressContext();
  const [open, setOpen] = useState(false);
  if (!ctx) return null;

  const { getStatus, saving } = ctx;
  const status = getStatus(lessonId);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className={statusButtonClass(status, "sm")}
        aria-label="Set lesson progress"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={saving}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <StatusGlyph status={status} size="sm" />
      </button>
      {open ? (
        <LessonProgressMenu
          lessonId={lessonId}
          currentStatus={status}
          onClose={() => setOpen(false)}
          align={align}
        />
      ) : null}
    </div>
  );
}
