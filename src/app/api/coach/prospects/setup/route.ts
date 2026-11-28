import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Prospects choices for one coach (28 Nov): whether they use their network
 * for referrals for now. The Referral list and the Launch view read it.
 */
export async function GET(request: Request) {
  const check = await requireCoachRequest(request);
  if (check.error || !check.userId) return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("coaches").select("referral_off").eq("id", check.userId).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load that." }, { status: 500 });
  return NextResponse.json({ referral_off: Boolean(data?.referral_off) });
}

export async function PATCH(request: Request) {
  const check = await requireCoachRequest(request);
  if (check.error || !check.userId) return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { referral_off?: unknown } | null;
  if (typeof body?.referral_off !== "boolean") return NextResponse.json({ error: "Say on or off." }, { status: 400 });
  const { error } = await supabaseAdmin.from("coaches").update({ referral_off: body.referral_off }).eq("id", check.userId);
  if (error) return NextResponse.json({ error: "Could not save that." }, { status: 500 });
  return NextResponse.json({ referral_off: body.referral_off });
}
