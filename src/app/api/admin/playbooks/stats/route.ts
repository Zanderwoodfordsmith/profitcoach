import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { getAllPlaybookTabStats } from "@/lib/playbookTabStatus";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { TabStatus } from "@/lib/playbookTabStatus";

export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const derived = getAllPlaybookTabStats();
  const { data: rows } = await supabaseAdmin
    .from("playbook_tab_status")
    .select("ref, overview, client, coaches");

  const byRef = new Map<string, { overview: TabStatus; client: TabStatus; coaches: TabStatus }>();
  for (const r of rows ?? []) {
    byRef.set(r.ref, {
      overview: (r.overview as TabStatus) ?? "not_started",
      client: (r.client as TabStatus) ?? "not_started",
      coaches: (r.coaches as TabStatus) ?? "not_started",
    });
  }

  const playbooks = derived.map((d) => {
    const saved = byRef.get(d.ref);
    return {
      ref: d.ref,
      overview: saved?.overview ?? d.overview,
      client: saved?.client ?? d.client,
      coaches: saved?.coaches ?? d.coaches,
    };
  });

  return NextResponse.json({ playbooks });
}
