import { ExternalLink } from "lucide-react";

import {
  defaultCompanyKeywords,
  defaultJobTitleKeywords,
} from "@/lib/salesNavigator/baseSearchDefaults";
import { buildSalesNavSearchUrl } from "@/lib/salesNavigator/buildSalesNavSearchUrl";

const BASE_SEARCH_LESSON_ID =
  "client-acquisition-ideal-clients-linkedin-sales-navigator-build-your-base-search";

/** Pre-filled Classroom base search (UK, owners/CEOs, 1–200, 2nd+3rd). */
const SALES_NAV_BASE_SEARCH_URL = buildSalesNavSearchUrl({
  titleKeywords: defaultJobTitleKeywords(),
  companyKeywords: defaultCompanyKeywords(),
  teamSizes: ["1-10", "11-50", "51-200"],
  location: "United Kingdom",
  degrees: ["2", "3"],
});

/** Shown only on the Build Your Base Search lesson — Overview + Guide. */
export function LessonBaseSearchCta({ lessonId }: { lessonId: string }) {
  if (lessonId !== BASE_SEARCH_LESSON_ID) return null;

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
