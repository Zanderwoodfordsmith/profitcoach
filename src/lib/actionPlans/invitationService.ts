import { randomBytes } from "crypto";
import {
  activateActionPlanForCoach,
  coachHasActiveAssignment,
  inviteCoachesToActionPlan,
  loadTemplateItems,
  templateItemsToPreviewLines,
} from "@/lib/actionPlans/invitations";
import { resolvePushCoachIds } from "@/lib/actionPlans/pushActionPlan";
import { supabaseErrorMessage } from "@/lib/supabaseErrorMessage";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type TemplateJoin = {
  id?: string;
  title: string;
  description: string | null;
};

function unwrapTemplateJoin(value: unknown): TemplateJoin | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return (value[0] as TemplateJoin | undefined) ?? null;
  }
  return value as TemplateJoin;
}

export { inviteCoachesToActionPlan, resolvePushCoachIds };

export async function getOrCreateShareLink(input: {
  templateId: string;
  createdBy: string;
}): Promise<{ token: string; urlPath: string }> {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("action_plan_share_links")
    .select("token")
    .eq("template_id", input.templateId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;

  let token = existing?.token as string | undefined;
  if (!token) {
    token = randomBytes(12).toString("base64url");
    const { error: insertError } = await supabaseAdmin.from("action_plan_share_links").insert({
      template_id: input.templateId,
      token,
      created_by: input.createdBy,
    });
    if (insertError) throw insertError;
  }

  return {
    token,
    urlPath: `/coach/signature/actions?plan=${token}`,
  };
}

export async function resolveInvitationFromShareToken(input: {
  token: string;
  coachId: string;
}): Promise<{ invitationId: string; templateId: string; created: boolean }> {
  const { data: link, error: linkError } = await supabaseAdmin
    .from("action_plan_share_links")
    .select("id, template_id")
    .eq("token", input.token.trim())
    .maybeSingle();
  if (linkError) throw linkError;
  if (!link) throw new Error("Invalid or expired plan link.");

  if (await coachHasActiveAssignment(link.template_id as string, input.coachId)) {
    throw new Error("You have already accepted this action plan.");
  }

  const { data: pending, error: pendingError } = await supabaseAdmin
    .from("coach_action_plan_invitations")
    .select("id, template_id, status")
    .eq("template_id", link.template_id)
    .eq("coach_id", input.coachId)
    .eq("status", "pending")
    .maybeSingle();
  if (pendingError) throw pendingError;
  if (pending) {
    return {
      invitationId: pending.id as string,
      templateId: pending.template_id as string,
      created: false,
    };
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from("coach_action_plan_invitations")
    .insert({
      template_id: link.template_id,
      coach_id: input.coachId,
      share_link_id: link.id,
      status: "pending",
    })
    .select("id, template_id")
    .single();
  if (createError) throw createError;

  return {
    invitationId: created.id as string,
    templateId: created.template_id as string,
    created: true,
  };
}

export async function acceptInvitation(input: {
  invitationId: string;
  coachId: string;
}): Promise<{ assignmentId: string }> {
  const { data: invitation, error: invError } = await supabaseAdmin
    .from("coach_action_plan_invitations")
    .select("id, template_id, coach_id, status, invited_by")
    .eq("id", input.invitationId)
    .eq("coach_id", input.coachId)
    .maybeSingle();
  if (invError) throw invError;
  if (!invitation) throw new Error("Invitation not found.");
  if (invitation.status === "accepted") {
    throw new Error("Invitation already accepted.");
  }
  if (invitation.status === "declined") {
    throw new Error("Invitation was declined.");
  }

  const assignmentId = await activateActionPlanForCoach({
    templateId: invitation.template_id as string,
    coachId: input.coachId,
    assignedBy: (invitation.invited_by as string | null) ?? null,
  });

  const now = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from("coach_action_plan_invitations")
    .update({
      status: "accepted",
      responded_at: now,
      assignment_id: assignmentId,
    })
    .eq("id", input.invitationId);
  if (updateError) throw new Error(supabaseErrorMessage(updateError));

  return { assignmentId };
}

export async function declineInvitation(input: {
  invitationId: string;
  coachId: string;
}): Promise<void> {
  const { data: invitation, error: invError } = await supabaseAdmin
    .from("coach_action_plan_invitations")
    .select("id, status")
    .eq("id", input.invitationId)
    .eq("coach_id", input.coachId)
    .maybeSingle();
  if (invError) throw invError;
  if (!invitation) throw new Error("Invitation not found.");
  if (invitation.status !== "pending") {
    throw new Error("Invitation is no longer pending.");
  }

  const { error: updateError } = await supabaseAdmin
    .from("coach_action_plan_invitations")
    .update({
      status: "declined",
      responded_at: new Date().toISOString(),
    })
    .eq("id", input.invitationId);
  if (updateError) throw new Error(supabaseErrorMessage(updateError));
}

export async function loadInvitationPreview(invitationId: string, coachId: string) {
  const { data: invitation, error: invError } = await supabaseAdmin
    .from("coach_action_plan_invitations")
    .select(
      "id, template_id, status, invited_at, action_plan_templates(id, title, description)",
    )
    .eq("id", invitationId)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (invError) throw invError;
  if (!invitation) throw new Error("Invitation not found.");

  const template = unwrapTemplateJoin(invitation.action_plan_templates);

  const items = await loadTemplateItems(invitation.template_id as string);
  return {
    invitation: {
      id: invitation.id as string,
      templateId: invitation.template_id as string,
      status: invitation.status as string,
      invitedAt: invitation.invited_at as string,
      title: template?.title ?? "Action plan",
      description: template?.description ?? null,
    },
    previewItems: templateItemsToPreviewLines(items),
  };
}

export async function listPendingInvitationsForCoach(coachId: string) {
  const { data, error } = await supabaseAdmin
    .from("coach_action_plan_invitations")
    .select(
      "id, template_id, status, invited_at, action_plan_templates(id, title, description)",
    )
    .eq("coach_id", coachId)
    .eq("status", "pending")
    .order("invited_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const template = unwrapTemplateJoin(row.action_plan_templates);
    return {
      id: row.id as string,
      templateId: row.template_id as string,
      status: row.status as string,
      invitedAt: row.invited_at as string,
      title: template?.title ?? "Action plan",
      description: template?.description ?? null,
    };
  });
}

export async function listInvitationsForTemplate(templateId: string) {
  const { data, error } = await supabaseAdmin
    .from("coach_action_plan_invitations")
    .select("id, coach_id, status, invited_at, responded_at")
    .eq("template_id", templateId)
    .order("invited_at", { ascending: false });
  if (error) throw error;

  const rows = data ?? [];
  const coachIds = [...new Set(rows.map((row) => row.coach_id as string))];
  const nameById = new Map<string, string>();

  if (coachIds.length) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, coach_business_name")
      .in("id", coachIds);
    for (const profile of profiles ?? []) {
      nameById.set(
        profile.id as string,
        (profile.coach_business_name as string | null) ||
          (profile.full_name as string | null) ||
          "Coach",
      );
    }
  }

  return rows.map((row) => ({
    id: row.id as string,
    coachId: row.coach_id as string,
    coachName: nameById.get(row.coach_id as string) ?? null,
    status: row.status as string,
    invitedAt: row.invited_at as string,
    respondedAt: row.responded_at as string | null,
  }));
}
