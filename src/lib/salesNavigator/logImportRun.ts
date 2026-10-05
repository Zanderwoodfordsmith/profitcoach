import { estimateSalesNavShortCostUsd } from "@/lib/salesNavigator/apifyCost";
import type { SalesNavImportLeadSnapshot } from "@/lib/salesNavigator/importLeadSnapshot";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { salesNavUrlForUnipile } from "@/lib/unipile/linkedinSearchCursor";

export type LogSalesNavImportRunInput = {
  coachId: string;
  salesNavUrl?: string | null;
  /** Optional display name for History / admin. */
  name?: string | null;
  /** Pages requested from Apify. Null/0 when saving already-scraped leads (no Apify charge). */
  takePages?: number | null;
  scrapedCount: number;
  cacheInserted: number;
  cacheUpdated: number;
  cacheSkipped: number;
  savedToList?: boolean;
  listId?: string | null;
  /** True when Apify was called for this request. */
  apifyCharged?: boolean;
  /** Wall-clock ms for this request (scrape + cache, or save-only). */
  durationMs?: number | null;
  /** Compact leads for History UI. */
  leadSnapshot?: SalesNavImportLeadSnapshot[] | null;
};

export type LogSalesNavImportRunResult = {
  ok: boolean;
  id?: string;
  error?: string;
};

export async function logSalesNavImportRun(
  input: LogSalesNavImportRunInput
): Promise<LogSalesNavImportRunResult> {
  const takePages =
    input.apifyCharged === false
      ? null
      : Math.max(0, Math.floor(input.takePages ?? 0)) || null;
  const estimatedCostUsd =
    takePages != null ? estimateSalesNavShortCostUsd(takePages) : 0;
  const durationMs =
    input.durationMs != null && Number.isFinite(input.durationMs)
      ? Math.max(0, Math.round(input.durationMs))
      : null;
  const leadSnapshot = Array.isArray(input.leadSnapshot)
    ? input.leadSnapshot
    : [];

  const fullRow = {
    coach_id: input.coachId,
    sales_nav_url: input.salesNavUrl?.trim() || null,
    name: input.name?.trim() || null,
    take_pages: takePages,
    scraped_count: input.scrapedCount,
    cache_inserted: input.cacheInserted,
    cache_updated: input.cacheUpdated,
    cache_skipped: input.cacheSkipped,
    saved_to_list: Boolean(input.savedToList),
    list_id: input.listId ?? null,
    profile_scraper_mode: "Short",
    estimated_cost_usd: estimatedCostUsd,
    duration_ms: durationMs,
    lead_snapshot: leadSnapshot,
  };

  let { data, error } = await supabaseAdmin
    .from("sales_nav_import_runs")
    .insert(fullRow)
    .select("id")
    .single();

  // PostgREST schema cache can lag after migrations — retry without new cols.
  if (
    error &&
    /duration_ms|lead_snapshot|\bname\b|schema cache|Could not find/i.test(
      error.message
    )
  ) {
    const retry = await supabaseAdmin
      .from("sales_nav_import_runs")
      .insert({
        coach_id: input.coachId,
        sales_nav_url: input.salesNavUrl?.trim() || null,
        take_pages: takePages,
        scraped_count: input.scrapedCount,
        cache_inserted: input.cacheInserted,
        cache_updated: input.cacheUpdated,
        cache_skipped: input.cacheSkipped,
        saved_to_list: Boolean(input.savedToList),
        list_id: input.listId ?? null,
        profile_scraper_mode: "Short",
        estimated_cost_usd: estimatedCostUsd,
      })
      .select("id")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("sales_nav_import_runs insert failed:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data?.id };
}

/**
 * A pasted Sales Nav link we refused. Shows on Admin → Sales Nav imports
 * so the URL shape is there without waiting on a support reply.
 * sessionId is stripped before the row is stored.
 */
export async function logRejectedSalesNavImport(input: {
  coachId: string;
  salesNavUrl: string;
  reason: string;
  message: string;
}): Promise<void> {
  const salesNavUrl = salesNavUrlForUnipile(input.salesNavUrl).slice(0, 4000);
  const message = input.message.slice(0, 2000);
  console.error(
    "[sales-nav-import] rejected",
    input.reason,
    input.coachId,
    salesNavUrl
  );
  const { error } = await supabaseAdmin.from("sales_nav_import_runs").insert({
    coach_id: input.coachId,
    sales_nav_url: salesNavUrl || null,
    name: `Rejected ${input.reason.replace(/_/g, " ")}`,
    status: "failed",
    error_message: message,
    provider: "unipile",
    profile_scraper_mode: "Unipile",
    scraped_count: 0,
    finished_at: new Date().toISOString(),
  });
  if (error) {
    console.error("sales_nav_import_runs reject log failed:", error.message);
  }
}
