import { NextResponse } from "next/server";
import {
  SalesNavScrapeError,
  type SalesNavImportedLead,
} from "@/lib/apify/salesNavigatorSearch";
import { requireLeadFinderAccess } from "@/lib/requireLeadFinderAccess";
import { mapLeadListRow } from "@/lib/firstCampaign/mapApi";
import { toSalesNavImportLeadSnapshot } from "@/lib/salesNavigator/importLeadSnapshot";
import { createSalesNavImportJob } from "@/lib/salesNavigator/importJob";
import { logSalesNavImportRun } from "@/lib/salesNavigator/logImportRun";
import { getSalesNavSessionCookie } from "@/lib/salesNavigator/sessionStore";
import { upsertSalesNavLeadsToCache } from "@/lib/salesNavigator/upsertSalesNavLeadsToCache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Start returns quickly; Apify runs in the background. */
export const maxDuration = 60;

const MAX_SAVE_ITEMS = 250;
// TODO(sales-nav-lists): Coach-list save is intentionally separate from the
// shared leadrocks cache (which already stores the full import). Raise this
// cap and integrate list save with campaign/list workflows properly — ideas TBD.

function toChunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function isLeadShape(v: unknown): v is SalesNavImportedLead {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return "fullName" in r || "linkedinUrl" in r;
}

async function saveLeadsAsList(opts: {
  coachId: string;
  leads: SalesNavImportedLead[];
  salesNavUrl?: string;
  takePages?: number;
  listName?: string;
}) {
  const capped = opts.leads.slice(0, MAX_SAVE_ITEMS);

  const { data: list, error: listError } = await supabaseAdmin
    .from("coach_lead_lists")
    .insert({
      coach_id: opts.coachId,
      name:
        opts.listName?.trim() ||
        `Sales Nav — ${new Date().toISOString().slice(0, 10)}`,
      source: "sales_nav",
      filters: {
        salesNavUrl: opts.salesNavUrl ?? null,
        takePages: opts.takePages ?? null,
        scrapedCount: capped.length,
      },
    })
    .select("*")
    .single();

  if (listError || !list) {
    throw new Error(listError?.message ?? "Could not create lead list.");
  }

  const items = capped.map((lead) => ({
    list_id: list.id,
    coach_id: opts.coachId,
    source: "sales_nav",
    leadrocks_id: null,
    full_name: lead.fullName,
    first_name: lead.firstName,
    last_name: lead.lastName,
    job_title: lead.jobTitle,
    company: lead.company,
    linkedin_url: lead.linkedinUrl,
    email: lead.email,
    phone: null,
    team_size: null,
    revenue_range: null,
    industry: null,
    match_reason: "Sales Navigator import",
    raw: {
      ...(lead.raw ?? {}),
      location: lead.location,
      headline: lead.headline,
    },
  }));

  for (const chunk of toChunks(items, 100)) {
    const { error: itemsError } = await supabaseAdmin
      .from("coach_lead_list_items")
      .insert(chunk);
    if (itemsError) {
      await supabaseAdmin.from("coach_lead_lists").delete().eq("id", list.id);
      throw new Error(itemsError.message);
    }
  }

  const { data: updatedList } = await supabaseAdmin
    .from("coach_lead_lists")
    .update({
      item_count: capped.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", list.id)
    .select("*")
    .single();

  return {
    list: updatedList ?? list,
    savedCount: capped.length,
  };
}

/**
 * POST /sales-nav-import
 * - scrape: starts Apify in the background → { jobId }; poll GET …/runs/[id]
 * - save + leads: sync path (no Apify)
 */
export async function POST(request: Request) {
  const auth = await requireLeadFinderAccess(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    salesNavUrl?: string;
    /** Optional label for this import (History / admin). */
    name?: string;
    /** Admin test: Cookie-Editor JSON. Falls back to LINKEDIN_SALES_NAV_COOKIE. */
    cookie?: string;
    userAgent?: string;
    takePages?: number;
    save?: boolean;
    listName?: string;
    /** Already-imported leads — save without re-scraping. */
    leads?: SalesNavImportedLead[];
  };

  const importName = body.name?.trim() || null;

  try {
    const startedAt = Date.now();
    const elapsedMs = () => Date.now() - startedAt;

    if (body.save && Array.isArray(body.leads) && body.leads.length > 0) {
      const leads = body.leads.filter(isLeadShape);
      if (leads.length === 0) {
        return NextResponse.json(
          { error: "No valid leads to save." },
          { status: 400 }
        );
      }
      const cache = await upsertSalesNavLeadsToCache({
        leads,
        salesNavUrl: body.salesNavUrl,
      });
      const saved = await saveLeadsAsList({
        coachId: auth.userId,
        leads,
        salesNavUrl: body.salesNavUrl,
        listName: body.listName || importName || undefined,
      });
      const durationMs = elapsedMs();
      const logResult = await logSalesNavImportRun({
        coachId: auth.userId,
        salesNavUrl: body.salesNavUrl,
        name: importName,
        takePages: null,
        scrapedCount: leads.length,
        cacheInserted: cache.inserted,
        cacheUpdated: cache.updated,
        cacheSkipped: cache.skipped,
        savedToList: true,
        listId: saved.list.id as string,
        apifyCharged: false,
        durationMs,
        leadSnapshot: leads.map(toSalesNavImportLeadSnapshot),
      });
      return NextResponse.json({
        leads,
        scrapedCount: leads.length,
        savedCount: saved.savedCount,
        sharedCache: cache,
        durationMs,
        importRunId: logResult.id ?? null,
        auditLogOk: logResult.ok,
        auditLogError: logResult.error ?? null,
        list: saved.list,
        leadList: mapLeadListRow(
          saved.list as Parameters<typeof mapLeadListRow>[0]
        ),
      });
    }

    const storedSession = await getSalesNavSessionCookie(auth.userId);
    const job = await createSalesNavImportJob({
      coachId: auth.userId,
      salesNavUrl: body.salesNavUrl ?? "",
      name: importName,
      cookie: body.cookie?.trim() || storedSession?.cookie,
      userAgent:
        body.userAgent?.trim() || storedSession?.userAgent || undefined,
      takePages: body.takePages,
    });

    return NextResponse.json({
      jobId: job.jobId,
      status: "running" as const,
      takePages: job.takePages,
      requestedTakePages: job.requestedTakePages,
      targetCount: job.targetCount,
      progressCount: 0,
      estimatedCostUsd: job.estimatedCostUsd,
      async: true,
    });
  } catch (err) {
    if (err instanceof SalesNavScrapeError) {
      const status =
        err.code === "not_configured"
          ? 503
          : err.code === "invalid_input"
            ? 400
            : 502;
      return NextResponse.json({ error: err.message }, { status });
    }
    const message =
      err instanceof Error ? err.message : "Sales Navigator import failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
