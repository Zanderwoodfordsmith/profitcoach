import { NextResponse } from "next/server";
import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { requireAdminBearer } from "@/lib/linkedinAdminAuth";
import {
  buildCascadeFrom537,
  fillCascadeToYear,
  normalizeOverview537,
} from "@/lib/linkedinNewsletter/cascade";
import { loadNewsletterBrainBundle } from "@/lib/linkedinNewsletter/loadBrainContext";
import { mapEditionRow, mapSeriesRow } from "@/lib/linkedinNewsletter/mapRows";
import {
  OVERVIEW_537_SYSTEM,
  buildOverview537User,
} from "@/lib/linkedinNewsletter/prompts";
import type { Overview537 } from "@/lib/linkedinNewsletter/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Ctx = { params: Promise<{ id: string }> };

type PlanAiResult = {
  lead_topic?: string;
  strategies?: string[];
  mistakes?: string[];
  checklist?: string[];
  name_ideas?: string[];
  series_tagline?: string;
};

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireAdminBearer(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    lead_topic?: string;
    target_count?: number;
    length_mode?: "short" | "long";
    overview?: Overview537;
    skip_ai?: boolean;
  };

  const { data: series, error } = await supabaseAdmin
    .from("linkedin_newsletter_series")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!series) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const brain = await loadNewsletterBrainBundle(auth.userId);
  const leadTopic =
    (body.lead_topic ?? series.lead_topic ?? "").toString().trim() ||
    brain.painLines[0] ||
    "How to grow profit without more hours, hires or hassle";

  let overview = body.overview ? normalizeOverview537(body.overview) : null;
  let nameIdeas: string[] = [];
  let seriesTagline: string | null = series.tagline;

  if (!body.skip_ai || !overview) {
    const { data: ai, error: aiErr } = await generateCampaignJson<PlanAiResult>({
      system: OVERVIEW_537_SYSTEM,
      user: buildOverview537User({
        leadTopic,
        brain,
        newsletterNameHint: series.name,
      }),
      maxTokens: 4096,
    });
    if (aiErr || !ai) {
      return NextResponse.json(
        { error: aiErr ?? "Failed to generate 5-3-7 plan." },
        { status: 502 }
      );
    }
    overview = normalizeOverview537(ai);
    if (overview.strategies.length < 5 || overview.mistakes.length < 3 || overview.checklist.length < 7) {
      return NextResponse.json(
        { error: "AI returned an incomplete 5-3-7. Try again." },
        { status: 502 }
      );
    }
    nameIdeas = Array.isArray(ai.name_ideas)
      ? ai.name_ideas.map((x) => String(x).trim()).filter(Boolean)
      : [];
    if (ai.series_tagline?.trim()) seriesTagline = ai.series_tagline.trim();
    if (ai.lead_topic?.trim()) {
      // prefer AI refined topic
    }
  }

  if (!overview) {
    return NextResponse.json({ error: "Overview 5-3-7 required." }, { status: 400 });
  }

  const cascade = fillCascadeToYear(
    buildCascadeFrom537({
      leadTopic,
      overview,
      lengthMode: body.length_mode ?? "short",
    }),
    {
      targetCount: body.target_count ?? 26,
      industryLabel: brain.industryLabel,
    }
  );

  const now = new Date().toISOString();
  const { error: delErr } = await supabaseAdmin
    .from("linkedin_newsletter_editions")
    .delete()
    .eq("series_id", id)
    .eq("user_id", auth.userId);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  const rows = cascade.map((e) => ({
    series_id: id,
    user_id: auth.userId,
    sequence_index: e.sequence_index,
    kind: e.kind,
    kind_index: e.kind_index,
    title: e.title,
    tagline: e.tagline,
    format: e.format,
    length_mode: e.length_mode,
    status: "planned",
    body_markdown: "",
    cover: {},
    blocks: [],
  }));

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("linkedin_newsletter_editions")
    .insert(rows)
    .select("*");

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const { data: updated, error: upErr } = await supabaseAdmin
    .from("linkedin_newsletter_series")
    .update({
      lead_topic: leadTopic,
      overview_537: overview,
      tagline: seriesTagline,
      updated_at: now,
    })
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select("*")
    .maybeSingle();

  if (upErr || !updated) {
    return NextResponse.json(
      { error: upErr?.message ?? "Failed to update series." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    series: mapSeriesRow(updated as Record<string, unknown>),
    editions: (inserted ?? []).map((r) => mapEditionRow(r as Record<string, unknown>)),
    name_ideas: nameIdeas,
  });
}
