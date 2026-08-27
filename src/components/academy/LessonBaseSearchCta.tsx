import { ExternalLink } from "lucide-react";

import { resolveClassroomLessonId } from "@/lib/academy/classroomIdAliases";
import {
  defaultCompanyKeywords,
  defaultJobTitleKeywords,
} from "@/lib/salesNavigator/baseSearchDefaults";
import { buildSalesNavSearchUrl } from "@/lib/salesNavigator/buildSalesNavSearchUrl";

import {
  SALES_NAV_BASE_SEARCH_LESSON_ID,
  SALES_NAV_CONSOLIDATED_LESSON_ID,
} from "@/lib/academy/lessonVideoChapters";

const BASE_SEARCH_LESSON_ID = SALES_NAV_BASE_SEARCH_LESSON_ID;

/** Pre-filled Classroom base search (UK, owners/CEOs, 1–200, 2nd+3rd). */
const SALES_NAV_BASE_SEARCH_URL = buildSalesNavSearchUrl({
  titleKeywords: defaultJobTitleKeywords(),
  companyKeywords: defaultCompanyKeywords(),
  teamSizes: ["1-10", "11-50", "51-200"],
  location: "United Kingdom",
  degrees: ["2", "3"],
});

/** Shown on Build Your Base Search (legacy or consolidated Sales Nav lesson). */
export function LessonBaseSearchCta({ lessonId }: { lessonId: string }) {
  const resolved = resolveClassroomLessonId(lessonId);
  if (
    resolved !== BASE_SEARCH_LESSON_ID &&
    resolved !== SALES_NAV_CONSOLIDATED_LESSON_ID
  ) {
    return null;
  }

  return (
    <a
      href={SALES_NAV_BASE_SEARCH_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="mb-6 inline-flex max-w-full items-center gap-2 rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-500"
    >
      Look, we&apos;ve done this for you. Now just click here
      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
    </a>
  );
}
