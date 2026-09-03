import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import { syncLinkedInInboxForCoach } from "@/lib/unipile/inboxSync";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 60;

function isCronRequest(request: Request): boolean {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const secrets = [
    process.env.CRON_SECRET?.trim(),
    process.env.LINKEDIN_CRON_SECRET?.trim(),
  ].filter(Boolean) as string[];
  return !!bearer && secrets.includes(bearer);
}

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
