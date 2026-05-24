import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProspectNextActionsForContacts } from "./actionPlans/prospectFollowUp";
import { loadLatestAssessmentsByContactId } from "./prospectAssessmentSummary";
import {
  loadFallbackPhonesByContactId,
  loadLatestPastCallsByContactId,
  loadNextCallsByContactId,
} from "./prospectNextCall";
import { resolveProspectStatus } from "./prospectStatus";
import type { ProspectRow } from "./prospectRow";

type ContactRecord = {
  id: string;
  full_name: string;
  job_title?: string | null;
  prospect_status?: string | null;
  email: string | null;
  business_name: string | null;
  phone?: string | null;
  type: string;
  coach_id?: string | null;
  coach_name?: string | null;
  coach_business_name?: string | null;
};

export async function enrichProspectRows(
  supabase: SupabaseClient,
  contacts: ContactRecord[]
): Promise<ProspectRow[]> {
  const contactIds = contacts.map((contact) => contact.id);

  const [
    latestByContact,
    nextCallByContact,
    pastCallByContact,
    nextActionByContact,
    fallbackPhonesByContact,
  ] = await Promise.all([
    loadLatestAssessmentsByContactId(supabase, contactIds),
    loadNextCallsByContactId(supabase, contactIds),
    loadLatestPastCallsByContactId(supabase, contactIds),
    loadProspectNextActionsForContacts(contacts),
    loadFallbackPhonesByContactId(supabase, contacts),
  ]);

  return contacts.map((contact) => {
    const latest = latestByContact[contact.id];
    const summary = latest?.summary ?? null;
    const next_call = nextCallByContact[contact.id] ?? null;
    const next_action = nextActionByContact[contact.id] ?? null;
    const prospect_status = contact.prospect_status ?? null;

    return {
      id: contact.id,
      full_name: contact.full_name,
      job_title: contact.job_title ?? null,
      email: contact.email ?? null,
      business_name: contact.business_name ?? null,
      phone: contact.phone ?? fallbackPhonesByContact[contact.id] ?? null,
      type: contact.type,
      prospect_status,
      status: resolveProspectStatus({
        prospect_status,
        last_completed_at: latest?.completed_at ?? null,
        next_call,
        last_past_call_status: pastCallByContact[contact.id] ?? null,
        next_action,
      }),
      coach_id: contact.coach_id ?? undefined,
      coach_name: contact.coach_name ?? null,
      coach_business_name: contact.coach_business_name ?? null,
      last_score: latest?.total_score ?? null,
      last_completed_at: latest?.completed_at ?? null,
      revenue: summary?.revenue ?? null,
      team_size: summary?.team_size ?? null,
      years_in_business: summary?.years_in_business ?? null,
      outcome: summary?.outcome ?? null,
      obstacles: summary?.obstacles ?? null,
      preferred_support: summary?.preferred_support ?? null,
      boss_level: summary?.boss_level ?? null,
      next_call: nextCallByContact[contact.id] ?? null,
      next_action: nextActionByContact[contact.id] ?? null,
    };
  });
}
