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

/**
 * Sales Navigator pool import, shared by the import route and the AI agent.
 * Always creates a named audience list for the batch.
 */

export const SALES_NAV_URL_REQUIRED_ERROR =
  "Paste a Sales Navigator people-search URL (linkedin.com/sales/search/people…).";

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
  const salesNavUrl = input.salesNavUrl?.trim() || "";
  if (!isSalesNavSearchUrl(salesNavUrl)) {
    throw new Error(SALES_NAV_URL_REQUIRED_ERROR);
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
}
