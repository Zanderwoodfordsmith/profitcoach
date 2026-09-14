import { NextResponse } from "next/server";
import { SALES_NAV_MAX_TAKE_PAGES } from "@/lib/apify/salesNavigatorTypes";
import {
  createCoachAudienceList,
  defaultPoolImportListName,
  ensureCoachPool,
  MAX_LIST_ITEMS_TOTAL,
} from "@/lib/leadLists/audienceLists";
import { isSalesNavSearchUrl } from "@/lib/salesNavigator/isSalesNavSearchUrl";
import {
  parseSalesNavPoolLimit,
  requestedTakePagesFromTargetCount,
} from "@/lib/salesNavigator/importSizing";
import { createUnipileSalesNavImportJob } from "@/lib/unipile/salesNavImportJob";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";

export const maxDuration = 60;

/**
 * Start a Unipile Sales Nav import into the coach pool.
 * Always creates a named audience list tab for the import batch.
 */
export async function POST(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    salesNavUrl?: string;
    name?: string;
    poolLimit?: number;
    saveListName?: string;
  };

  const salesNavUrl = body.salesNavUrl?.trim() || "";
  if (!isSalesNavSearchUrl(salesNavUrl)) {
    return NextResponse.json(
      {
        error:
          "Paste a Sales Navigator people-search URL (linkedin.com/sales/search/people…).",
      },
      { status: 400 }
    );
  }

  try {
    const pool = await ensureCoachPool(auth.coachId);
    const poolLimit = parseSalesNavPoolLimit(body.poolLimit);
    const saveListName =
      body.saveListName?.trim() || defaultPoolImportListName("sales_nav");
    const saveList = await createCoachAudienceList({
      coachId: auth.coachId,
      name: saveListName,
      source: "sales_nav",
      filters: {
        from_pool_import: true,
        pool_limit: poolLimit,
        list_cap: MAX_LIST_ITEMS_TOTAL,
      },
    });
    const job = await createUnipileSalesNavImportJob({
      coachId: auth.coachId,
      salesNavUrl,
      name: body.name?.trim() || saveList.name,
      takePages: poolLimit
        ? requestedTakePagesFromTargetCount(poolLimit)
        : SALES_NAV_MAX_TAKE_PAGES,
      listId: pool.id,
      saveListId: saveList.id,
    });
    return NextResponse.json({
      jobId: job.jobId,
      status: "running" as const,
      provider: "unipile" as const,
      takePages: job.takePages,
      requestedTakePages: job.requestedTakePages,
      targetCount: job.targetCount,
      progressCount: 0,
      estimatedCostUsd: 0,
      segmented: job.segmented,
      segmentTotal: job.segmentTotal,
      segmentLabels: job.segmentLabels,
      listId: pool.id,
      saveListId: saveList.id,
      saveListName: saveList.name,
      async: true,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Sales Navigator import failed.";
    const status =
      /Connect LinkedIn|disconnected|people-search URL|UNIPILE|Give the new list/i.test(
        message
      )
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
