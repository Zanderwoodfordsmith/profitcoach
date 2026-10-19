import { NextResponse } from "next/server";
import { parseCoachIdHeader } from "@/lib/coachId";
import { requireAdmin } from "@/lib/requireAdmin";
import { loadNetworkSummary, syncCoachNetwork } from "@/lib/referrals/network";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Body: { coachId }. Re-reads a network that is already loaded (fresh photos,
 * new connections). First loads go through scripts/sync-coach-network.ts once
 * the coach has agreed, so nobody's network is read by accident from here.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const coachId = parseCoachIdHeader(typeof body.coachId === "string" ? body.coachId : null);
  if (!coachId) return NextResponse.json({ error: "Pick a coach." }, { status: 400 });

  const summary = await loadNetworkSummary(coachId);
  if (summary.total === 0) {
    return NextResponse.json({ error: "This coach's network isn't loaded yet." }, { status: 400 });
  }
  const result = await syncCoachNetwork(coachId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, total: result.total });
}
