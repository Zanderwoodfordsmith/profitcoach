import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { MESSAGES_SYSTEM, buildMessagesUser } from "@/lib/firstCampaign/prompts";
import { loadCoachLinkedInSummary } from "@/lib/firstCampaign/loadCoachContext";
import { loadCoachAiContextRow } from "@/lib/profitCoachAi/loadCoachPromptContext";
import type { AvatarPayload, CampaignMessageDraft } from "@/lib/firstCampaign/types";
import { mapMessageRowsToDrafts, mapMessageRowsToState } from "@/lib/firstCampaign/mapApi";

async function resolveIcpId(coachId: string, explicit?: string | null): Promise<string | null> {
  if (explicit) return explicit;
  const { data } = await supabaseAdmin
    .from("coach_campaign_setup")
    .select("selected_icp_id")
    .eq("coach_id", coachId)
    .maybeSingle();
  return (data?.selected_icp_id as string | null) ?? null;
}

function buildAvatarSummary(avatar: AvatarPayload | null): string {
  if (!avatar) return "(no avatar generated yet — use best judgment from the ICP)";
  const lines: string[] = [];
  if (avatar.persona?.headline) lines.push(`Persona: ${avatar.persona.headline}`);
  if (avatar.persona?.specificProblem?.text) {
    lines.push(`Specific problem: "${avatar.persona.specificProblem.text}"`);
  }
  if (avatar.persona?.quote) lines.push(`Ready-to-act quote: "${avatar.persona.quote}"`);
  if (avatar.mainDesires?.length) {
    lines.push("Main desires:", ...avatar.mainDesires.map((d) => `- ${d}`));
  }
  if (avatar.messagingHooks?.length) {
    lines.push("Messaging hooks:", ...avatar.messagingHooks.map((h) => `- ${h}`));
  }
  if (avatar.industryVocabulary) {
    const v = avatar.industryVocabulary;
    const vocab = [
      v.customers && `customers → ${v.customers}`,
      v.staff && `staff → ${v.staff}`,
      v.jobs && `jobs → ${v.jobs}`,
      v.money && `money → ${v.money}`,
    ].filter(Boolean);
    if (vocab.length) lines.push("Vocabulary:", ...vocab.map((v2) => `- ${v2}`));
  }
  return lines.join("\n") || "(avatar generated but empty)";
}

export async function POST(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const coachId = auth.userId;

  const body = (await request.json().catch(() => ({}))) as { icpId?: string };
  const icpId = await resolveIcpId(coachId, body.icpId);
  if (!icpId) {
    return NextResponse.json(
      { error: "Choose an ICP first (step 2) before drafting messages." },
      { status: 400 }
    );
  }

  const [{ data: icp }, { data: setup }, { summary: linkedInSummary }, brain] = await Promise.all([
    supabaseAdmin.from("coach_icps").select("*").eq("id", icpId).eq("coach_id", coachId).maybeSingle(),
    supabaseAdmin
      .from("coach_campaign_setup")
      .select("selected_avatar_id")
      .eq("coach_id", coachId)
      .maybeSingle(),
    loadCoachLinkedInSummary(coachId),
    loadCoachAiContextRow(coachId),
  ]);

  if (!icp) {
    return NextResponse.json({ error: "ICP not found." }, { status: 404 });
  }

  let avatarPayload: AvatarPayload | null = null;
  const avatarId = setup?.selected_avatar_id as string | null;
  if (avatarId) {
    const { data: avatarRow } = await supabaseAdmin
      .from("coach_avatars")
      .select("edited_payload, generated_payload")
      .eq("id", avatarId)
      .eq("coach_id", coachId)
      .maybeSingle();
    avatarPayload = (avatarRow?.edited_payload ?? avatarRow?.generated_payload ?? null) as
      | AvatarPayload
      | null;
  }

  const { data, error } = await generateCampaignJson<{ messages: CampaignMessageDraft[] }>({
    system: MESSAGES_SYSTEM,
    user: buildMessagesUser({
      icp,
      avatarSummary: buildAvatarSummary(avatarPayload),
      brain: brain ?? {},
      linkedInSummary,
    }),
    maxTokens: 2048,
  });

  if (error || !data?.messages?.length) {
    return NextResponse.json(
      { error: error ?? "Could not generate messages. Try again." },
      { status: 502 }
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from("coach_campaign_messages")
    .delete()
    .eq("coach_id", coachId)
    .eq("icp_id", icpId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const rows = data.messages.slice(0, 6).map((m, i) => ({
    coach_id: coachId,
    icp_id: icpId,
    variant_label: m.variantLabel,
    message_type: m.messageType,
    body: m.body,
    tokens: m.tokens ?? {},
    sort_order: i,
  }));

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("coach_campaign_messages")
    .insert(rows)
    .select("*")
    .order("sort_order", { ascending: true });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    messages: inserted ?? [],
    drafts: mapMessageRowsToDrafts((inserted ?? []) as Parameters<typeof mapMessageRowsToDrafts>[0]),
  });
}

type PatchBody = {
  messageIds?: string[];
  /** UI may send variant labels as `ids` */
  ids?: string[];
  drafts?: CampaignMessageDraft[];
  edits?: Record<string, string>;
  approve?: boolean;
  markStep4Complete?: boolean;
};

export async function PATCH(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const coachId = auth.userId;

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const icpId = await resolveIcpId(coachId, null);

  // Apply body edits from drafts first
  if (body.drafts?.length) {
    for (const draft of body.drafts) {
      if (!draft.id && !draft.variantLabel) continue;
      const patch: Record<string, unknown> = {
        body: draft.body,
        updated_at: new Date().toISOString(),
      };
      let q = supabaseAdmin
        .from("coach_campaign_messages")
        .update(patch)
        .eq("coach_id", coachId);
      if (draft.id) q = q.eq("id", draft.id);
      else q = q.eq("variant_label", draft.variantLabel);
      if (icpId) q = q.eq("icp_id", icpId);
      await q;
    }
  } else if (body.edits && Object.keys(body.edits).length) {
    for (const [key, text] of Object.entries(body.edits)) {
      await supabaseAdmin
        .from("coach_campaign_messages")
        .update({ body: text, updated_at: new Date().toISOString() })
        .eq("coach_id", coachId)
        .eq("variant_label", key);
    }
  }

  const { data: currentRows } = await supabaseAdmin
    .from("coach_campaign_messages")
    .select("*")
    .eq("coach_id", coachId)
    .eq("icp_id", icpId ?? "")
    .order("sort_order", { ascending: true });

  const rows = currentRows ?? [];
  const idSet = new Set((body.messageIds ?? []).filter(Boolean));
  const labelSet = new Set((body.ids ?? []).filter(Boolean));
  const hasSelection = idSet.size > 0 || labelSet.size > 0;
  const toApprove = hasSelection
    ? rows.filter((r) => idSet.has(r.id) || labelSet.has(r.variant_label))
    : [];

  const approve = body.approve !== false && hasSelection;
  if (approve) {
    // Clear previous approvals for this ICP, then stamp the selected set.
    await supabaseAdmin
      .from("coach_campaign_messages")
      .update({
        approved_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("coach_id", coachId)
      .eq("icp_id", icpId ?? "");

    if (toApprove.length > 0) {
      const { error } = await supabaseAdmin
        .from("coach_campaign_messages")
        .update({
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("coach_id", coachId)
        .in(
          "id",
          toApprove.map((r) => r.id)
        );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  let shouldCompleteStep4 = Boolean(body.markStep4Complete) || (approve && toApprove.length > 0);

  if (shouldCompleteStep4) {
    await supabaseAdmin
      .from("coach_campaign_setup")
      .update({
        step4_completed_at: new Date().toISOString(),
        current_step: 5,
        updated_at: new Date().toISOString(),
      })
      .eq("coach_id", coachId);
  }

  const { data: messages, error: fetchError } = await supabaseAdmin
    .from("coach_campaign_messages")
    .select("*")
    .eq("coach_id", coachId)
    .eq("icp_id", icpId ?? "")
    .order("sort_order", { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const messageState = mapMessageRowsToState(
    (messages ?? []) as Parameters<typeof mapMessageRowsToState>[0]
  );

  return NextResponse.json({
    messages: messageState,
    drafts: messageState.drafts,
    step4Completed: shouldCompleteStep4,
  });
}
