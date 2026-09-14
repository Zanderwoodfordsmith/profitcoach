import {
  snapshotToSalesNavImportedLead,
  type SalesNavImportLeadSnapshot,
} from "@/lib/salesNavigator/importLeadSnapshot";
import {
  targetCountForJob,
  type SalesNavImportJobRow,
} from "@/lib/salesNavigator/importJob";

export function salesNavImportJobPayload(
  job: SalesNavImportJobRow,
  opts?: { includeLeads?: boolean }
) {
  const includeLeads = opts?.includeLeads !== false;
  const targetCount = targetCountForJob(job);
  const scrapeTargetCount =
    typeof job.take_pages === "number" && job.take_pages > 0
      ? job.take_pages * 25
      : targetCount;
  const rawSnap = Array.isArray(job.lead_snapshot) ? job.lead_snapshot : [];
  const allLeads = includeLeads
    ? rawSnap
        .filter((row): row is SalesNavImportLeadSnapshot =>
          Boolean(row && typeof row === "object")
        )
        .map(snapshotToSalesNavImportedLead)
    : [];
  const leads = job.segmented ? allLeads : allLeads.slice(0, targetCount);
  const scrapedTotal = job.scraped_count || allLeads.length || job.progress_count;
  const deliveredCount = includeLeads ? leads.length : job.scraped_count;
  const progressCount = job.progress_count ?? 0;
  const segmentIndex = job.segment_index ?? 0;
  const segmentTotal = job.segment_total ?? 1;
  const currentSegment = job.segment_plan?.[segmentIndex] ?? null;
  const phase =
    job.status === "pending" || job.status === "running"
      ? progressCount >= targetCount && !job.segmented
        ? ("finalizing" as const)
        : ("scraping" as const)
      : null;

  return {
    run: {
      id: job.id,
      name:
        typeof job.name === "string" && job.name.trim()
          ? job.name.trim()
          : null,
      status: job.status,
      createdAt: job.created_at,
      startedAt: job.started_at,
      finishedAt: job.finished_at,
      scrapedCount: deliveredCount,
      scrapedTotal,
      progressCount,
      targetCount,
      scrapeTargetCount,
      phase,
      takePages: job.take_pages ?? null,
      requestedTakePages: job.requested_take_pages ?? job.take_pages ?? null,
      durationMs: job.duration_ms,
      estimatedCostUsd: Number(job.estimated_cost_usd ?? 0),
      provider: job.provider,
      salesNavUrl: job.sales_nav_url ?? null,
      cacheInserted: job.cache_inserted ?? 0,
      cacheUpdated: job.cache_updated ?? 0,
      errorMessage: job.error_message,
      segmented: job.segmented,
      segmentIndex,
      segmentTotal,
      segmentLabel: currentSegment?.label ?? null,
      segmentPlan: job.segment_plan ?? null,
      listId: job.list_id,
      saveListId: job.save_list_id,
      savedToList: job.saved_to_list,
    },
    leads,
    exportLeads: allLeads,
    status: job.status,
    progressCount,
    targetCount,
    scrapeTargetCount,
    phase,
    scrapedCount: deliveredCount,
    scrapedTotal,
    durationMs: job.duration_ms,
    error: job.error_message,
    added: deliveredCount,
    saveListId: job.save_list_id,
  };
}
