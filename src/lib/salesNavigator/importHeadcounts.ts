import {
  DEFAULT_IMPORT_SEGMENT_TEAM_SIZES,
  SALES_NAV_HEADCOUNT_BANDS,
  sortHeadcountLabels,
  type SalesNavHeadcountBand,
} from "@/lib/salesNavigator/headcountBands";
import { teamSizesFromSalesNavUrl } from "@/lib/salesNavigator/parseSalesNavFilters";
import { rewriteSalesNavUrlHeadcounts } from "@/lib/salesNavigator/salesNavUrlRewrite";

export function implicitImportTeamSizes(salesNavUrl: string): string[] {
  const fromUrl = sortHeadcountLabels(teamSizesFromSalesNavUrl(salesNavUrl));
  return fromUrl.length > 0 ? fromUrl : [...DEFAULT_IMPORT_SEGMENT_TEAM_SIZES];
}

export function extraImportTeamSizeOptions(
  salesNavUrl: string
): SalesNavHeadcountBand[] {
  const locked = new Set(implicitImportTeamSizes(salesNavUrl));
  return SALES_NAV_HEADCOUNT_BANDS.filter((band) => !locked.has(band.label));
}

export function formatImportTeamSizeList(labels: string[]): string {
  const sorted = sortHeadcountLabels(labels);
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return sorted[0]!;
  if (sorted.length === 2) return `${sorted[0]} and ${sorted[1]}`;
  return `${sorted.slice(0, -1).join(", ")} and ${sorted[sorted.length - 1]}`;
}

export function salesNavUrlWithImportTeamSizes(
  salesNavUrl: string,
  extraLabels: string[]
): string {
  const base = implicitImportTeamSizes(salesNavUrl);
  const extras = extraLabels.filter((label) => !base.includes(label));
  const all = sortHeadcountLabels([...base, ...extras]);
  const current = sortHeadcountLabels(teamSizesFromSalesNavUrl(salesNavUrl));
  if (
    current.length === all.length &&
    current.every((label, i) => label === all[i])
  ) {
    return salesNavUrl;
  }
  return rewriteSalesNavUrlHeadcounts(salesNavUrl, all);
}
