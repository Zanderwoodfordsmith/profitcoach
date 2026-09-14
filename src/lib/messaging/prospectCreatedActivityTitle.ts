/** Pool / import sources stored on `contacts.prospect_source`. */
const POOL_IMPORT_SOURCES = new Set([
  "google_maps",
  "sales_nav",
  "sales_nav_csv",
  "sales_navigator",
  "lead_finder",
  "connections",
  "search",
  "campaign_import",
]);

export function prospectCreatedActivityTitle(opts: {
  isClient: boolean;
  prospectSource?: string | null;
}): string {
  if (opts.isClient) return "Became a client";
  const source = (opts.prospectSource || "").trim().toLowerCase();
  if (POOL_IMPORT_SOURCES.has(source)) return "Imported into pool";
  return "Added as a prospect";
}
