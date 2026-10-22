import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** BOSS Scores by the tag on the link people came in on, across every coach. */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const to = url.searchParams.get("to");
  let query = supabaseAdmin.from("assessments").select("traffic_source, coach_id").gte("completed_at", from).limit(20000);
  if (to) query = query.lte("completed_at", `${to}T23:59:59Z`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Could not load sources." }, { status: 500 });
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const key = (row.traffic_source as string | null) || "untagged";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sources = [...counts.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);
  return NextResponse.json({ sources, total: data?.length ?? 0, from, to });
}
