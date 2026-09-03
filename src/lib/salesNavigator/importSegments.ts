/**
 * Plan segmented Sales Nav imports: always split by team size first.
 * Years-at-company / years-in-role sub-splits happen at runtime on Unipile
 * when paging.total_count shows a band is still over LinkedIn’s 2,500 cap.
 * Apify has no fast total, so the planner does not years-split up front.
 */

import { SALES_NAV_MAX_LEADS } from "@/lib/apify/salesNavigatorTypes";
import type { SalesNavYearsAtCompanyId } from "@/lib/salesNavigator/buildSalesNavSearchUrl";
import {
  DEFAULT_IMPORT_SEGMENT_TEAM_SIZES,
  sortHeadcountLabels,
} from "@/lib/salesNavigator/headcountBands";
import {
  parseSalesNavSearchUrl,
  teamSizesFromSalesNavUrl,
} from "@/lib/salesNavigator/parseSalesNavFilters";
import {
  rewriteSalesNavUrlHeadcounts,
  rewriteSalesNavUrlYearsAtCompany,
  rewriteSalesNavUrlYearsAtPosition,
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
  yearsInRole: SalesNavYearsAtCompanyId | null;
  status: SalesNavImportSegmentStatus;
  scrapedCount: number;
  cacheInserted: number;
  cacheUpdated: number;
  errorMessage: string | null;
};

type SalesNavImportSegmentDraft = Omit<
  SalesNavImportSegmentPlan,
  "status" | "scrapedCount" | "cacheInserted" | "cacheUpdated" | "errorMessage"
>;

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
): SalesNavImportSegmentDraft[] {
  return teamSizes.map((teamSize) => ({
    id: segmentId(["team", teamSize]),
    label: teamSize,
    salesNavUrl: rewriteSalesNavUrlHeadcounts(baseUrl, [teamSize]),
    teamSize,
    yearsAtCompany: null,
    yearsInRole: null,
  }));
}

function expandYearsAtCompanySubSegments(
  segment: SalesNavImportSegmentDraft,
  yearsIds: SalesNavYearsAtCompanyId[]
): SalesNavImportSegmentDraft[] {
  return yearsIds.map((yearsId) => ({
    id: segmentId(["team", segment.teamSize ?? "?", "years", yearsId]),
    label: `${segment.label} · ${YEARS_LABEL[yearsId]}`,
    salesNavUrl: rewriteSalesNavUrlYearsAtCompany(segment.salesNavUrl, [
      yearsId,
    ]),
    teamSize: segment.teamSize,
    yearsAtCompany: yearsId,
    yearsInRole: segment.yearsInRole,
  }));
}

function expandYearsInRoleSubSegments(
  segment: SalesNavImportSegmentDraft,
  yearsIds: SalesNavYearsAtCompanyId[]
): SalesNavImportSegmentDraft[] {
  return yearsIds.map((yearsId) => ({
    id: segmentId([
      "team",
      segment.teamSize ?? "?",
      "years",
      segment.yearsAtCompany ?? "?",
      "role",
      yearsId,
    ]),
    label: `${segment.label} · role ${YEARS_LABEL[yearsId]}`,
    salesNavUrl: rewriteSalesNavUrlYearsAtPosition(segment.salesNavUrl, [
      yearsId,
    ]),
    teamSize: segment.teamSize,
    yearsAtCompany: segment.yearsAtCompany,
    yearsInRole: yearsId,
  }));
}

function asDraft(
  segment: SalesNavImportSegmentPlan | SalesNavImportSegmentDraft
): SalesNavImportSegmentDraft {
  return {
    id: segment.id,
    label: segment.label,
    salesNavUrl: segment.salesNavUrl,
    teamSize: segment.teamSize,
    yearsAtCompany: segment.yearsAtCompany,
    yearsInRole: segment.yearsInRole ?? null,
  };
}

/**
 * Finer URLs to get past LinkedIn’s 2,500 extract cap: years at company first,
 * then years in current role. Returns null when this segment cannot split further
 * (already a single tenure bucket, or the pasted URL already pinned one).
 */
export function subSplitOverExtractCap(
  segment: SalesNavImportSegmentPlan | SalesNavImportSegmentDraft
): SalesNavImportSegmentDraft[] | null {
  const draft = asDraft(segment);
  const parsed = parseSalesNavSearchUrl(draft.salesNavUrl);
  const companyOnUrl = parsed.yearsAtCurrentCompany;
  const roleOnUrl = parsed.yearsAtCurrentPosition;

  const alreadySingleCompanyYear =
    draft.yearsAtCompany != null || companyOnUrl.length === 1;
  if (!alreadySingleCompanyYear) {
    const buckets =
      companyOnUrl.length > 1 ? companyOnUrl : YEARS_AT_COMPANY_BUCKETS;
    if (buckets.length <= 1) return null;
    return expandYearsAtCompanySubSegments(draft, buckets);
  }

  const alreadySingleRoleYear =
    draft.yearsInRole != null || roleOnUrl.length === 1;
  if (!alreadySingleRoleYear) {
    const buckets = roleOnUrl.length > 1 ? roleOnUrl : YEARS_AT_COMPANY_BUCKETS;
    if (buckets.length <= 1) return null;
    return expandYearsInRoleSubSegments(draft, buckets);
  }

  return null;
}

export function shouldProbeSalesNavExtractCap(
  segment: SalesNavImportSegmentPlan | SalesNavImportSegmentDraft
): boolean {
  return subSplitOverExtractCap(segment) != null;
}

/** LinkedIn Sales Nav silently caps extractable people at this many per query. */
export const SALES_NAV_EXTRACT_CAP = SALES_NAV_MAX_LEADS;

export function spliceSegmentPlan(
  plan: SalesNavImportSegmentPlan[],
  index: number,
  children: SalesNavImportSegmentDraft[]
): SalesNavImportSegmentPlan[] {
  if (!children.length) return plan;
  const rows = children.map((child, i) => ({
    ...emptySegmentPlanRow(child),
    status: (i === 0 ? "running" : "pending") as SalesNavImportSegmentStatus,
  }));
  return [...plan.slice(0, index), ...rows, ...plan.slice(index + 1)];
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
        yearsInRole: null,
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

  return teamSizeSegments(input.salesNavUrl, teamSizes).map((s) =>
    emptySegmentPlanRow(s)
  );
}

export function emptySegmentPlanRow(
  segment: SalesNavImportSegmentDraft
): SalesNavImportSegmentPlan {
  return {
    ...segment,
    yearsInRole: segment.yearsInRole ?? null,
    status: "pending",
    scrapedCount: 0,
    cacheInserted: 0,
    cacheUpdated: 0,
    errorMessage: null,
  };
}
