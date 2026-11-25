import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cronAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { raiseOutreachAlert } from "@/lib/unipile/outreachAlerts";

export const maxDuration = 60;

/** Due sends this late, across running campaigns, mean the send run isn't working. */
const LATE_MS = 3 * 3600_000;

/**
 * Backstop for the 5-minute send run: if that run stops being called or
 * crashes before its own checks, nothing else would notice. This one only
 * reads, and raises one Support ticket until it is resolved.
 */
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: running } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id")
    .eq("status", "running");
  const ids = (running ?? []).map((c) => c.id as string);
  if (!ids.length) return NextResponse.json({ ok: true, late: 0 });
  const { count } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .select("id", { count: "exact", head: true })
    .in("campaign_id", ids)
    .eq("status", "pending")
    .lt("scheduled_for", new Date(Date.now() - LATE_MS).toISOString());
  const late = count ?? 0;
  if (late > 0) {
    await raiseOutreachAlert({
      title: "Sales Robot may have stopped: sends are hours late",
      details: `${late} send${late === 1 ? " is" : "s are"} more than 3 hours late across running campaigns. The 5-minute send run is either not running or not reaching them. Check /api/cron/linkedin-outreach in Vercel.`,
    });
  }
  return NextResponse.json({ ok: true, late });
}

export async function POST(request: Request) {
  return GET(request);
}
