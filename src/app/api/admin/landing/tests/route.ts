import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";


export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const { data, error } = await supabaseAdmin
    .from("landing_tests")
    .select("id, name, variant_a_slug, variant_b_slug, started_at, ended_at, winner_variant, status")
    .order("started_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const body = (await request.json()).catch(() => ({})) as { name?: string };
  const name = typeof body.name === "string" ? body.name.trim() || null : null;

  const { data: previous } = await supabaseAdmin
    .from("landing_tests")
    .select("id")
    .eq("status", "running")
    .maybeSingle();

  if (previous) {
    await supabaseAdmin
      .from("landing_tests")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("id", previous.id);
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("landing_tests")
    .insert({
      name: name ?? undefined,
      variant_a_slug: "a",
      variant_b_slug: "b",
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id, name, started_at, status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(inserted, { status: 201 });
}
