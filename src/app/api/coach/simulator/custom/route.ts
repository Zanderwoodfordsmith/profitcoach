import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateClient, rowToClient, type CustomRow } from "@/lib/simulator/custom";

export const maxDuration = 120;

/** "Create your own": the coach describes a situation; the AI builds a draft client to check. */
export async function POST(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { situation?: unknown; isReal?: unknown } | null;
  const situation = typeof body?.situation === "string" ? body.situation.trim().slice(0, 4000) : "";
  if (situation.length < 40) {
    return NextResponse.json({ error: "Tell us a bit more: the business, the problem, and anything specific." }, { status: 400 });
  }
  const isReal = body?.isReal === true;
  try {
    const client = await generateClient({ situation, isReal });
    const { data, error } = await supabaseAdmin
      .from("sim_custom_clients")
      .insert({ coach_id: check.userId, situation, is_real: isReal, client })
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "insert failed");
    return NextResponse.json({ client: rowToClient(data as CustomRow, check.userId, null) });
  } catch (err) {
    console.error("simulator custom create:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Couldn't build the client. Try again." }, { status: 502 });
  }
}
