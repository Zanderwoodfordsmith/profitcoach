import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cronAuth";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import { syncLinkedInInboxForCoach } from "@/lib/unipile/inboxSync";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 300;

/** Stop starting new coaches after this; one force sync can take a minute+. */
const CRON_BUDGET_MS = 200_000;
/** Hard stop inside a coach's sync, under maxDuration. */
const CRON_DEADLINE_MS = 240_000;
/** Coaches synced side by side. */
const CRON_COACH_CONCURRENCY = 4;

/** Cron: sync OK accounts past cooldown, stalest coach first, within a time budget. Coach auth: soft sync (or force via body). */
export async function POST(request: Request) {
  const cron = isCronRequest(request);
  if (cron) {
    const startedAt = Date.now();
    // Nightly safety net: re-read the newest pages for everyone, ignoring
    // the quick-sync markers, to catch anything a quick sync could miss.
    const deep =
      new URL(request.url).searchParams.get("deep") === "1" ||
      request.headers.get("x-inbox-sync-deep") === "1";
    const { data: accounts } = await supabaseAdmin
      .from("linkedin_outreach_accounts")
      .select("id, coach_id, last_synced_at")
      .eq("status", "OK");
    const oldestByCoach = new Map<string, number>();
    for (const row of accounts ?? []) {
      const coachId = row.coach_id as string;
      const at = row.last_synced_at
        ? new Date(row.last_synced_at as string).getTime()
        : 0;
      const prev = oldestByCoach.get(coachId);
      if (prev === undefined || at < prev) oldestByCoach.set(coachId, at);
    }
    let coachIds = [...oldestByCoach.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([coachId]) => coachId);

    if (deep) {
      // Several nightly runs share the work: skip coaches already deep-synced
      // in the last 20 hours.
      const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
      const { data: doneRows } = await supabaseAdmin
        .from("inbox_sync_runs")
        .select("coach_id, account_id")
        .eq("trigger", "nightly")
        // Finished, or needs the coach to reconnect (retrying won't help).
        .or("complete.eq.true,outcome.eq.reconnect")
        .gte("started_at", since)
        .in("coach_id", coachIds);
      const doneAccounts = new Set(
        (doneRows ?? []).map((r) => String(r.account_id))
      );
      // A coach is done only when every connected channel finished.
      const pending = new Set(
        (accounts ?? [])
          .filter((row) => !doneAccounts.has(String(row.id)))
          .map((row) => row.coach_id as string)
      );
      coachIds = coachIds.filter((id) => pending.has(id));

      // Keep the logs small: 30 days is plenty to spot a pattern.
      const cutoff = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();
      await supabaseAdmin.from("inbox_sync_runs").delete().lt("started_at", cutoff);
      await supabaseAdmin
        .from("support_mailbox_seen_emails")
        .delete()
        .lt("seen_at", cutoff);
    }

    // Different coaches use different accounts, so a few at once is safe.
    const results: Array<Record<string, unknown>> = [];
    let next = 0;
    const worker = async () => {
      while (next < coachIds.length) {
        if (Date.now() - startedAt > CRON_BUDGET_MS) return;
        const coachId = coachIds[next];
        next += 1;
        try {
          results.push({
            coachId,
            ...(await syncLinkedInInboxForCoach(coachId, {
              force: false,
              minIntervalMs: 0,
              deadlineAt: startedAt + CRON_DEADLINE_MS,
              trigger: deep ? "nightly" : "cron",
              deep,
            })),
          });
        } catch (err) {
          console.error("cron inbox sync coach failed:", coachId, err);
          results.push({
            coachId,
            error: err instanceof Error ? err.message : "Sync failed.",
          });
        }
      }
    };
    await Promise.all(
      Array.from({ length: CRON_COACH_CONCURRENCY }, () => worker())
    );
    return NextResponse.json({
      ok: true,
      synced: results.length,
      deferred: coachIds.length - results.length,
      results,
    });
  }

  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    const admin = await requireAdmin(request);
    if (admin.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Pass coach auth to sync a specific inbox." },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    force?: boolean;
  };

  try {
    const result = await syncLinkedInInboxForCoach(auth.coachId, {
      force: Boolean(body.force),
      trigger: "other",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
