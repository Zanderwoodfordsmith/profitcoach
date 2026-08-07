import { NextResponse } from "next/server";
import { requireAdminBearer } from "@/lib/linkedinAdminAuth";
import { mapEditionRow } from "@/lib/linkedinNewsletter/mapRows";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireAdminBearer(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const strKeys = [
    "title",
    "tagline",
    "seo_title",
    "seo_description",
    "body_markdown",
    "promo_post_text",
  ] as const;
  for (const k of strKeys) {
    if (typeof body[k] === "string") {
      patch[k] = (body[k] as string).trim() || (k === "title" || k === "body_markdown" ? body[k] : null);
    }
  }
  if (typeof body.format === "string") patch.format = body.format;
  if (typeof body.length_mode === "string") patch.length_mode = body.length_mode;
  if (typeof body.status === "string") patch.status = body.status;
  if (body.cover && typeof body.cover === "object") patch.cover = body.cover;

  if (typeof patch.body_markdown === "string" && (patch.body_markdown as string).trim()) {
    if (!body.status) patch.status = "draft";
  }

  const { data, error } = await supabaseAdmin
    .from("linkedin_newsletter_editions")
    .update(patch)
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({
    edition: mapEditionRow(data as Record<string, unknown>),
  });
}
