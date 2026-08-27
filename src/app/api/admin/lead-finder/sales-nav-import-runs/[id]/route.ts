import { NextResponse } from "next/server";
import { requireLeadFinderAccess } from "@/lib/requireLeadFinderAccess";
import {
  snapshotToSalesNavImportedLead,
  type SalesNavImportLeadSnapshot,
} from "@/lib/salesNavigator/importLeadSnapshot";
import {
  loadImportJob,
  syncSalesNavImportJob,
  targetCountForJob,
  type SalesNavImportJobRow,
} from "@/lib/salesNavigator/importJob";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Ctx = { params: Promise<{ id: string }> };

async function requireOwnedRun(userId: string, id: string) {
  const job = await loadImportJob(id);
  if (!job) return { error: "Import not found.", status: 404 as const };
  if (job.coach_id !== userId) {
    return { error: "Import not found.", status: 404 as const };
  }
  return { data: job };
}

function jobPayload(job: SalesNavImportJobRow) {
  const targetCount = targetCountForJob(job);
  const scrapeTargetCount =
    typeof job.take_pages === "number" && job.take_pages > 0
      ? job.take_pages * 25
      : targetCount;
  const rawSnap = Array.isArray(job.lead_snapshot) ? job.lead_snapshot : [];
  const allLeads = rawSnap
    .filter((row): row is SalesNavImportLeadSnapshot =>
      Boolean(row && typeof row === "object")
    )
    .map(snapshotToSalesNavImportedLead);
  // Segmented imports merge all segments; single runs cap at requested target.
  const leads = job.segmented ? allLeads : allLeads.slice(0, targetCount);
  const scrapedTotal = job.scraped_count || allLeads.length;
  const deliveredCount = leads.length;
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
      salesNavUrl: job.sales_nav_url ?? null,
      cacheInserted: job.cache_inserted ?? 0,
      cacheUpdated: job.cache_updated ?? 0,
      errorMessage: job.error_message,
      segmented: job.segmented,
      segmentIndex,
      segmentTotal,
      segmentLabel: currentSegment?.label ?? null,
      segmentPlan: job.segment_plan ?? null,
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
  };
}

/**
 * Load one import run. If still running, syncs Apify status / finalizes first.
 * Client polls this for background-import progress.
 */
export async function GET(request: Request, ctx: Ctx) {
  const auth = await requireLeadFinderAccess(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing run id." }, { status: 400 });
  }

  const owned = await requireOwnedRun(auth.userId, id);
  if ("error" in owned && owned.error) {
    return NextResponse.json(
      { error: owned.error },
      { status: owned.status ?? 500 }
    );
  }

  let job = owned.data!;
  if (job.status === "pending" || job.status === "running") {
    try {
      job = await syncSalesNavImportJob(job.id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not sync import job.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  return NextResponse.json(jobPayload(job));
}

/** Rename an import run. */
export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireLeadFinderAccess(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing run id." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = typeof body.name === "string" ? body.name.trim() || null : null;

  const owned = await requireOwnedRun(auth.userId, id);
  if ("error" in owned && owned.error) {
    return NextResponse.json(
      { error: owned.error },
      { status: owned.status ?? 500 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("sales_nav_import_runs")
    .update({ name })
    .eq("id", id.trim())
    .eq("coach_id", auth.userId)
    .select("id, name")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id: data.id,
    name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : null,
  });
}

/**
 * Remove an import from History. Does not delete leads from the shared cache.
 */
export async function DELETE(request: Request, ctx: Ctx) {
  const auth = await requireLeadFinderAccess(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing run id." }, { status: 400 });
  }

  const owned = await requireOwnedRun(auth.userId, id);
  if ("error" in owned && owned.error) {
    return NextResponse.json(
      { error: owned.error },
      { status: owned.status ?? 500 }
    );
  }

  if (owned.data!.status === "running" || owned.data!.status === "pending") {
    return NextResponse.json(
      { error: "Wait for the import to finish before removing it." },
      { status: 409 }
    );
  }

  const { error } = await supabaseAdmin
    .from("sales_nav_import_runs")
    .delete()
    .eq("id", id.trim())
    .eq("coach_id", auth.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: id.trim() });
}
