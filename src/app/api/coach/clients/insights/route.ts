import { NextResponse } from "next/server";
import { clientInsights, type InsightClient } from "@/lib/clientRoster/insights";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** "Your best clients look like this" for the signed-in coach. */
export async function GET(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select("client_sector, client_revenue_band, client_team_size, client_source, client_fee_amount, client_fit, client_result")
    .eq("coach_id", auth.userId)
    .eq("type", "client");
  if (error) return NextResponse.json({ error: "Could not load clients." }, { status: 500 });
  const clients = (data ?? []).map((r) => ({ ...r, client_fee_amount: r.client_fee_amount == null ? null : Number(r.client_fee_amount) })) as InsightClient[];
  return NextResponse.json({ insights: clientInsights(clients) });
}
