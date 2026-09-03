import { NextResponse } from "next/server";
import { requireLeadFinderAccess } from "@/lib/requireLeadFinderAccess";
import { targetCountForJob } from "@/lib/salesNavigator/importJob";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type SalesNavImportHistoryItem = {
  id: string;
  name: string | null;
  status: "pending" | "running" | "succeeded" | "failed";
  createdAt: string;
  scrapedCount: number;
  scrapedTotal: number;
  progressCount: number;
  targetCount: number | null;
  takePages: number | null;
  requestedTakePages: number | null;
  durationMs: number | null;
  estimatedCostUsd: number;
  provider: "apify" | "unipile";
  salesNavUrl: string | null;
  cacheInserted: number;
  cacheUpdated: number;
  errorMessage: string | null;
};

/** Recent Sales Nav imports for the signed-in Lead Finder user (History UI). */
export async function GET(request: Request) {
  const auth = await requireLeadFinderAccess(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  // Fast list only — do NOT sync Apify here (that hung History mid-import).
  // Progress advances via toast/panel poll, GET …/runs/[id], and cron.

  const { data, error } = await supabaseAdmin
    .from("sales_nav_import_runs")
    .select(
      "id, name, status, created_at, scraped_count, progress_count, take_pages, requested_take_pages, duration_ms, estimated_cost_usd, sales_nav_url, cache_inserted, cache_updated, error_message, provider"
    )
    .eq("coach_id", auth.userId)
    .not("take_pages", "is", null)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const runs: SalesNavImportHistoryItem[] = (data ?? []).map((r) => {
    const status =
      r.status === "pending" ||
      r.status === "running" ||
      r.status === "failed" ||
      r.status === "succeeded"
        ? r.status
        : "succeeded";
    const targetCount = targetCountForJob({
      requested_take_pages: r.requested_take_pages,
      take_pages: r.take_pages,
    });
    const scrapedTotal = r.scraped_count ?? 0;
    const delivered =
      status === "succeeded"
        ? Math.min(scrapedTotal, targetCount)
        : scrapedTotal;
    return {
      id: r.id,
      name: typeof r.name === "string" && r.name.trim() ? r.name.trim() : null,
      status,
      createdAt: r.created_at,
      scrapedCount: delivered,
      scrapedTotal,
      progressCount: r.progress_count ?? 0,
      targetCount,
      takePages: r.take_pages ?? null,
      requestedTakePages: r.requested_take_pages ?? r.take_pages ?? null,
      durationMs:
        typeof r.duration_ms === "number" && Number.isFinite(r.duration_ms)
          ? r.duration_ms
          : null,
      estimatedCostUsd: Number(r.estimated_cost_usd ?? 0),
      provider: r.provider === "unipile" ? "unipile" : "apify",
      salesNavUrl: r.sales_nav_url ?? null,
      cacheInserted: r.cache_inserted ?? 0,
      cacheUpdated: r.cache_updated ?? 0,
      errorMessage:
        typeof r.error_message === "string" ? r.error_message : null,
    };
  });

  return NextResponse.json({ runs });
}
