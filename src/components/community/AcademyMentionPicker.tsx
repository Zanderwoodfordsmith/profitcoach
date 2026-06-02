"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, GraduationCap, Search, X } from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";
import type { AcademyArea } from "@/lib/communityMentions";

type TreeLesson = {
  lessonId: string;
  title: string;
  emoji?: string | null;
  section?: string;
};
type TreeCourse = {
  area: AcademyArea;
  courseId: string;
  title: string;
  category?: string;
  lessons: TreeLesson[];
};

export type AcademyMentionPick =
  | {
      type: "lesson";
      area: AcademyArea;
      courseId: string;
      lessonId: string;
      title: string;
    }
  | { type: "course"; area: AcademyArea; courseId: string; title: string };

type Props = {
  open: boolean;
  mode: "lesson" | "course";
  onClose: () => void;
  onPick: (pick: AcademyMentionPick) => void;
};

type Row = {
  pick: AcademyMentionPick;
  label: string;
  sublabel: string;
  emoji?: string | null;
};

const RESULT_LIMIT = 60;

/** Module-level cache so reopening the picker (or other composers) is instant. */
let TREE_CACHE: TreeCourse[] | null = null;

async function fetchTree(): Promise<TreeCourse[]> {
  if (TREE_CACHE) return TREE_CACHE;
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return [];
  const res = await fetch(`/api/community/mention-content?type=tree`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { courses?: TreeCourse[] };
  TREE_CACHE = json.courses ?? [];
  return TREE_CACHE;
}

function areaLabel(area: AcademyArea): string {
  return area === "programs" ? "Programs" : "Classroom";
}

export function AcademyMentionPicker({ open, mode, onClose, onPick }: Props) {
  const [tree, setTree] = useState<TreeCourse[]>(() => TREE_CACHE ?? []);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlight(0);
    if (TREE_CACHE) {
      setTree(TREE_CACHE);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchTree()
      .then((courses) => {
        if (cancelled) return;
        setTree(courses);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setTree([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const rows = useMemo<Row[]>(() => {
    const needle = query.trim().toLowerCase();
    const out: Row[] = [];

    if (mode === "course") {
      for (const course of tree) {
        const hay = `${course.title} ${course.category ?? ""} ${areaLabel(course.area)}`.toLowerCase();
        if (needle && !hay.includes(needle)) continue;
        out.push({
          pick: {
            type: "course",
            area: course.area,
            courseId: course.courseId,
            title: course.title,
          },
          label: course.title,
          sublabel: course.category
            ? `${areaLabel(course.area)} · ${course.category}`
            : areaLabel(course.area),
        });
        if (out.length >= RESULT_LIMIT) break;
      }
      return out;
    }

    for (const course of tree) {
      for (const lesson of course.lessons) {
        const hay = `${lesson.title} ${course.title} ${lesson.section ?? ""} ${areaLabel(course.area)}`.toLowerCase();
        if (needle && !hay.includes(needle)) continue;
        const sub = [areaLabel(course.area), course.title, lesson.section]
          .filter(Boolean)
          .join(" · ");
        out.push({
          pick: {
            type: "lesson",
            area: course.area,
            courseId: course.courseId,
            lessonId: lesson.lessonId,
            title: lesson.title,
          },
          label: lesson.title,
          sublabel: sub,
          emoji: lesson.emoji,
        });
        if (out.length >= RESULT_LIMIT) break;
      }
      if (out.length >= RESULT_LIMIT) break;
    }
    return out;
  }, [tree, query, mode]);

  const safeHighlight = rows.length === 0 ? 0 : Math.min(highlight, rows.length - 1);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((i) => (rows.length === 0 ? 0 : (i + 1) % rows.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((i) =>
          rows.length === 0 ? 0 : (i - 1 + rows.length) % rows.length
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const row = rows[safeHighlight];
        if (row) onPick(row.pick);
      }
    },
    [rows, safeHighlight, onClose, onPick]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-[10vh]"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={mode === "course" ? "Insert course" : "Insert lesson"}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">
            {mode === "course" ? "Insert course" : "Insert lesson"}
          </h3>
          <button
            type="button"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-3 pb-2 pt-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              placeholder={
                mode === "course" ? "Search courses…" : "Search lessons…"
              }
              className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-auto px-1 pb-2" role="listbox">
          {loading ? (
            <li className="px-3 py-3 text-sm text-slate-500">Loading…</li>
          ) : rows.length === 0 ? (
            <li className="px-3 py-3 text-sm text-slate-500">
              {mode === "course" ? "No courses found" : "No lessons found"}
            </li>
          ) : (
            rows.map((row, idx) => {
              const active = idx === safeHighlight;
              return (
                <li
                  key={`${row.pick.type}:${row.pick.area}:${row.pick.courseId}:${
                    row.pick.type === "lesson" ? row.pick.lessonId : ""
                  }`}
                  role="option"
                  aria-selected={active}
                >
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm ${
                      active ? "bg-amber-50" : "hover:bg-slate-50"
                    }`}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => onPick(row.pick)}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                      {row.emoji ? (
                        <span className="text-base leading-none">{row.emoji}</span>
                      ) : row.pick.type === "lesson" ? (
                        <BookOpen className="h-4 w-4" strokeWidth={2} />
                      ) : (
                        <GraduationCap className="h-4 w-4" strokeWidth={2} />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium text-slate-900">
                        {row.label}
                      </span>
                      <span className="truncate text-xs text-slate-500">
                        {row.sublabel}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
