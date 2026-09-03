import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type SalesNavImportRunRow = {
  id: string;
  createdAt: string;
  coachId: string;
  coachName: string | null;
  coachBusinessName: string | null;
  name: string | null;
  status: "pending" | "running" | "succeeded" | "failed";
  scrapedCount: number;
  progressCount: number;
  cacheInserted: number;
  cacheUpdated: number;
  cacheSkipped: number;
  takePages: number | null;
  estimatedCostUsd: number;
  /** Wall-clock ms for scrape + cache (null on legacy rows). */
  durationMs: number | null;
  profileScraperMode: string;
  provider: "apify" | "unipile";
  savedToList: boolean;
  salesNavUrl: string | null;
  errorMessage: string | null;
};

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("sales_nav_import_runs")
    .select(
      "id, created_at, coach_id, name, status, scraped_count, progress_count, cache_inserted, cache_updated, cache_skipped, take_pages, estimated_cost_usd, duration_ms, profile_scraper_mode, saved_to_list, sales_nav_url, error_message, provider"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const coachIds = [...new Set(rows.map((r) => r.coach_id).filter(Boolean))];
  const profileById = new Map<
    string,
    { full_name: string | null; coach_business_name: string | null }
  >();

  if (coachIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, coach_business_name")
      .in("id", coachIds);
    for (const p of profiles ?? []) {
      profileById.set(p.id, {
        full_name: p.full_name ?? null,
        coach_business_name: p.coach_business_name ?? null,
      });
    }
  }

  const runs: SalesNavImportRunRow[] = rows.map((r) => {
    const profile = profileById.get(r.coach_id);
    const status =
      r.status === "pending" ||
      r.status === "running" ||
      r.status === "failed" ||
      r.status === "succeeded"
        ? r.status
        : "succeeded";
    return {
      id: r.id,
      createdAt: r.created_at,
      coachId: r.coach_id,
      coachName:
        profile?.full_name?.trim() ||
        profile?.coach_business_name?.trim() ||
        null,
      coachBusinessName: profile?.coach_business_name ?? null,
      name: typeof r.name === "string" && r.name.trim() ? r.name.trim() : null,
      status,
      scrapedCount: r.scraped_count ?? 0,
      progressCount: r.progress_count ?? 0,
      cacheInserted: r.cache_inserted ?? 0,
      cacheUpdated: r.cache_updated ?? 0,
      cacheSkipped: r.cache_skipped ?? 0,
      takePages: r.take_pages ?? null,
      estimatedCostUsd: Number(r.estimated_cost_usd ?? 0),
      durationMs:
        typeof r.duration_ms === "number" && Number.isFinite(r.duration_ms)
          ? r.duration_ms
          : null,
      profileScraperMode: r.profile_scraper_mode ?? "Short",
      provider: r.provider === "unipile" ? "unipile" : "apify",
      savedToList: Boolean(r.saved_to_list),
      salesNavUrl: r.sales_nav_url ?? null,
      errorMessage:
        typeof r.error_message === "string" ? r.error_message : null,
    };
  });

  const completed = runs.filter((r) => r.status === "succeeded");
  const totals = completed.reduce(
    (acc, run) => {
      acc.scraped += run.scrapedCount;
      acc.inserted += run.cacheInserted;
      acc.updated += run.cacheUpdated;
      acc.costUsd += run.estimatedCostUsd;
      if (run.durationMs != null && run.takePages != null && run.takePages > 0) {
        acc.durationMsSum += run.durationMs;
        acc.durationRuns += 1;
      }
      return acc;
    },
    {
      scraped: 0,
      inserted: 0,
      updated: 0,
      costUsd: 0,
      durationMsSum: 0,
      durationRuns: 0,
    }
  );

  return NextResponse.json({
    runs,
    totals: {
      scraped: totals.scraped,
      inserted: totals.inserted,
      updated: totals.updated,
      costUsd: Number(totals.costUsd.toFixed(4)),
      runCount: completed.length,
      avgDurationMs:
        totals.durationRuns > 0
          ? Math.round(totals.durationMsSum / totals.durationRuns)
          : null,
    },
  });
}
