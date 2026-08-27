/**
 * Plan segmented Sales Nav imports: always split by team size first,
 * then by years at current company when targeting the LinkedIn 2,500 cap.
 */

import type { SalesNavYearsAtCompanyId } from "@/lib/salesNavigator/buildSalesNavSearchUrl";
import {
  DEFAULT_IMPORT_SEGMENT_TEAM_SIZES,
  sortHeadcountLabels,
} from "@/lib/salesNavigator/headcountBands";
import { teamSizesFromSalesNavUrl } from "@/lib/salesNavigator/parseSalesNavFilters";
import {
  rewriteSalesNavUrlHeadcounts,
  rewriteSalesNavUrlYearsAtCompany,
} from "@/lib/salesNavigator/salesNavUrlRewrite";

export type SalesNavImportSegmentStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped";

export type SalesNavImportSegmentPlan = {
  id: string;
  label: string;
  salesNavUrl: string;
  teamSize: string | null;
  yearsAtCompany: SalesNavYearsAtCompanyId | null;
  status: SalesNavImportSegmentStatus;
  scrapedCount: number;
  cacheInserted: number;
  cacheUpdated: number;
  errorMessage: string | null;
};

const YEARS_AT_COMPANY_BUCKETS: SalesNavYearsAtCompanyId[] = [
  "1",
  "2",
  "3",
  "4",
  "5",
];

const YEARS_LABEL: Record<SalesNavYearsAtCompanyId, string> = {
  "1": "<1 yr",
  "2": "1–2 yrs",
  "3": "3–5 yrs",
  "4": "6–10 yrs",
  "5": "10+ yrs",
};

export type PlanSalesNavImportSegmentsInput = {
  salesNavUrl: string;
  /** Coach-requested lead target (pages × 25). */
  targetLeadCount: number;
  /** When false, import the URL as-is (escape hatch). */
  autoSegment?: boolean;
};

function segmentId(parts: string[]): string {
  return parts.join("|");
}

function teamSizeSegments(
  baseUrl: string,
  teamSizes: string[]
): Omit<SalesNavImportSegmentPlan, "status" | "scrapedCount" | "cacheInserted" | "cacheUpdated" | "errorMessage">[] {
  return teamSizes.map((teamSize) => ({
    id: segmentId(["team", teamSize]),
    label: teamSize,
    salesNavUrl: rewriteSalesNavUrlHeadcounts(baseUrl, [teamSize]),
    teamSize,
    yearsAtCompany: null,
  }));
}

function needsYearsSubSplit(
  _url: string,
  _targetLeadCount: number
): boolean {
  // LinkedIn does not expose a reliable total count to Apify before paging finishes.
  // Sub-splitting by tenure without that count creates extra runs for searches under 2,500.
  // Re-enable when we have a count probe (page-1 metadata or actor support).
  return false;
}

function expandYearsSubSegments(
  segment: Omit<
    SalesNavImportSegmentPlan,
    "status" | "scrapedCount" | "cacheInserted" | "cacheUpdated" | "errorMessage"
  >
): Omit<
  SalesNavImportSegmentPlan,
  "status" | "scrapedCount" | "cacheInserted" | "cacheUpdated" | "errorMessage"
>[] {
  return YEARS_AT_COMPANY_BUCKETS.map((yearsId) => ({
    id: segmentId(["team", segment.teamSize ?? "?", "years", yearsId]),
    label: `${segment.label} · ${YEARS_LABEL[yearsId]}`,
    salesNavUrl: rewriteSalesNavUrlYearsAtCompany(segment.salesNavUrl, [
      yearsId,
    ]),
    teamSize: segment.teamSize,
    yearsAtCompany: yearsId,
  }));
}

export function planSalesNavImportSegments(
  input: PlanSalesNavImportSegmentsInput
): SalesNavImportSegmentPlan[] {
  const autoSegment = input.autoSegment !== false;
  if (!autoSegment) {
    return [
      {
        id: "single",
        label: "Import",
        salesNavUrl: input.salesNavUrl,
        teamSize: null,
        yearsAtCompany: null,
        status: "pending",
        scrapedCount: 0,
        cacheInserted: 0,
        cacheUpdated: 0,
        errorMessage: null,
      },
    ];
  }

  const fromUrl = sortHeadcountLabels(teamSizesFromSalesNavUrl(input.salesNavUrl));
  const teamSizes =
    fromUrl.length > 0
      ? fromUrl
      : [...DEFAULT_IMPORT_SEGMENT_TEAM_SIZES];

  const primary =
    teamSizes.length === 1
      ? teamSizeSegments(input.salesNavUrl, teamSizes)
      : teamSizeSegments(input.salesNavUrl, teamSizes);

  const expanded: Omit<
    SalesNavImportSegmentPlan,
    "status" | "scrapedCount" | "cacheInserted" | "cacheUpdated" | "errorMessage"
  >[] = [];

  for (const segment of primary) {
    if (needsYearsSubSplit(segment.salesNavUrl, input.targetLeadCount)) {
      expanded.push(...expandYearsSubSegments(segment));
    } else {
      expanded.push(segment);
    }
  }

  return expanded.map((s) => ({
    ...s,
    status: "pending" as const,
    scrapedCount: 0,
    cacheInserted: 0,
    cacheUpdated: 0,
    errorMessage: null,
  }));
}

export function emptySegmentPlanRow(
  segment: Omit<
    SalesNavImportSegmentPlan,
    "status" | "scrapedCount" | "cacheInserted" | "cacheUpdated" | "errorMessage"
  >
): SalesNavImportSegmentPlan {
  return {
    ...segment,
    status: "pending",
    scrapedCount: 0,
    cacheInserted: 0,
    cacheUpdated: 0,
    errorMessage: null,
  };
}
