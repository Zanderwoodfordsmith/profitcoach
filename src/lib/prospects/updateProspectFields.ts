import {
  loadProspectNextActionsByCoach,
  upsertProspectNextAction,
  type ProspectNextAction,
} from "@/lib/actionPlans/prospectFollowUp";
import { normalizeLinkedInProfileUrl } from "@/lib/apify/linkedinProfile";
import { tryUpdateContactStripping } from "@/lib/contactSchemaSafeInsert";
import { normalizeContactPhone } from "@/lib/contacts/identity";
import { selectContactsWithOptionalPhone } from "@/lib/contactsSchemaSafeSelect";
import {
  normalizeProspectLabel,
  normalizeProspectPersonName,
} from "@/lib/prospectDisplayFormat";
import { normalizeCompanyWebsiteUrl } from "@/lib/leadFinder/display";
import { loadLatestProspectAssessmentAtByContactId } from "@/lib/prospectAssessmentSummary";
import {
  loadLatestPastCallsByContactId,
  loadNextCallsByContactId,
} from "@/lib/prospectNextCall";
import { resolveProspectStatus, type ProspectStatusDisplay } from "@/lib/prospectStatus";
import { normalizeProspectTags } from "@/lib/prospects/tags";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { syncContactWhatsAppStatus } from "@/lib/unipile/checkWhatsAppOn";

export type ProspectFieldPatch = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  business_name?: string | null;
  linkedin_url?: string | null;
  company_website?: string | null;
  prospect_status?: string | null;
  crm_contact_id?: string | null;
  next_action?: { text: string; due_at: string | null } | null;
  tags?: string[];
};

export type UpdatedProspectFields = {
  full_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  business_name: string | null;
  linkedin_url: string | null;
  company_website: string | null;
  prospect_status: string | null;
  crm_contact_id: string | null;
  status: ProspectStatusDisplay;
  next_action: ProspectNextAction | null;
  tags: string[];
  has_whatsapp?: boolean;
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
  let contact: Record<string, unknown> | null = null;
  {
    const withLinkedIn = await supabaseAdmin
      .from("contacts")
      .select(
        "id, coach_id, type, full_name, email, phone, job_title, business_name, linkedin_url, prospect_status, first_name, last_name"
      )
      .eq("id", contactId)
      .maybeSingle();
    if (
      withLinkedIn.error &&
      (withLinkedIn.error.code === "42703" || withLinkedIn.error.code === "PGRST204")
    ) {
      const fallback = await supabaseAdmin
        .from("contacts")
        .select(
          "id, coach_id, type, full_name, email, phone, job_title, business_name, prospect_status, first_name, last_name"
        )
        .eq("id", contactId)
        .maybeSingle();
      if (fallback.error) {
        throw new Error("Unable to load prospect.");
      }
      contact = (fallback.data as Record<string, unknown> | null) ?? null;
    } else if (withLinkedIn.error) {
      throw new Error("Unable to load prospect.");
    } else {
      contact = (withLinkedIn.data as Record<string, unknown> | null) ?? null;
    }
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
    const phone = patch.phone?.trim() || null;
    if (phone) {
      const phoneKey = normalizeContactPhone(phone);
      if (phoneKey) {
        const { data: siblings } = await selectContactsWithOptionalPhone<{
          id: string;
          phone: string | null;
        }>(
          async (columns) =>
            supabaseAdmin
              .from("contacts")
              .select(columns)
              .eq("coach_id", coachId)
              .neq("id", contactId),
          "id, email",
          []
        );
        const clash = siblings.find(
          (row) => normalizeContactPhone(row.phone) === phoneKey
        );
        if (clash) {
          throw new Error(
            "Another contact already uses this phone. Merge the duplicates instead."
          );
        }
      }
    }
    contactPatch.phone = phone;
  }

  if (patch.job_title !== undefined) {
    contactPatch.job_title = normalizeProspectLabel(patch.job_title);
  }
  if (patch.business_name !== undefined) {
    contactPatch.business_name = normalizeProspectLabel(patch.business_name);
  }
  if (patch.linkedin_url !== undefined) {
    const raw = patch.linkedin_url?.trim() || null;
    if (!raw) {
      contactPatch.linkedin_url = null;
    } else {
      const normalized = normalizeLinkedInProfileUrl(raw);
      if (!normalized) {
        throw new Error("Invalid LinkedIn profile URL.");
      }
      if (normalized !== (contact.linkedin_url as string | null)) {
        const { data: duplicate, error: duplicateError } = await supabaseAdmin
          .from("contacts")
          .select("id")
          .eq("coach_id", coachId)
          .eq("linkedin_url", normalized)
          .neq("id", contactId)
          .maybeSingle();
        if (duplicateError && duplicateError.code !== "42703" && duplicateError.code !== "PGRST204") {
          throw new Error("Unable to validate LinkedIn URL.");
        }
        if (duplicate?.id) {
          throw new Error("Another contact already uses this LinkedIn URL.");
        }
      }
      contactPatch.linkedin_url = normalized;
    }
  }
  if (patch.company_website !== undefined) {
    const raw = patch.company_website?.trim() || null;
    if (!raw) {
      contactPatch.company_website = null;
    } else {
      const normalized = normalizeCompanyWebsiteUrl(raw);
      if (!normalized) {
        throw new Error("Invalid website URL.");
      }
      contactPatch.company_website = normalized;
    }
  }
  if (patch.prospect_status !== undefined) {
    contactPatch.prospect_status = patch.prospect_status?.trim() || null;
  }
  if (patch.crm_contact_id !== undefined) {
    contactPatch.crm_contact_id = patch.crm_contact_id?.trim() || null;
  }
  if (patch.tags !== undefined) {
    contactPatch.prospect_tags = normalizeProspectTags(patch.tags);
  }

  if (Object.keys(contactPatch).length > 0) {
    const { error } = await tryUpdateContactStripping(contactId, contactPatch);
    if (error) {
      throw new Error(error.message);
    }

    // Keep messaging threads in sync — composer/send use conversation denormalized fields.
    const conversationPatch: Record<string, unknown> = {};
    if (contactPatch.phone !== undefined) {
      conversationPatch.prospect_phone = contactPatch.phone;
    }
    if (contactPatch.email !== undefined) {
      conversationPatch.prospect_email = contactPatch.email;
    }
    if (contactPatch.full_name !== undefined) {
      conversationPatch.prospect_name = contactPatch.full_name;
    }
    if (contactPatch.business_name !== undefined) {
      conversationPatch.prospect_business_name = contactPatch.business_name;
    }
    if (contactPatch.linkedin_url !== undefined) {
      conversationPatch.prospect_linkedin_url = contactPatch.linkedin_url;
    }
    if (Object.keys(conversationPatch).length > 0) {
      const { error: convError } = await supabaseAdmin
        .from("messaging_conversations")
        .update(conversationPatch)
        .eq("coach_id", coachId)
        .eq("contact_id", contactId);
      if (convError) {
        console.error("messaging conversation contact sync:", convError);
      }
    }
  }

  let hasWhatsApp: boolean | undefined;
  if (patch.phone !== undefined) {
    const wa = await syncContactWhatsAppStatus({
      coachId,
      contactId,
      phoneOverride: (contactPatch.phone as string | null | undefined) ?? null,
      force: true,
    });
    hasWhatsApp = wa.on === true;
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

  let refreshed: Record<string, unknown> | null = null;
  {
    const withLinkedIn = await supabaseAdmin
      .from("contacts")
      .select(
        "full_name, email, phone, job_title, business_name, linkedin_url, company_website, prospect_status, crm_contact_id, prospect_tags"
      )
      .eq("id", contactId)
      .maybeSingle();
    if (
      withLinkedIn.error &&
      (withLinkedIn.error.code === "42703" || withLinkedIn.error.code === "PGRST204")
    ) {
      const fallback = await supabaseAdmin
        .from("contacts")
        .select(
          "full_name, email, phone, job_title, business_name, prospect_status, crm_contact_id"
        )
        .eq("id", contactId)
        .maybeSingle();
      if (fallback.error || !fallback.data) {
        throw new Error("Unable to refresh prospect.");
      }
      refreshed = fallback.data as Record<string, unknown>;
    } else if (withLinkedIn.error || !withLinkedIn.data) {
      throw new Error("Unable to refresh prospect.");
    } else {
      refreshed = withLinkedIn.data as Record<string, unknown>;
    }
  }

  const prospect_status = (refreshed.prospect_status as string | null) ?? null;

  const [latestAtByContact, nextCallByContact, pastCallByContact] =
    await Promise.all([
      loadLatestProspectAssessmentAtByContactId(supabaseAdmin, [contactId]),
      loadNextCallsByContactId(supabaseAdmin, [contactId]),
      loadLatestPastCallsByContactId(supabaseAdmin, [contactId]),
    ]);

  return {
    full_name: (refreshed.full_name as string) ?? "Unknown",
    email: (refreshed.email as string | null) ?? null,
    phone: (refreshed.phone as string | null) ?? null,
    job_title: (refreshed.job_title as string | null) ?? null,
    business_name: (refreshed.business_name as string | null) ?? null,
    linkedin_url: (refreshed.linkedin_url as string | null) ?? null,
    company_website: (refreshed.company_website as string | null) ?? null,
    prospect_status,
    crm_contact_id: (refreshed.crm_contact_id as string | null) ?? null,
    status: resolveProspectStatus({
      prospect_status,
      last_completed_at: latestAtByContact[contactId] ?? null,
      next_call: nextCallByContact[contactId] ?? null,
      last_past_call_status: pastCallByContact[contactId] ?? null,
      next_action: nextAction,
    }),
    next_action: nextAction,
    tags: normalizeProspectTags(refreshed.prospect_tags),
    ...(hasWhatsApp !== undefined ? { has_whatsapp: hasWhatsApp } : {}),
  };
}
