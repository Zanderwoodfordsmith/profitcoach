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
import { aiSalesNavImportListName } from "@/lib/salesNavigator/importListName";
import { logRejectedSalesNavImport } from "@/lib/salesNavigator/logImportRun";
import {
  parseSalesNavPoolLimit,
  requestedTakePagesFromTargetCount,
} from "@/lib/salesNavigator/importSizing";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { unipileFetch } from "@/lib/unipile/client";
import { requireLiveLinkedInUnipileAccount } from "@/lib/unipile/linkedinSearchAccount";
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

/**
 * Whether a saved people search is on the coach's connected LinkedIn
 * account, and its name there. Null when LinkedIn doesn't answer.
 */
async function findCoachSavedSearch(
  coachId: string,
  savedSearchId: string
): Promise<{ found: boolean; title: string | null } | null> {
  const accountId = await requireLiveLinkedInUnipileAccount(coachId);
  const res = await unipileFetch<{
    items?: Array<{ id?: string | number; title?: string | null }>;
  }>(
    "GET",
    `/api/v1/linkedin/search/parameters?account_id=${encodeURIComponent(accountId)}&type=SAVED_SEARCHES&limit=100`,
    undefined,
    { timeoutMs: 15_000 }
  );
  if (!res.ok) return null;
  const hit = (res.data?.items ?? []).find(
    (item) => String(item.id ?? "") === savedSearchId
  );
  return { found: Boolean(hit), title: hit?.title?.trim() || null };
}

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

  // A saved search only opens on the LinkedIn account that saved it. Check
  // before making a list, and use its own name for the list.
  let suggestedName: string | null = null;
  if (classified.kind === "saved_people") {
    const saved = await findCoachSavedSearch(coachId, classified.id);
    if (saved && !saved.found) {
      const message =
        "That saved search was saved on a different LinkedIn account, so it won’t open on yours. Open it in Sales Navigator on the account that saved it, change any filter so the address shows query=, then copy the address and paste it here.";
      await logRejectedSalesNavImport({
        coachId,
        salesNavUrl,
        reason: "saved_search_other_account",
        message,
      });
      throw new SalesNavImportRejectedError(
        message,
        "saved_search_other_account",
        false
      );
    }
    suggestedName = saved?.title ?? null;
  } else if (
    !input.saveListName?.trim() &&
    (classified.kind === "query" || classified.kind === "passthrough")
  ) {
    suggestedName = await aiSalesNavImportListName(salesNavUrl);
  }

  const pool = await ensureCoachPool(coachId);
  const poolLimit = parseSalesNavPoolLimit(input.poolLimit);
  const saveListName =
    input.saveListName?.trim() ||
    suggestedName ||
    defaultPoolImportListName("sales_nav");
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
