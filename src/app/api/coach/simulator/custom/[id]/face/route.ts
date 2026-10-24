import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { makeFace, type CustomRow } from "@/lib/simulator/custom";

export const maxDuration = 120;

/** Make (or remake) a custom client's portrait. Fails softly when there's no image budget left today. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { data } = await supabaseAdmin.from("sim_custom_clients").select("*").eq("id", id).eq("coach_id", check.userId).maybeSingle();
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const url = await makeFace(data as CustomRow);
  if (!url) return NextResponse.json({ error: "Couldn't make a face right now. Their initials will do until later." }, { status: 503 });
  return NextResponse.json({ face: url });
}
