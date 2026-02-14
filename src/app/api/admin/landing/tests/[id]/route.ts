import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const { id } = await params;
  const body = (await request.json()) as { winner_variant?: "a" | "b" };
  const winner = body.winner_variant === "a" || body.winner_variant === "b" ? body.winner_variant : null;
  if (!winner) {
    return NextResponse.json({ error: "winner_variant must be 'a' or 'b'" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("landing_tests")
    .update({
      winner_variant: winner,
      status: "completed",
      ended_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, winner_variant, status, ended_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
