import { NextResponse } from "next/server";
import { sectorOf } from "@/lib/campaigns/sectorTiers";
import { clientInsights, type InsightClient } from "@/lib/clientRoster/insights";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** Across every coach: where clients come from, what they look like, and how LinkedIn-friendly their sectors are. */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .select("coach_id, business_name, job_title, client_sector, client_revenue_band, client_team_size, client_source, client_fee_amount, client_fit, client_result")
      .eq("type", "client")
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: "Could not load clients." }, { status: 500 });
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const clients = rows.map((r) => ({ ...r, client_fee_amount: r.client_fee_amount == null ? null : Number(r.client_fee_amount) })) as (InsightClient & {
    coach_id: string;
    business_name: string | null;
    job_title: string | null;
  })[];
  const lowLinkedIn = clients.filter((c) => {
    const tier = sectorOf(c.client_sector ?? c.business_name, c.job_title);
    return tier ? tier.score <= 4 : false;
  }).length;
  return NextResponse.json({
    insights: clientInsights(clients),
    coaches_with_clients: new Set(clients.map((c) => c.coach_id)).size,
    clients_in_low_linkedin_sectors: lowLinkedIn,
  });
}
