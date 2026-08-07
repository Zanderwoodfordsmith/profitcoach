import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { PROFILE_SYSTEM, buildProfileUser } from "@/lib/firstCampaign/prompts";
import {
  buildLibraryContextText,
  buildVocabularyText,
  findLibraryMatch,
  loadCoachLinkedInSummary,
} from "@/lib/firstCampaign/loadCoachContext";
import type { IdealClientProfilePayload, SourcingRoute } from "@/lib/firstCampaign/types";
import { mapIcpRowToChosen } from "@/lib/firstCampaign/mapApi";

type IcpInputBody = {
  label?: string;
  industry?: string;
  geography?: string;
  roleTitles?: string[];
  teamSize?: string;
  revenueRange?: string;
  sourcingRoute?: SourcingRoute;
  inventoryCount?: number | null;
  leadFinderFilters?: Record<string, unknown>;
  rationale?: string;
  generateProfile?: boolean;
};

export async function POST(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const coachId = auth.userId;

  const body = (await request.json().catch(() => ({}))) as IcpInputBody;
  const label = body.label?.trim();
  const industry = body.industry?.trim();
  if (!label || !industry) {
    return NextResponse.json({ error: "label and industry are required." }, { status: 400 });
  }

  const insertRow = {
    coach_id: coachId,
    label,
    industry,
    geography: body.geography?.trim() || "United Kingdom",
    role_titles:
      body.roleTitles && body.roleTitles.length > 0
        ? body.roleTitles
        : ["Owner", "Founder", "CEO", "Managing Director"],
    team_size: body.teamSize?.trim() || "11-50",
    revenue_range: body.revenueRange?.trim() || "£1M-£10M",
    sourcing_route: body.sourcingRoute ?? "none",
    inventory_count: body.inventoryCount ?? null,
    lead_finder_filters: body.leadFinderFilters ?? {},
    is_selected: true,
  };

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("coach_icps")
    .insert(insertRow)
    .select("*")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? "Could not save ICP." },
      { status: 500 }
    );
  }

  await supabaseAdmin
    .from("coach_icps")
    .update({ is_selected: false })
    .eq("coach_id", coachId)
    .neq("id", inserted.id);

  let profilePayload: IdealClientProfilePayload | null = null;
  let profileError: string | null = null;

  // Profile LLM is slow — only run when explicitly requested. Avatar step fills it if missing.
  if (body.generateProfile === true) {
    const [{ summary: linkedInSummary }, libraryMatch] = await Promise.all([
      loadCoachLinkedInSummary(coachId),
      findLibraryMatch(industry),
    ]);

    const { data, error } = await generateCampaignJson<IdealClientProfilePayload>({
      system: PROFILE_SYSTEM,
      user: buildProfileUser({
        icp: inserted,
        linkedInSummary,
        libraryContext: buildLibraryContextText(libraryMatch),
        vocabulary: buildVocabularyText(libraryMatch),
      }),
      maxTokens: 3072,
    });

    if (data) {
      profilePayload = data;
      const { error: updateError } = await supabaseAdmin
        .from("coach_icps")
        .update({ profile_payload: data, updated_at: new Date().toISOString() })
        .eq("id", inserted.id);
      if (updateError) profileError = updateError.message;
    } else {
      profileError = error ?? "Could not generate profile.";
    }
  }

  await supabaseAdmin
    .from("coach_campaign_setup")
    .update({
      selected_icp_id: inserted.id,
      step2_completed_at: new Date().toISOString(),
      current_step: 3,
      updated_at: new Date().toISOString(),
    })
    .eq("coach_id", coachId);

  return NextResponse.json({
    icp: mapIcpRowToChosen(
      { ...inserted, profile_payload: profilePayload ?? inserted.profile_payload },
      body.rationale ?? ""
    ),
    profile: profilePayload ?? inserted.profile_payload ?? null,
    profileError,
  });
}
