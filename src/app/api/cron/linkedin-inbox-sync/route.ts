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
const CRON_DEADLINE_MS = 270_000;

/** Cron: sync OK accounts past cooldown, stalest coach first, within a time budget. Coach auth: soft sync (or force via body). */
export async function POST(request: Request) {
  const cron = isCronRequest(request);
  if (cron) {
    const startedAt = Date.now();
    const { data: accounts } = await supabaseAdmin
      .from("linkedin_outreach_accounts")
      .select("coach_id, last_synced_at")
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
    const coachIds = [...oldestByCoach.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([coachId]) => coachId);

    const results = [];
    for (const coachId of coachIds) {
      if (Date.now() - startedAt > CRON_BUDGET_MS) break;
      try {
        results.push({
          coachId,
          // Soft pull (stale/unread/empty threads only): webhooks carry live
          // traffic, and full per-chat LinkedIn fetches take minutes per coach.
          ...(await syncLinkedInInboxForCoach(coachId, {
            force: false,
            minIntervalMs: 0,
            deadlineAt: startedAt + CRON_DEADLINE_MS,
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
