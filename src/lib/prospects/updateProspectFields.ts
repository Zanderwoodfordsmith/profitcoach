import {
  loadProspectNextActionsByCoach,
  upsertProspectNextAction,
  type ProspectNextAction,
} from "@/lib/actionPlans/prospectFollowUp";
import { tryUpdateContactStripping } from "@/lib/contactSchemaSafeInsert";
import {
  normalizeProspectLabel,
  normalizeProspectPersonName,
} from "@/lib/prospectDisplayFormat";
import { loadLatestAssessmentsByContactId } from "@/lib/prospectAssessmentSummary";
import {
  loadLatestPastCallsByContactId,
  loadNextCallsByContactId,
} from "@/lib/prospectNextCall";
import { resolveProspectStatus, type ProspectStatusDisplay } from "@/lib/prospectStatus";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ProspectFieldPatch = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  business_name?: string | null;
  prospect_status?: string | null;
  crm_contact_id?: string | null;
  next_action?: { text: string; due_at: string | null } | null;
};

export type UpdatedProspectFields = {
  full_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  business_name: string | null;
  prospect_status: string | null;
  crm_contact_id: string | null;
  status: ProspectStatusDisplay;
  next_action: ProspectNextAction | null;
};

function buildFullName(
  firstName: string | null,
  lastName: string | null
): string {
  const full = [firstName, lastName].filter(Boolean).join(" ").trim();
  return full || "Unknown";
}

export async function updateProspectFields(
  contactId: string,
  coachId: string,
  patch: ProspectFieldPatch
): Promise<UpdatedProspectFields> {
  const { data: contact, error: fetchError } = await supabaseAdmin
    .from("contacts")
    .select(
      "id, coach_id, type, full_name, email, phone, job_title, business_name, prospect_status, first_name, last_name"
    )
    .eq("id", contactId)
    .maybeSingle();

  if (fetchError) {
    throw new Error("Unable to load prospect.");
  }
  if (!contact || contact.coach_id !== coachId || contact.type !== "prospect") {
    throw new Error("Prospect not found.");
  }

  const contactPatch: Record<string, unknown> = {};

  if (patch.first_name !== undefined || patch.last_name !== undefined) {
    const firstName =
      patch.first_name !== undefined
        ? normalizeProspectPersonName(patch.first_name)
        : ((contact.first_name as string | null) ?? null);
    const lastName =
      patch.last_name !== undefined
        ? normalizeProspectPersonName(patch.last_name)
        : ((contact.last_name as string | null) ?? null);
    contactPatch.first_name = firstName;
    contactPatch.last_name = lastName;
    contactPatch.full_name = buildFullName(firstName, lastName);
  }

  if (patch.email !== undefined) {
    const email = patch.email?.trim().toLowerCase() || null;
    if (!email) {
      throw new Error("Email is required.");
    }
    if (email !== (contact.email as string | null)?.toLowerCase()) {
      const { data: duplicate, error: duplicateError } = await supabaseAdmin
        .from("contacts")
        .select("id")
        .eq("coach_id", coachId)
        .eq("email", email)
        .neq("id", contactId)
        .maybeSingle();
      if (duplicateError) {
        throw new Error("Unable to validate email.");
      }
      if (duplicate?.id) {
        throw new Error("Another contact already uses this email.");
      }
    }
    contactPatch.email = email;
  }

  if (patch.phone !== undefined) {
    contactPatch.phone = patch.phone?.trim() || null;
  }

  if (patch.job_title !== undefined) {
    contactPatch.job_title = normalizeProspectLabel(patch.job_title);
  }
  if (patch.business_name !== undefined) {
    contactPatch.business_name = normalizeProspectLabel(patch.business_name);
  }
  if (patch.prospect_status !== undefined) {
    contactPatch.prospect_status = patch.prospect_status?.trim() || null;
  }
  if (patch.crm_contact_id !== undefined) {
    contactPatch.crm_contact_id = patch.crm_contact_id?.trim() || null;
  }

  if (Object.keys(contactPatch).length > 0) {
    const { error } = await tryUpdateContactStripping(contactId, contactPatch);
    if (error) {
      throw new Error(error.message);
    }
  }

  let nextAction: ProspectNextAction | null = null;
  if (patch.next_action !== undefined) {
    nextAction = await upsertProspectNextAction(coachId, contactId, {
      text: patch.next_action?.text ?? "",
      dueAt: patch.next_action?.due_at ?? null,
    });
  } else {
    const existing = await loadProspectNextActionsByCoach(supabaseAdmin, coachId, [
      contactId,
    ]);
    nextAction = existing[contactId] ?? null;
  }

  const { data: refreshed, error: refreshError } = await supabaseAdmin
    .from("contacts")
    .select(
      "full_name, email, phone, job_title, business_name, prospect_status, crm_contact_id"
    )
    .eq("id", contactId)
    .maybeSingle();

  if (refreshError || !refreshed) {
    throw new Error("Unable to refresh prospect.");
  }

  const prospect_status = (refreshed.prospect_status as string | null) ?? null;

  const [latestByContact, nextCallByContact, pastCallByContact] =
    await Promise.all([
      loadLatestAssessmentsByContactId(supabaseAdmin, [contactId]),
      loadNextCallsByContactId(supabaseAdmin, [contactId]),
      loadLatestPastCallsByContactId(supabaseAdmin, [contactId]),
    ]);

  const latest = latestByContact[contactId];

  return {
    full_name: (refreshed.full_name as string) ?? "Unknown",
    email: (refreshed.email as string | null) ?? null,
    phone: (refreshed.phone as string | null) ?? null,
    job_title: (refreshed.job_title as string | null) ?? null,
    business_name: (refreshed.business_name as string | null) ?? null,
    prospect_status,
    crm_contact_id: (refreshed.crm_contact_id as string | null) ?? null,
    status: resolveProspectStatus({
      prospect_status,
      last_completed_at: latest?.completed_at ?? null,
      next_call: nextCallByContact[contactId] ?? null,
      last_past_call_status: pastCallByContact[contactId] ?? null,
      next_action: nextAction,
    }),
    next_action: nextAction,
  };
}
