import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PLAYBOOKS } from "@/lib/bossData";
import type { TabStatus } from "@/lib/playbookTabStatus";

const VALID: TabStatus[] = ["done", "in_progress", "not_started"];

function isValid(v: string): v is TabStatus {
  return VALID.includes(v as TabStatus);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ ref: string }> }
) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const { ref } = await context.params;
  const exists = PLAYBOOKS.some((p) => p.ref === ref);
  if (!exists) {
    return NextResponse.json({ error: "Playbook not found." }, { status: 404 });
  }

  const body = (await request.json()) as {
    overview?: string;
    client?: string;
    coaches?: string;
  };

  const updates: { overview?: TabStatus; client?: TabStatus; coaches?: TabStatus } = {};
  if (body.overview !== undefined && isValid(body.overview)) updates.overview = body.overview;
  if (body.client !== undefined && isValid(body.client)) updates.client = body.client;
  if (body.coaches !== undefined && isValid(body.coaches)) updates.coaches = body.coaches;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, ref });
  }

  const { data: existing } = await supabaseAdmin
    .from("playbook_tab_status")
    .select("overview, client, coaches")
    .eq("ref", ref)
    .maybeSingle();

  const row = {
    ref,
    overview: (updates.overview ?? (existing?.overview as TabStatus)) ?? "not_started",
    client: (updates.client ?? (existing?.client as TabStatus)) ?? "not_started",
    coaches: (updates.coaches ?? (existing?.coaches as TabStatus)) ?? "not_started",
  };

  const { error } = await supabaseAdmin
    .from("playbook_tab_status")
    .upsert(row, { onConflict: "ref" });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to update status." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, ...row });
}
