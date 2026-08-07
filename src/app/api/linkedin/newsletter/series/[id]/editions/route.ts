import { NextResponse } from "next/server";
import { requireAdminBearer } from "@/lib/linkedinAdminAuth";
import { mapEditionRow } from "@/lib/linkedinNewsletter/mapRows";
import type {
  NewsletterEditionKind,
  NewsletterFormat,
  NewsletterLengthMode,
} from "@/lib/linkedinNewsletter/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Ctx = { params: Promise<{ id: string }> };

/** Create a single edition (primary write-this-week path). */
export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireAdminBearer(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    tagline?: string;
    kind?: NewsletterEditionKind;
    format?: NewsletterFormat;
    length_mode?: NewsletterLengthMode;
  };

  const title = (body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Topic / title is required." }, { status: 400 });
  }

  const { data: series, error } = await supabaseAdmin
    .from("linkedin_newsletter_series")
    .select("id")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!series) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: last } = await supabaseAdmin
    .from("linkedin_newsletter_editions")
    .select("sequence_index")
    .eq("series_id", id)
    .eq("user_id", auth.userId)
    .order("sequence_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sequence_index = (last?.sequence_index ?? 0) + 1;
  const format = body.format ?? "pam_537_overview";
  const kind = body.kind ?? (format === "pam_537_overview" ? "overview_537" : "custom");

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("linkedin_newsletter_editions")
    .insert({
      series_id: id,
      user_id: auth.userId,
      sequence_index,
      kind,
      kind_index: null,
      title,
      tagline: body.tagline?.trim() || null,
      format,
      length_mode: body.length_mode ?? "short",
      status: "planned",
      body_markdown: "",
      cover: {},
      blocks: [],
    })
    .select("*")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json(
      { error: insErr?.message ?? "Failed to create edition." },
      { status: 500 }
    );
  }

  await supabaseAdmin
    .from("linkedin_newsletter_series")
    .update({
      lead_topic: title,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", auth.userId);

  return NextResponse.json({
    edition: mapEditionRow(inserted as Record<string, unknown>),
  });
}
