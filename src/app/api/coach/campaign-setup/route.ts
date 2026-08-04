import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CampaignStep } from "@/lib/firstCampaign/types";

type SetupRow = {
  coach_id: string;
  current_step: number;
  step1_completed_at: string | null;
  step2_completed_at: string | null;
  step3_completed_at: string | null;
  step4_completed_at: string | null;
  step5_completed_at: string | null;
  selected_icp_id: string | null;
  selected_avatar_id: string | null;
  selected_lead_list_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

async function ensureSetupRow(coachId: string): Promise<SetupRow | null> {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("coach_campaign_setup")
    .select("*")
    .eq("coach_id", coachId)
    .maybeSingle();

  if (fetchError) return null;
  if (existing) return existing as SetupRow;

  const { data: created, error: insertError } = await supabaseAdmin
    .from("coach_campaign_setup")
    .insert({ coach_id: coachId })
    .select("*")
    .single();

  if (insertError) return null;
  return created as SetupRow;
}

function formatSetup(row: SetupRow) {
  return {
    currentStep: row.current_step as CampaignStep,
    step1CompletedAt: row.step1_completed_at,
    step2CompletedAt: row.step2_completed_at,
    step3CompletedAt: row.step3_completed_at,
    step4CompletedAt: row.step4_completed_at,
    step5CompletedAt: row.step5_completed_at,
    selectedIcpId: row.selected_icp_id,
    selectedAvatarId: row.selected_avatar_id,
    selectedLeadListId: row.selected_lead_list_id,
    meta: row.meta ?? {},
  };
}

async function loadSummaries(row: SetupRow) {
  const [icpRes, avatarRes, listRes, messagesRes] = await Promise.all([
    row.selected_icp_id
      ? supabaseAdmin
          .from("coach_icps")
          .select("*")
          .eq("id", row.selected_icp_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    row.selected_avatar_id
      ? supabaseAdmin
          .from("coach_avatars")
          .select("*")
          .eq("id", row.selected_avatar_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    row.selected_lead_list_id
      ? supabaseAdmin
          .from("coach_lead_lists")
          .select("*")
          .eq("id", row.selected_lead_list_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    row.selected_icp_id
      ? supabaseAdmin
          .from("coach_campaign_messages")
          .select("*")
          .eq("coach_id", row.coach_id)
          .eq("icp_id", row.selected_icp_id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  return {
    selectedIcp: icpRes.data ?? null,
    selectedAvatar: avatarRes.data ?? null,
    selectedLeadList: listRes.data ?? null,
    messages: messagesRes.data ?? [],
  };
}

export async function GET(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const row = await ensureSetupRow(auth.userId);
  if (!row) {
    return NextResponse.json({ error: "Could not load campaign setup." }, { status: 500 });
  }

  const summaries = await loadSummaries(row);

  return NextResponse.json({
    setup: formatSetup(row),
    ...summaries,
  });
}

type PatchBody = {
  currentStep?: CampaignStep;
  markStepComplete?: 1 | 2 | 3 | 4 | 5;
  clearStepComplete?: 1 | 2 | 3 | 4 | 5;
  selectedIcpId?: string | null;
  selectedAvatarId?: string | null;
  selectedLeadListId?: string | null;
  meta?: Record<string, unknown>;
};

export async function PATCH(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as PatchBody;

  const existing = await ensureSetupRow(auth.userId);
  if (!existing) {
    return NextResponse.json({ error: "Could not load campaign setup." }, { status: 500 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.currentStep !== undefined) {
    if (![1, 2, 3, 4, 5].includes(body.currentStep)) {
      return NextResponse.json({ error: "currentStep must be 1-5." }, { status: 400 });
    }
    update.current_step = body.currentStep;
  }

  if (body.markStepComplete !== undefined) {
    const key = `step${body.markStepComplete}_completed_at`;
    update[key] = new Date().toISOString();
  }

  if (body.clearStepComplete !== undefined) {
    const key = `step${body.clearStepComplete}_completed_at`;
    update[key] = null;
  }

  if (body.selectedIcpId !== undefined) update.selected_icp_id = body.selectedIcpId;
  if (body.selectedAvatarId !== undefined) update.selected_avatar_id = body.selectedAvatarId;
  if (body.selectedLeadListId !== undefined)
    update.selected_lead_list_id = body.selectedLeadListId;

  if (body.meta !== undefined) {
    update.meta = { ...(existing.meta ?? {}), ...body.meta };
  }

  const { data: updated, error } = await supabaseAdmin
    .from("coach_campaign_setup")
    .update(update)
    .eq("coach_id", auth.userId)
    .select("*")
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to update campaign setup." },
      { status: 500 }
    );
  }

  const summaries = await loadSummaries(updated as SetupRow);

  return NextResponse.json({
    setup: formatSetup(updated as SetupRow),
    ...summaries,
  });
}
