"use client";

import { ArrowRight, BookOpen } from "lucide-react";

import { useSelectLessonTab } from "./LessonPlayerTabs";
import { buttonClass } from "@/components/ui/Button";

/** Sends the reader from the Overview summary into the full written guide. */
export function LessonGuideCta() {
  const selectTab = useSelectLessonTab();

  return (
    <button
      type="button"
      onClick={() => selectTab?.("guide")}
      className={buttonClass("main", "normal", "mt-5")}
    >
      <BookOpen className="h-4 w-4" aria-hidden />
      Read the full guide
      <ArrowRight className="h-4 w-4" aria-hidden />
    </button>
  );
}
