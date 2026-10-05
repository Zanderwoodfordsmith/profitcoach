import { queryBlobFromSalesNavUrl } from "@/lib/salesNavigator/salesNavUrlRewrite";
import { parseSalesNavSearchUrl } from "@/lib/salesNavigator/parseSalesNavFilters";

function includedTexts(blob: string, type: string): string[] {
  const marker = `type:${type},values:List(`;
  const start = blob.indexOf(marker);
  if (start < 0) return [];
  const next = blob.indexOf(",(type:", start + marker.length);
  const slice = blob.slice(start, next === -1 ? start + 1200 : next);
  const out: string[] = [];
  for (const match of slice.matchAll(/text:([^,]+),selectionType:INCLUDED/g)) {
    let text = match[1] ?? "";
    try {
      text = decodeURIComponent(text);
    } catch {
      // Already decoded.
    }
    text = text.replace(/\+/g, " ").trim();
    if (text && !out.includes(text)) out.push(text);
  }
  return out;
}

function staffLabel(teamSizes: string[]): string | null {
  if (teamSizes.length === 0) return null;
  if (
    teamSizes.length === 2 &&
    teamSizes.includes("11-50") &&
    teamSizes.includes("51-200")
  ) {
    return "11–200";
  }
  if (teamSizes.length <= 2) return teamSizes.join(" and ");
  return `${teamSizes[0]}–${teamSizes[teamSizes.length - 1]}`;
}

/** Short pool-list title from a people-search URL. */
export function suggestSalesNavListName(salesNavUrl: string): string {
  const parsed = parseSalesNavSearchUrl(salesNavUrl);
  const blob = queryBlobFromSalesNavUrl(salesNavUrl);
  const industries = includedTexts(blob, "INDUSTRY");
  const companies = parsed.companyKeywords
    .filter((keyword) => keyword.mode === "include")
    .map((keyword) => keyword.term);
  const who = industries[0] || companies[0] || "Owners";
  const place = parsed.location;
  const staff = staffLabel(parsed.teamSizes);
  const parts = [
    industries.length || companies.length ? `${who} owners` : "Owners",
    place,
    staff,
  ].filter(Boolean);
  const name = parts.join(", ");
  return name.length > 80 ? `${name.slice(0, 77)}…` : name;
}

export function summarizeSalesNavSearch(salesNavUrl: string): {
  location: string | null;
  team_sizes: string[];
  degrees: string[];
  industries: string[];
  company_includes: string[];
  company_excludes: string[];
  title_includes: string[];
  suggested_list_name: string;
} {
  const parsed = parseSalesNavSearchUrl(salesNavUrl);
  const blob = queryBlobFromSalesNavUrl(salesNavUrl);
  return {
    location: parsed.location,
    team_sizes: parsed.teamSizes,
    degrees: parsed.degrees,
    industries: includedTexts(blob, "INDUSTRY"),
    company_includes: parsed.companyKeywords
      .filter((keyword) => keyword.mode === "include")
      .map((keyword) => keyword.term),
    company_excludes: parsed.companyKeywords
      .filter((keyword) => keyword.mode === "exclude")
      .map((keyword) => keyword.term),
    title_includes: parsed.titleKeywords
      .filter((keyword) => keyword.mode === "include")
      .map((keyword) => keyword.term),
    suggested_list_name: suggestSalesNavListName(salesNavUrl),
  };
}
