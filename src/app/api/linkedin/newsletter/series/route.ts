import { NextResponse } from "next/server";
import { requireAdminBearer } from "@/lib/linkedinAdminAuth";
import { mapSeriesRow } from "@/lib/linkedinNewsletter/mapRows";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const auth = await requireAdminBearer(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("linkedin_newsletter_series")
    .select("*")
    .eq("user_id", auth.userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    series: (data ?? []).map((r) => mapSeriesRow(r as Record<string, unknown>)),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminBearer(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    tagline?: string;
    cadence?: "weekly" | "fortnightly" | "monthly";
    lead_topic?: string;
    fixed_blocks?: Record<string, string>;
  };

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Newsletter name is required." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("linkedin_newsletter_series")
    .insert({
      user_id: auth.userId,
      name,
      tagline: body.tagline?.trim() || null,
      cadence: body.cadence ?? "fortnightly",
      lead_topic: body.lead_topic?.trim() || null,
      fixed_blocks: body.fixed_blocks ?? {},
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create series." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    series: mapSeriesRow(data as Record<string, unknown>),
  });
}
