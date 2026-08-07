import { NextResponse } from "next/server";
import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { requireAdminBearer } from "@/lib/linkedinAdminAuth";
import { normalizeOverview537 } from "@/lib/linkedinNewsletter/cascade";
import { loadNewsletterBrainBundle } from "@/lib/linkedinNewsletter/loadBrainContext";
import { mapEditionRow } from "@/lib/linkedinNewsletter/mapRows";
import {
  EDITION_DRAFT_SYSTEM,
  buildEditionDraftUser,
} from "@/lib/linkedinNewsletter/prompts";
import type {
  NewsletterFixedBlocks,
  NewsletterFormat,
  NewsletterLengthMode,
} from "@/lib/linkedinNewsletter/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Ctx = { params: Promise<{ id: string }> };

type DraftAi = {
  title?: string;
  tagline?: string;
  seo_title?: string;
  seo_description?: string;
  body_markdown?: string;
  promo_post?: string;
  cover_headline?: string;
  cover_tagline?: string;
};

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireAdminBearer(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    revise_instruction?: string;
    format?: NewsletterFormat;
    length_mode?: NewsletterLengthMode;
  };

  const { data: edition, error } = await supabaseAdmin
    .from("linkedin_newsletter_editions")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!edition) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: series, error: sErr } = await supabaseAdmin
    .from("linkedin_newsletter_series")
    .select("*")
    .eq("id", edition.series_id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (sErr || !series) {
    return NextResponse.json(
      { error: sErr?.message ?? "Series not found." },
      { status: 404 }
    );
  }

  const brain = await loadNewsletterBrainBundle(auth.userId);
  const format = body.format ?? (edition.format as NewsletterFormat);
  const lengthMode =
    body.length_mode ?? (edition.length_mode as NewsletterLengthMode);
  const existing = String(edition.body_markdown ?? "");
  const revise = body.revise_instruction?.trim() || null;

  const { data: ai, error: aiErr } = await generateCampaignJson<DraftAi>({
    system: EDITION_DRAFT_SYSTEM,
    user: buildEditionDraftUser({
      seriesName: String(series.name),
      leadTopic: (series.lead_topic as string | null) ?? null,
      overview: normalizeOverview537(series.overview_537),
      kind: edition.kind,
      kindIndex: edition.kind_index == null ? null : Number(edition.kind_index),
      title: String(edition.title ?? ""),
      tagline: (edition.tagline as string | null) ?? null,
      format,
      lengthMode,
      fixedBlocks: (series.fixed_blocks as NewsletterFixedBlocks) ?? {},
      brain,
      existingBody: existing.trim() ? existing : null,
      reviseInstruction: revise,
    }),
    maxTokens: lengthMode === "long" ? 8192 : 6144,
  });

  if (aiErr || !ai?.body_markdown?.trim()) {
    return NextResponse.json(
      { error: aiErr ?? "Failed to draft edition." },
      { status: 502 }
    );
  }

  const cover = {
    ...((edition.cover as Record<string, unknown>) ?? {}),
    headline: ai.cover_headline?.trim() || edition.title,
    tagline: ai.cover_tagline?.trim() || edition.tagline || "",
  };

  const { data: updated, error: upErr } = await supabaseAdmin
    .from("linkedin_newsletter_editions")
    .update({
      title: ai.title?.trim() || edition.title,
      tagline: ai.tagline?.trim() || edition.tagline,
      seo_title: ai.seo_title?.trim() || null,
      seo_description: ai.seo_description?.trim() || null,
      body_markdown: ai.body_markdown.trim(),
      promo_post_text: ai.promo_post?.trim() || null,
      format,
      length_mode: lengthMode,
      cover,
      status: "draft",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select("*")
    .maybeSingle();

  if (upErr || !updated) {
    return NextResponse.json(
      { error: upErr?.message ?? "Failed to save draft." },
      { status: 500 }
    );
  }

  await supabaseAdmin
    .from("linkedin_newsletter_series")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", series.id);

  return NextResponse.json({
    edition: mapEditionRow(updated as Record<string, unknown>),
  });
}
