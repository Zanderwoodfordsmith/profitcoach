"use client";

import { ArrowRight, BookOpen } from "lucide-react";

import { useSelectLessonTab } from "./LessonPlayerTabs";

/** Sends the reader from the Overview summary into the full written guide. */
export function LessonGuideCta() {
  const selectTab = useSelectLessonTab();

  return (
    <button
      type="button"
      onClick={() => selectTab?.("guide")}
      className="mt-5 inline-flex items-center gap-2 rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-500"
    >
      <BookOpen className="h-4 w-4" aria-hidden />
      Read the full guide
      <ArrowRight className="h-4 w-4" aria-hidden />
    </button>
  );
}
