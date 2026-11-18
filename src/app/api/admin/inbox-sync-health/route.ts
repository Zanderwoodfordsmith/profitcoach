import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** A connected channel with no finished sync for this long is flagged. */
const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

/**
 * Admin: connected inbox channels that have not finished a sync in 3 hours,
 * plus a 24-hour summary of sync runs.
 */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return NextResponse.json({ error: admin.error }, { status: 401 });
  }

  const now = Date.now();
  const { data: accounts, error } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select(
      "id, coach_id, provider, display_name, last_synced_at, last_sync_finished_at, last_sync_error, sync_backoff_until"
    )
    .eq("status", "OK");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = accounts ?? [];
  const coachIds = [...new Set(rows.map((r) => r.coach_id as string))];
  const { data: profiles } = coachIds.length
    ? await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", coachIds)
    : { data: [] as Array<{ id: string; full_name: string | null }> };
  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id as string, (p.full_name as string) || ""])
  );

  const stale = rows
    .map((row) => {
      // Before this column existed, last_synced_at is the best we have.
      const finished =
        (row.last_sync_finished_at as string | null) ||
        (row.last_synced_at as string | null);
      const finishedAt = finished ? new Date(finished).getTime() : 0;
      return {
        accountId: row.id as string,
        coachId: row.coach_id as string,
        coachName: nameById.get(row.coach_id as string) || "Unknown coach",
        provider: String(row.provider || ""),
        account: (row.display_name as string | null) ?? null,
        lastFinishedAt: finished,
        lastError: (row.last_sync_error as string | null) ?? null,
        pausedUntil:
          row.sync_backoff_until &&
          new Date(row.sync_backoff_until as string).getTime() > now
            ? (row.sync_backoff_until as string)
            : null,
        finishedAt,
      };
    })
    .filter((row) => now - row.finishedAt > STALE_AFTER_MS)
    .sort((a, b) => a.finishedAt - b.finishedAt)
    .map(({ finishedAt: _f, ...rest }) => rest);

  const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const { data: runs } = await supabaseAdmin
    .from("inbox_sync_runs")
    .select("outcome, duration_ms, trigger")
    .gte("started_at", since)
    .limit(20000);
  const outcomes: Record<string, number> = {};
  let slowest = 0;
  for (const run of runs ?? []) {
    const key = String(run.outcome || "unknown");
    outcomes[key] = (outcomes[key] ?? 0) + 1;
    slowest = Math.max(slowest, Number(run.duration_ms) || 0);
  }

  return NextResponse.json({
    connected: rows.length,
    stale,
    last24h: {
      runs: (runs ?? []).length,
      outcomes,
      slowestMs: slowest,
    },
  });
}
