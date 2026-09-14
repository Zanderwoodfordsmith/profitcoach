import {
  defaultCompanyKeywords,
  defaultJobTitleKeywords,
} from "@/lib/salesNavigator/baseSearchDefaults";
import {
  buildSalesNavSearchUrl,
  type SalesNavDegree,
} from "@/lib/salesNavigator/buildSalesNavSearchUrl";
import {
  BASE_SEARCH_DEGREES,
  BASE_SEARCH_TEAM_SIZES,
} from "@/lib/salesNavigator/prospectSearch/applyStrategy";

/** Logged-in Sales Navigator home. */
export const SALES_NAV_HOME_URL = "https://www.linkedin.com/sales/home";

function classroomBaseSearchUrl(opts?: {
  degrees?: SalesNavDegree[];
  postedOnLinkedIn?: boolean;
}): string {
  const degrees = opts?.degrees ?? [...BASE_SEARCH_DEGREES];
  const firstDegreeOnly = degrees.length === 1 && degrees[0] === "1";
  return buildSalesNavSearchUrl({
    titleKeywords: defaultJobTitleKeywords(),
    companyKeywords: defaultCompanyKeywords(),
    teamSizes: [...BASE_SEARCH_TEAM_SIZES],
    location: firstDegreeOnly ? null : "United Kingdom",
    degrees,
    postedOnLinkedIn: opts?.postedOnLinkedIn,
  });
}

/** Classroom base search (UK, owners/CEOs, 1–200, 2nd + 3rd). */
export const SALES_NAV_BASE_SEARCH_URL = classroomBaseSearchUrl();

/** Same base search, 1st-degree only — no geography. */
export const SALES_NAV_BASE_SEARCH_1ST_URL = classroomBaseSearchUrl({
  degrees: ["1"],
});
