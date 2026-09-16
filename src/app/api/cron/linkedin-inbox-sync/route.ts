import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cronAuth";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import { syncLinkedInInboxForCoach } from "@/lib/unipile/inboxSync";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 60;

/** Cron: force sync all OK accounts. Coach auth: soft sync (or force via body). */
export async function POST(request: Request) {
  const cron = isCronRequest(request);
  if (cron) {
    const { data: accounts } = await supabaseAdmin
      .from("linkedin_outreach_accounts")
      .select("coach_id")
      .eq("status", "OK");
    const coachIds = [
      ...new Set((accounts ?? []).map((a) => a.coach_id as string)),
    ];
    const results = [];
    for (const coachId of coachIds) {
      results.push({
        coachId,
        ...(await syncLinkedInInboxForCoach(coachId, {
          force: true,
          minIntervalMs: 0,
        })),
      });
    }
    return NextResponse.json({ ok: true, results });
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
