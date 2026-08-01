"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { FilePenLine, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";

type Props = {
  contentCourseId: string;
  lessonId: string;
  lessonTitle: string;
  draft?: boolean;
  /** Active row (sky background) — keep menu readable. */
  active?: boolean;
  /** Omitted where no lesson editor is mounted for this route. */
  onEdit?: () => void;
  onDraftChange: (draft: boolean) => void;
  onDeleted: () => void;
  /** Lets the row lift its stacking order while the menu is open. */
  onOpenChange?: (open: boolean) => void;
};

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session?.access_token) throw new Error("Not signed in");
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

export function AdminLessonSidebarMenu({
  contentCourseId,
  lessonId,
  lessonTitle,
  draft = false,
  active = false,
  onEdit,
  onDraftChange,
  onDeleted,
  onOpenChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  function changeOpen(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
    if (!next) setError(null);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        onOpenChange?.(false);
        setError(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        onOpenChange?.(false);
        setError(null);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  function stop(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  async function toggleDraft() {
    setBusy(true);
    setError(null);
    const next = !draft;
    try {
      const headers = await authHeaders();
      const res = await fetch(
        `/api/admin/academy/lesson-visibility/${encodeURIComponent(contentCourseId)}/${encodeURIComponent(lessonId)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ draft: next }),
        }
      );
      const payload = (await res.json()) as { error?: string; draft?: boolean };
      if (!res.ok) throw new Error(payload.error ?? "Failed to update draft");
      onDraftChange(payload.draft === true);
      changeOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update draft");
    } finally {
      setBusy(false);
    }
  }

  async function deleteLesson() {
    const confirmed = window.confirm(
      `Delete “${lessonTitle}”? It will be hidden from the academy for everyone.`
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(
        `/api/admin/academy/lesson-visibility/${encodeURIComponent(contentCourseId)}/${encodeURIComponent(lessonId)}`,
        { method: "DELETE", headers }
      );
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to delete lesson");
      onDeleted();
      changeOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete lesson");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className={`rounded-md p-1 transition ${
          active
            ? "text-sky-100 hover:bg-white/15 hover:text-white"
            : "text-slate-400 hover:bg-slate-200/80 hover:text-slate-700"
        } ${open ? (active ? "bg-white/15 text-white" : "bg-slate-200/80 text-slate-700") : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Lesson actions for ${lessonTitle}`}
        disabled={busy}
        onClick={(event) => {
          stop(event);
          changeOpen(!open);
        }}
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[10.5rem] rounded-xl border border-slate-200 bg-white py-1 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5"
          onClick={stop}
        >
          {onEdit ? (
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              className="flex w-full items-center gap-2 bg-white px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              onClick={() => {
                changeOpen(false);
                onEdit();
              }}
            >
              <Pencil className="h-4 w-4 shrink-0 opacity-70" />
              Edit
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            className="flex w-full items-center gap-2 bg-white px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            onClick={() => void toggleDraft()}
          >
            <FilePenLine className="h-4 w-4 shrink-0 opacity-70" />
            {draft ? "Publish" : "Move to draft"}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            className="flex w-full items-center gap-2 bg-white px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            onClick={() => void deleteLesson()}
          >
            <Trash2 className="h-4 w-4 shrink-0 opacity-80" />
            Delete
          </button>
          {error ? (
            <p className="border-t border-slate-100 px-3 py-2 text-xs text-rose-600">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
