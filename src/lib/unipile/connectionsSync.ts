import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { syncCoachNetwork } from "@/lib/referrals/network";

/**
 * Keeps each coach's LinkedIn connections (coach_network_connections) fresh,
 * so Lead Lists knows who is connected and since when (jobs 300, 301).
 * Read only on LinkedIn: one list call per 1,000 connections.
 * Each run takes the coaches read longest ago, within a time budget.
 */

const REFRESH_AFTER_MS = 20 * 60 * 60 * 1000;

export async function syncStaleCoachConnections(options?: {
  budgetMs?: number;
  maxCoaches?: number;
  /** Only these coaches (a one-off run); otherwise the stalest first. */
  coachIds?: string[];
}): Promise<{ synced: number; failed: number; errors: string[]; left: number }> {
  const started = Date.now();
  const budgetMs = options?.budgetMs ?? 240_000;
  const maxCoaches = options?.maxCoaches ?? 12;

  let query = supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select("id, coach_id, provider, status, unipile_account_id, network_synced_at")
    .not("unipile_account_id", "is", null)
    .order("network_synced_at", { ascending: true, nullsFirst: true })
    .limit(500);
  if (options?.coachIds?.length) query = query.in("coach_id", options.coachIds);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const cutoff = Date.now() - REFRESH_AFTER_MS;
  const due = (data ?? []).filter(
    (row) =>
      String(row.provider ?? "").toUpperCase() === "LINKEDIN" &&
      String(row.status ?? "").toUpperCase() === "OK" &&
      typeof row.coach_id === "string" &&
      (options?.coachIds?.length ||
        !row.network_synced_at ||
        Date.parse(row.network_synced_at) < cutoff)
  );

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const row of due) {
    if (synced + failed >= maxCoaches) break;
    if (Date.now() - started > budgetMs) break;
    const coachId = row.coach_id as string;
    if (seen.has(coachId)) continue;
    seen.add(coachId);
    const result = await syncCoachNetwork(coachId);
    // Stamp either way, so one broken account can't block the queue.
    await supabaseAdmin
      .from("linkedin_outreach_accounts")
      .update({ network_synced_at: new Date().toISOString() })
      .eq("id", row.id);
    if (result.ok) synced += 1;
    else {
      failed += 1;
      errors.push(`${coachId}: ${result.error}`);
    }
  }
  return { synced, failed, errors, left: Math.max(0, due.length - seen.size) };
}
