import { NextResponse } from "next/server";

import { flowGraph, flowStatus } from "@/lib/practiceKnowledge/flow";
import { findPracticeKnowledge } from "@/lib/practiceKnowledge/store";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * For the admin flow map: the graph drawn from the writer contracts, the
 * coaches who have a Blueprint, and, with ?coach=, where that coach stands on
 * every box. States only, never the content.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    const status = auth.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: auth.error }, { status });
  }

  try {
    const coachId = new URL(request.url).searchParams.get("coach");
    const { data: rows, error } = await supabaseAdmin
      .from("coach_practice_knowledge")
      .select("coach_id")
      .order("updated_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r) => r.coach_id as string);
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as { id: string; full_name: string | null }[] };
    const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) || "Coach"]));
    const coaches = ids
      .map((id) => ({ id, name: names.get(id) ?? "Coach" }))
      .sort((a, b) => a.name.localeCompare(b.name));

    let status = null;
    if (coachId && UUID.test(coachId)) {
      const row = await findPracticeKnowledge(coachId);
      status = row ? flowStatus(row) : null;
    }
    return NextResponse.json({ graph: flowGraph(), coaches, status });
  } catch (err) {
    console.error("practice flow:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load the flow map." }, { status: 500 });
  }
}
