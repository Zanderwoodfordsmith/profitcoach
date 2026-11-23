import { NextResponse } from "next/server";

import { LIST_SCOPE } from "@/lib/launch/avaAuto";
import type { ActivityItem } from "@/lib/launch/jobActivity";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * The Blueprint's Lead lists page (job 248, 21 Nov): Ava's list plan and what
 * came in. The coach sees the plan once it's imported (the released version);
 * BCA also sees the plan still waiting, to change or import it.
 */
export async function GET(request: Request) {
  const check = await requireCoachRequest(request);
  if (check.error || !check.userId) return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  const coachId = check.userId;

  const { data, error } = await supabaseAdmin
    .from("launch_job_activity")
    .select("id, coach_id, job_key, kind, body, payload, status, edited, created_by, created_at, resolved_at")
    .eq("coach_id", coachId)
    .eq("job_key", LIST_SCOPE)
    .eq("kind", "searches")
    .in("status", ["open", "saved"])
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return NextResponse.json({ error: "Could not load the lists." }, { status: 500 });
  const rows = (data ?? []) as ActivityItem[];
  const released = rows.find((row) => row.status === "saved") ?? null;
  const waiting = check.callerIsAdmin ? (rows.find((row) => row.status === "open") ?? null) : null;

  // How many people are on each list that came in.
  const imported = (released?.payload.imported ?? []) as { label: string; list: string }[];
  const ids = imported.map((i) => i.list).filter(Boolean);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: lists } = await supabaseAdmin.from("coach_lead_lists").select("id, item_count").in("id", ids);
    for (const list of lists ?? []) counts.set(list.id as string, Number(list.item_count) || 0);
  }

  return NextResponse.json({
    admin: check.callerIsAdmin,
    released: released ? { ...released, imported: imported.map((i) => ({ ...i, count: counts.get(i.list) ?? null })) } : null,
    waiting,
  });
}
