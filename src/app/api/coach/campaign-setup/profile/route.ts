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
import type { IdealClientProfilePayload } from "@/lib/firstCampaign/types";

export const maxDuration = 120;

async function resolveIcpId(coachId: string, explicit?: string | null): Promise<string | null> {
  if (explicit) return explicit;
  const { data } = await supabaseAdmin
    .from("coach_campaign_setup")
    .select("selected_icp_id")
    .eq("coach_id", coachId)
    .maybeSingle();
  return (data?.selected_icp_id as string | null) ?? null;
}

/** Generate Ideal Client Profile only (facilitated step 3A). */
export async function POST(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const coachId = auth.userId;

  const body = (await request.json().catch(() => ({}))) as {
    icpId?: string;
    icp?: { id?: string };
    force?: boolean;
  };

  const icpId = await resolveIcpId(coachId, body.icpId ?? body.icp?.id ?? null);
  if (!icpId) {
    return NextResponse.json(
      { error: "Choose an ICP first (step 2) before generating a profile." },
      { status: 400 }
    );
  }

  const { data: icp, error: icpError } = await supabaseAdmin
    .from("coach_icps")
    .select("*")
    .eq("id", icpId)
    .eq("coach_id", coachId)
    .maybeSingle();

  if (icpError || !icp) {
    return NextResponse.json({ error: "ICP not found." }, { status: 404 });
  }

  const existing = icp.profile_payload as IdealClientProfilePayload | null;
  const hasProfile =
    existing && typeof existing === "object" && Boolean(existing.targetMarket);

  // Return existing unlocked draft unless force regenerate
  if (hasProfile && !body.force && !icp.profile_locked_at) {
    return NextResponse.json({
      profile: existing,
      icpId,
      locked: false,
      reused: true,
    });
  }

  const [{ summary: linkedInSummary }, libraryMatch] = await Promise.all([
    loadCoachLinkedInSummary(coachId),
    findLibraryMatch(icp.industry as string),
  ]);

  const { data, error } = await generateCampaignJson<IdealClientProfilePayload>({
    system: PROFILE_SYSTEM,
    user: buildProfileUser({
      icp,
      linkedInSummary,
      libraryContext: buildLibraryContextText(libraryMatch),
      vocabulary: buildVocabularyText(libraryMatch),
    }),
    maxTokens: 4096,
  });

  if (!data) {
    return NextResponse.json(
      { error: error ?? "Could not generate profile. Try again." },
      { status: 502 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("coach_icps")
    .update({
      profile_payload: data,
      profile_locked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", icpId)
    .eq("coach_id", coachId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    profile: data,
    icpId,
    locked: false,
    reused: false,
  });
}

type PatchBody = {
  icpId?: string;
  profile?: IdealClientProfilePayload;
  lock?: boolean;
  unlock?: boolean;
};

/** Save profile edits and/or lock for Avatar generation. */
export async function PATCH(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const coachId = auth.userId;

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const icpId = await resolveIcpId(coachId, body.icpId ?? null);
  if (!icpId) {
    return NextResponse.json({ error: "No ICP selected." }, { status: 400 });
  }

  const { data: icp, error: icpError } = await supabaseAdmin
    .from("coach_icps")
    .select("*")
    .eq("id", icpId)
    .eq("coach_id", coachId)
    .maybeSingle();

  if (icpError || !icp) {
    return NextResponse.json({ error: "ICP not found." }, { status: 404 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.profile) {
    update.profile_payload = body.profile;
  }

  if (body.unlock) {
    update.profile_locked_at = null;
  } else if (body.lock) {
    const payload = (body.profile ?? icp.profile_payload) as IdealClientProfilePayload | null;
    if (!payload?.targetMarket) {
      return NextResponse.json(
        { error: "Generate and review a profile before locking." },
        { status: 400 }
      );
    }
    update.profile_locked_at = new Date().toISOString();
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("coach_icps")
    .update(update)
    .eq("id", icpId)
    .eq("coach_id", coachId)
    .select("*")
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message ?? "Could not update profile." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    profile: updated.profile_payload as IdealClientProfilePayload,
    icpId,
    locked: Boolean(updated.profile_locked_at),
    profileLockedAt: updated.profile_locked_at as string | null,
  });
}
