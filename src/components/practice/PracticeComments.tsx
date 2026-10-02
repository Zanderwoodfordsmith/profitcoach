"use client";

import { useState } from "react";
import { X } from "lucide-react";

import type { PracticeNote } from "@/lib/practiceKnowledge/types";

import { usePractice } from "./PracticeProvider";

function commentTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function PracticeComments({
  page,
  notes,
  onClose,
  fill = false,
}: {
  page: string;
  notes: PracticeNote[];
  onClose: () => void;
  /** Fill the admin blueprint column instead of sticking to the viewport. */
  fill?: boolean;
}) {
  const { addNote } = usePractice();
  const [body, setBody] = useState("");
  const pageNotes = notes.filter((note) => note.page === page);

  function submit() {
    const text = body.trim();
    if (!text) return;
    setBody("");
    addNote(text, page);
  }

  return (
    <aside
      className={`flex w-full shrink-0 flex-col border-t border-slate-200 bg-white lg:w-80 lg:border-l lg:border-t-0 ${
        fill ? "lg:h-full lg:min-h-0" : "lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)]"
      }`}
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Comments</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          aria-label="Close comments"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <ul className="min-h-24 flex-1 space-y-3 overflow-y-auto px-4 pb-3">
        {pageNotes.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
            No comments on this page yet.
          </li>
        ) : (
          pageNotes.map((note) => (
            <li key={note.id} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                Y
              </span>
              <div className="min-w-0">
                <p className="text-sm text-slate-900">
                  <span className="font-semibold">You</span>{" "}
                  <span className="text-xs font-normal text-slate-500">{commentTime(note.at)}</span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6 text-slate-800">{note.body}</p>
              </div>
            </li>
          ))
        )}
      </ul>
      <form
        className="border-t border-slate-200/80 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="sr-only" htmlFor="practice-comment">
          Write a comment
        </label>
        <textarea
          id="practice-comment"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a comment…"
          rows={3}
          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none focus:border-[#0c5290] focus:ring-2 focus:ring-[#0c5290]/25"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={!body.trim()}
            className="rounded-lg bg-[#0c5290] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Comment
          </button>
        </div>
      </form>
    </aside>
  );
}
