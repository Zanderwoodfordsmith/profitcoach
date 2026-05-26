import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProspectNextActionsForContacts } from "./actionPlans/prospectFollowUp";
import {
  loadLatestPremiumDiagnosticByContactId,
  loadLatestScorecardByContactId,
  loadPremiumSessionScoresByContactId,
} from "./prospectAssessmentSummary";
import {
  loadFallbackPhonesByContactId,
  loadLatestPastCallsByContactId,
  loadNextCallsByContactId,
} from "./prospectNextCall";
import { latestProspectAssessmentAt, type ProspectRow } from "./prospectRow";
import { resolveProspectStatus } from "./prospectStatus";

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
  crm_contact_id?: string | null;
  crm_location_id?: string | null;
  created_at?: string | null;
};

export async function enrichProspectRows(
  supabase: SupabaseClient,
  contacts: ContactRecord[]
): Promise<ProspectRow[]> {
  const contactIds = contacts.map((contact) => contact.id);

  const [
    scorecardByContact,
    diagnosticByContact,
    sessionByContact,
    nextCallByContact,
    pastCallByContact,
    nextActionByContact,
    fallbackPhonesByContact,
  ] = await Promise.all([
    loadLatestScorecardByContactId(supabase, contactIds),
    loadLatestPremiumDiagnosticByContactId(supabase, contactIds),
    loadPremiumSessionScoresByContactId(supabase, contactIds),
    loadNextCallsByContactId(supabase, contactIds),
    loadLatestPastCallsByContactId(supabase, contactIds),
    loadProspectNextActionsForContacts(supabase, contacts),
    loadFallbackPhonesByContactId(supabase, contacts),
  ]);

  return contacts.map((contact) => {
    const scorecard = scorecardByContact[contact.id];
    const diagnostic = diagnosticByContact[contact.id];
    const session = sessionByContact[contact.id];
    const summary = scorecard?.summary ?? null;
    const next_call = nextCallByContact[contact.id] ?? null;
    const next_action = nextActionByContact[contact.id] ?? null;
    const prospect_status = contact.prospect_status ?? null;

    const boss_score = scorecard?.total_score ?? null;
    const boss_score_at = scorecard?.completed_at ?? null;
    const boss_score_report_token = scorecard?.report_token ?? null;

    let boss_score_premium: number | null = null;
    let boss_score_premium_at: string | null = null;
    let boss_score_premium_source: ProspectRow["boss_score_premium_source"] = null;

    if (session) {
      boss_score_premium = session.total_score;
      boss_score_premium_at = session.updated_at ?? diagnostic?.completed_at ?? null;
      boss_score_premium_source = "coach_review";
    } else if (diagnostic) {
      boss_score_premium = diagnostic.total_score;
      boss_score_premium_at = diagnostic.completed_at;
      boss_score_premium_source = "diagnostic";
    }

    const last_assessed_at = latestProspectAssessmentAt(
      boss_score_at,
      boss_score_premium_at
    );

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
        last_completed_at: last_assessed_at,
        next_call,
        last_past_call_status: pastCallByContact[contact.id] ?? null,
        next_action,
      }),
      coach_id: contact.coach_id ?? undefined,
      coach_name: contact.coach_name ?? null,
      coach_business_name: contact.coach_business_name ?? null,
      boss_score,
      boss_score_at,
      boss_score_report_token,
      boss_score_premium,
      boss_score_premium_at,
      boss_score_premium_source,
      last_assessed_at,
      revenue: summary?.revenue ?? null,
      team_size: summary?.team_size ?? null,
      years_in_business: summary?.years_in_business ?? null,
      outcome: summary?.outcome ?? null,
      obstacles: summary?.obstacles ?? null,
      preferred_support: summary?.preferred_support ?? null,
      boss_level: summary?.boss_level ?? null,
      next_call: nextCallByContact[contact.id] ?? null,
      next_action: nextActionByContact[contact.id] ?? null,
      crm_contact_id: contact.crm_contact_id ?? null,
      crm_location_id: contact.crm_location_id ?? null,
      created_at: contact.created_at ?? null,
    };
  });
}
