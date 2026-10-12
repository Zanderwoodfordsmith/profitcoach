import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  toSalesNavImportProgressView,
  type SalesNavImportProgressView,
} from "@/lib/salesNavigator/activeImportView";

const ACTIVE_COLUMNS =
  "id, name, status, progress_count, segment_index, segment_total, segment_plan, list_id, save_list_id, saved_to_list, started_at";

/**
 * Imports the pool should show as in progress, including the short window
 * after the pull finishes and before people are written into the list.
 * Omits lead snapshots so this stays cheap to poll.
 */
export async function listActiveSalesNavImports(
  coachId: string
): Promise<SalesNavImportProgressView[]> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [running, saving] = await Promise.all([
    supabaseAdmin
      .from("sales_nav_import_runs")
      .select(ACTIVE_COLUMNS)
      .eq("coach_id", coachId)
      .in("status", ["pending", "running"])
      .order("started_at", { ascending: false }),
    supabaseAdmin
      .from("sales_nav_import_runs")
      .select(ACTIVE_COLUMNS)
      .eq("coach_id", coachId)
      .eq("status", "succeeded")
      .eq("saved_to_list", false)
      .gte("finished_at", since)
      .order("finished_at", { ascending: false }),
  ]);

  if (running.error) throw new Error(running.error.message);
  if (saving.error) throw new Error(saving.error.message);

  const rows = [...(running.data ?? []), ...(saving.data ?? [])];
  const seen = new Set<string>();
  const views: SalesNavImportProgressView[] = [];
  for (const row of rows) {
    const view = toSalesNavImportProgressView(
      row as Parameters<typeof toSalesNavImportProgressView>[0]
    );
    if (seen.has(view.id)) continue;
    seen.add(view.id);
    views.push(view);
  }
  return views;
}
