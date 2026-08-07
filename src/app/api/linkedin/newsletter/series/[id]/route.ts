import { NextResponse } from "next/server";
import { requireAdminBearer } from "@/lib/linkedinAdminAuth";
import { mapEditionRow, mapSeriesRow } from "@/lib/linkedinNewsletter/mapRows";
import { normalizeOverview537 } from "@/lib/linkedinNewsletter/cascade";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const auth = await requireAdminBearer(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const { data: series, error } = await supabaseAdmin
    .from("linkedin_newsletter_series")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!series) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: editions, error: edErr } = await supabaseAdmin
    .from("linkedin_newsletter_editions")
    .select("*")
    .eq("series_id", id)
    .eq("user_id", auth.userId)
    .order("sequence_index", { ascending: true });

  if (edErr) return NextResponse.json({ error: edErr.message }, { status: 500 });

  return NextResponse.json({
    series: mapSeriesRow(series as Record<string, unknown>),
    editions: (editions ?? []).map((r) => mapEditionRow(r as Record<string, unknown>)),
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireAdminBearer(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.tagline === "string") patch.tagline = body.tagline.trim() || null;
  if (typeof body.cadence === "string") patch.cadence = body.cadence;
  if (typeof body.lead_topic === "string")
    patch.lead_topic = body.lead_topic.trim() || null;
  if (body.overview_537) patch.overview_537 = normalizeOverview537(body.overview_537);
  if (body.fixed_blocks && typeof body.fixed_blocks === "object")
    patch.fixed_blocks = body.fixed_blocks;
  if (body.status === "active" || body.status === "archived") patch.status = body.status;

  const { data, error } = await supabaseAdmin
    .from("linkedin_newsletter_series")
    .update(patch)
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({
    series: mapSeriesRow(data as Record<string, unknown>),
  });
}
