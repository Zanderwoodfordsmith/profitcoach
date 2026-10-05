import { SALES_NAV_MAX_TAKE_PAGES } from "@/lib/apify/salesNavigatorTypes";
import {
  createCoachAudienceList,
  defaultPoolImportListName,
  ensureCoachPool,
  MAX_LIST_ITEMS_TOTAL,
} from "@/lib/leadLists/audienceLists";
import {
  prepareSalesNavImportUrl,
  SalesNavImportRejectedError,
} from "@/lib/salesNavigator/classifySalesNavUrl";
import { logRejectedSalesNavImport } from "@/lib/salesNavigator/logImportRun";
import {
  parseSalesNavPoolLimit,
  requestedTakePagesFromTargetCount,
} from "@/lib/salesNavigator/importSizing";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createUnipileSalesNavImportJob } from "@/lib/unipile/salesNavImportJob";

/**
 * Sales Navigator pool import, shared by the import route and the AI agent.
 * Always creates a named audience list for the batch.
 */

export type SalesNavImportRequest = {
  salesNavUrl?: string;
  name?: string;
  /** One of the pool size options; anything else imports everything. */
  poolLimit?: number;
  saveListName?: string;
};

export async function startSalesNavImport(
  coachId: string,
  input: SalesNavImportRequest
) {
  const prepared = prepareSalesNavImportUrl(input.salesNavUrl?.trim() || "");
  const salesNavUrl = prepared.url;
  const classified = prepared.classified;
  if (classified.kind === "rejected") {
    await logRejectedSalesNavImport({
      coachId,
      salesNavUrl,
      reason: classified.reason,
      message: classified.message,
    });
    throw new SalesNavImportRejectedError(
      classified.message,
      classified.reason,
      classified.support
    );
  }

  const pool = await ensureCoachPool(coachId);
  const poolLimit = parseSalesNavPoolLimit(input.poolLimit);
  const saveListName =
    input.saveListName?.trim() || defaultPoolImportListName("sales_nav");
  const saveList = await createCoachAudienceList({
    coachId,
    name: saveListName,
    source: "sales_nav",
    filters: {
      from_pool_import: true,
      pool_limit: poolLimit,
      list_cap: MAX_LIST_ITEMS_TOTAL,
    },
  });
  try {
    const job = await createUnipileSalesNavImportJob({
      coachId,
      salesNavUrl,
      name: input.name?.trim() || saveList.name,
      takePages: poolLimit
        ? requestedTakePagesFromTargetCount(poolLimit)
        : SALES_NAV_MAX_TAKE_PAGES,
      listId: pool.id,
      saveListId: saveList.id,
    });
    return { job, poolId: pool.id, saveList };
  } catch (err) {
    await supabaseAdmin
      .from("coach_lead_lists")
      .delete()
      .eq("id", saveList.id)
      .eq("coach_id", coachId);
    if (err instanceof SalesNavImportRejectedError) {
      await logRejectedSalesNavImport({
        coachId,
        salesNavUrl,
        reason: err.reason,
        message: err.message,
      });
    }
    throw err;
  }
}
