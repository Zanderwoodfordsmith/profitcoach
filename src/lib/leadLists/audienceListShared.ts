/**
 * Audience list labels, limits and types, safe for the browser (list queries stay in audienceLists.ts).
 */

export const MAX_POOL_ITEMS_PER_REQUEST = 2_500;

export const AUDIENCE_LIST_KINDS = ["audience", "blacklist", "pool"] as const;

export type AudienceListKind = (typeof AUDIENCE_LIST_KINDS)[number];

export type AudienceListSummary = {
  id: string;
  name: string;
  kind: AudienceListKind;
  source: string;
  item_count: number;
  updated_at: string | null;
  created_at: string | null;
  /** True when this list was created by a pool bulk import. */
  from_pool_import: boolean;
};

export function audienceItemSourceLabel(source: string): string {
  switch (source) {
    case "sales_nav":
    case "sales_nav_csv":
      return "Sales Nav";
    case "lead_finder":
      return "Lead Finder";
    case "connections":
      return "Connections";
    case "search":
      return "Search";
    case "google_maps":
      return "Google Maps";
    case "google_search":
      return "Google Search";
    case "manual":
      return "Added";
    case "mixed":
      return "Mixed";
    default:
      return "List";
  }
}

export function displayListPersonName(input: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const full = input.full_name?.trim();
  if (full) return full;
  const joined = [input.first_name, input.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  return joined || "Unnamed";
}

export function splitPersonName(fullName: string | null | undefined): {
  first_name: string | null;
  last_name: string | null;
} {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first_name: null, last_name: null };
  if (parts.length === 1) return { first_name: parts[0], last_name: null };
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
}

export { isLeadListUuid } from "@/lib/leadLists/leadListId";
