import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import {
  AVATAR_SYSTEM,
  buildAvatarUser,
} from "@/lib/firstCampaign/prompts";
import {
  buildLibraryContextText,
  buildVocabularyText,
  findLibraryMatch,
  loadCoachLinkedInSummary,
} from "@/lib/firstCampaign/loadCoachContext";
import { buildBrainSliceFromAvatar } from "@/lib/firstCampaign/brainFromAvatar";
import {
  loadCoachAiContextRow,
  mergeCoachAiContext,
} from "@/lib/profitCoachAi/loadCoachPromptContext";
import { normalizeAvatarPayload } from "@/lib/firstCampaign/avatarNormalize";
import {
  CAMPAIGN_BRAIN_KEYS,
  type AvatarPayload,
  type CampaignBrainKey,
  type IdealClientProfilePayload,
} from "@/lib/firstCampaign/types";
import { mapAvatarRowToState } from "@/lib/firstCampaign/mapApi";

async function resolveIcpId(coachId: string, explicit?: string | null): Promise<string | null> {
  if (explicit) return explicit;
  const { data } = await supabaseAdmin
    .from("coach_campaign_setup")
    .select("selected_icp_id")
    .eq("coach_id", coachId)
    .maybeSingle();
  return (data?.selected_icp_id as string | null) ?? null;
}

async function resolveAvatarId(coachId: string, explicit?: string | null): Promise<string | null> {
  if (explicit) return explicit;
  const { data } = await supabaseAdmin
    .from("coach_campaign_setup")
    .select("selected_avatar_id")
    .eq("coach_id", coachId)
    .maybeSingle();
  return (data?.selected_avatar_id as string | null) ?? null;
}

export const maxDuration = 120;

export async function POST(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const coachId = auth.userId;

  const body = (await request.json().catch(() => ({}))) as {
    icpId?: string;
    /** UI may send the whole ICP object — prefer its id when present. */
    icp?: { id?: string };
  };
  const icpId = await resolveIcpId(coachId, body.icpId ?? body.icp?.id ?? null);
  if (!icpId) {
    return NextResponse.json(
      { error: "Choose an ICP first (step 2) before generating an avatar." },
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

  if (!icp.profile_locked_at) {
    return NextResponse.json(
      {
        error:
          "Confirm and lock your Ideal Client Profile before generating the avatar.",
      },
      { status: 400 }
    );
  }

  const profilePayload =
    (icp.profile_payload as IdealClientProfilePayload | null | undefined) ?? null;
  if (!profilePayload?.targetMarket) {
    return NextResponse.json(
      { error: "Locked profile is missing. Re-generate and lock the profile first." },
      { status: 400 }
    );
  }

  const [{ summary: linkedInSummary }, libraryMatch] = await Promise.all([
    loadCoachLinkedInSummary(coachId),
    findLibraryMatch(icp.industry as string),
  ]);

  const avatarResult = await generateCampaignJson<unknown>({
    system: AVATAR_SYSTEM,
    user: buildAvatarUser({
      profile: profilePayload,
      linkedInSummary,
      libraryContext: buildLibraryContextText(libraryMatch),
      vocabulary: buildVocabularyText(libraryMatch),
    }),
    maxTokens: 8192,
  });

  const normalized = normalizeAvatarPayload(avatarResult.data);
  if (!normalized) {
    console.error("[campaign-setup/avatar] avatar gen failed", {
      error: avatarResult.error,
      rawHead: avatarResult.raw?.slice(0, 400),
    });
    return NextResponse.json(
      {
        error: avatarResult.error ?? "Could not generate avatar. Try again.",
      },
      { status: 502 }
    );
  }

  // Replace any prior avatar draft for this ICP
  await supabaseAdmin
    .from("coach_avatars")
    .delete()
    .eq("coach_id", coachId)
    .eq("icp_id", icpId);

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("coach_avatars")
    .insert({
      coach_id: coachId,
      icp_id: icpId,
      library_id: libraryMatch?.id ?? null,
      generated_payload: normalized,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    console.error("[campaign-setup/avatar] insert failed", insertError?.message);
    return NextResponse.json(
      { error: insertError?.message ?? "Could not save avatar." },
      { status: 500 }
    );
  }

  await supabaseAdmin
    .from("coach_campaign_setup")
    .update({ selected_avatar_id: inserted.id, updated_at: new Date().toISOString() })
    .eq("coach_id", coachId);

  return NextResponse.json({
    profile: profilePayload,
    avatar: normalized,
    avatarRow: mapAvatarRowToState(inserted, profilePayload),
  });
}

type PatchBody = {
  avatarId?: string;
  /** UI sends `avatar`; older clients may send `editedPayload`. */
  avatar?: AvatarPayload;
  editedPayload?: AvatarPayload;
  profile?: IdealClientProfilePayload | null;
  approve?: boolean;
  saveToBrain?: CampaignBrainKey[];
};

export async function PATCH(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const coachId = auth.userId;

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const avatarId = await resolveAvatarId(coachId, body.avatarId);

  if (!avatarId) {
    return NextResponse.json({ error: "No avatar to update." }, { status: 400 });
  }

  const { data: avatarRow, error: avatarError } = await supabaseAdmin
    .from("coach_avatars")
    .select("*")
    .eq("id", avatarId)
    .eq("coach_id", coachId)
    .maybeSingle();

  if (avatarError || !avatarRow) {
    return NextResponse.json({ error: "Avatar not found." }, { status: 404 });
  }

  const editedPayload = body.avatar ?? body.editedPayload;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (editedPayload !== undefined) {
    update.edited_payload = editedPayload;
  }

  // Persist profile edits onto the ICP when provided
  if (body.profile && avatarRow.icp_id) {
    await supabaseAdmin
      .from("coach_icps")
      .update({
        profile_payload: body.profile,
        updated_at: new Date().toISOString(),
      })
      .eq("id", avatarRow.icp_id)
      .eq("coach_id", coachId);
  }

  const saveToBrain = (body.saveToBrain ?? []).filter((k): k is CampaignBrainKey =>
    (CAMPAIGN_BRAIN_KEYS as readonly string[]).includes(k)
  );

  let brainSavedKeys: string[] = avatarRow.brain_saved_keys ?? [];
  let profileForBrain =
    body.profile ??
    ((
      await supabaseAdmin
        .from("coach_icps")
        .select("profile_payload")
        .eq("id", avatarRow.icp_id)
        .maybeSingle()
    ).data?.profile_payload as IdealClientProfilePayload | null) ??
    null;

  if (saveToBrain.length > 0) {
    const effectiveAvatar = (editedPayload ??
      avatarRow.edited_payload ??
      avatarRow.generated_payload) as AvatarPayload | null;

    const slice = buildBrainSliceFromAvatar({
      profile: profileForBrain,
      avatar: effectiveAvatar,
      keys: saveToBrain,
    });

    const currentContext = (await loadCoachAiContextRow(coachId)) ?? {};
    const merged = mergeCoachAiContext(currentContext, slice);

    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({ ai_context: merged })
      .eq("id", coachId);

    if (profileUpdateError) {
      return NextResponse.json(
        { error: `Could not save to brain: ${profileUpdateError.message}` },
        { status: 500 }
      );
    }

    brainSavedKeys = [...new Set([...brainSavedKeys, ...saveToBrain])];
    update.brain_saved_keys = brainSavedKeys;
  }

  // Confirm always approves in the wizard flow when saveToBrain is present
  if (body.approve !== false && (saveToBrain.length > 0 || body.approve === true)) {
    update.approved_at = new Date().toISOString();
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("coach_avatars")
    .update(update)
    .eq("id", avatarId)
    .select("*")
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message ?? "Could not update avatar." },
      { status: 500 }
    );
  }

  if (updated.approved_at) {
    await supabaseAdmin
      .from("coach_campaign_setup")
      .update({
        step3_completed_at: new Date().toISOString(),
        current_step: 4,
        updated_at: new Date().toISOString(),
      })
      .eq("coach_id", coachId);
  }

  return NextResponse.json({
    avatar: mapAvatarRowToState(updated, profileForBrain),
  });
}
