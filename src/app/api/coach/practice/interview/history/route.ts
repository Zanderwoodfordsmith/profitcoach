import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Every earlier "Talk it through" conversation for this coach, newest first, to read. */
export async function GET(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error !== null) return NextResponse.json({ error: check.error }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from("coach_intake_sessions")
    .select("id, status, turns, started_at")
    .eq("coach_id", check.userId)
    .order("started_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error("interview history:", error.message);
    return NextResponse.json({ error: "Could not load earlier conversations." }, { status: 500 });
  }
  const sessions = (data ?? [])
    .map((row) => ({
      id: String(row.id),
      status: String(row.status),
      started_at: String(row.started_at),
      turns: (Array.isArray(row.turns) ? row.turns : [])
        .filter((t): t is { role: string; content: string } => Boolean(t && typeof t.content === "string"))
        .map((t) => ({ role: t.role === "user" ? "user" : "assistant", content: t.content })),
    }))
    .filter((s) => s.turns.some((t) => t.role === "user"));
  return NextResponse.json({ sessions });
}
