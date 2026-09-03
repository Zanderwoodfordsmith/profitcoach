import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildPersonalisedAssessmentLink } from "@/lib/assessmentContactParams";

export type InterestOutcome = "positive" | "soft" | "negative" | "unclear";

export type FunnelStatus =
  | "replied"
  | "interested"
  | "assessment_sent"
  | "assessment_done"
  | "call_offered";

const PUBLIC_HOST =
  process.env.NEXT_PUBLIC_MARKETING_ORIGIN?.replace(/\/$/, "") ||
  "https://theprofitcoach.com";

export async function resolveCoachSlug(coachId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("coaches")
    .select("slug")
    .eq("id", coachId)
    .maybeSingle();
  return (data?.slug as string) || null;
}

export async function buildLeadAssessmentUrl(input: {
  coachId: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  email?: string | null;
}): Promise<string | null> {
  const slug = await resolveCoachSlug(input.coachId);
  if (!slug) return null;
  return buildPersonalisedAssessmentLink({
    coachSlug: slug,
    firstName: input.firstName || undefined,
    lastName: input.lastName || undefined,
    businessName: input.company || undefined,
    email: input.email || undefined,
    origin: PUBLIC_HOST,
  });
}

function appendFunnelEvent(
  existing: unknown,
  event: { type: string; at?: string; meta?: Record<string, unknown> }
) {
  const list = Array.isArray(existing) ? [...existing] : [];
  list.push({
    type: event.type,
    at: event.at || new Date().toISOString(),
    ...(event.meta ? { meta: event.meta } : {}),
  });
  return list.slice(-40);
}

/**
 * Log interest / advance funnel. Positive interest pauses automation jobs.
 */
export async function logLeadInterest(input: {
  coachId: string;
  leadId: string;
  outcome: InterestOutcome;
  note?: string | null;
  status?: FunnelStatus;
}) {
  const { data: lead, error } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select(
      "id, coach_id, campaign_id, status, funnel_events, interest_outcome"
    )
    .eq("id", input.leadId)
    .eq("coach_id", input.coachId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead) throw new Error("Lead not found.");

  const nextStatus: FunnelStatus | string =
    input.status ||
    (input.outcome === "positive" || input.outcome === "soft"
      ? "interested"
      : lead.status === "in_sequence" || lead.status === "connected"
        ? "replied"
        : (lead.status as string));

  const { data: updated, error: upErr } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .update({
      interest_outcome: input.outcome,
      interest_note: input.note?.trim() || null,
      interest_logged_at: new Date().toISOString(),
      status: nextStatus,
      next_action_at:
        input.outcome === "positive" || input.outcome === "soft"
          ? null
          : undefined,
      funnel_events: appendFunnelEvent(lead.funnel_events, {
        type: "interest_logged",
        meta: { outcome: input.outcome, status: nextStatus },
      }),
    })
    .eq("id", input.leadId)
    .select(
      "id, status, interest_outcome, interest_note, interest_logged_at, funnel_events, campaign_id"
    )
    .maybeSingle();
  if (upErr) throw new Error(upErr.message);

  if (input.outcome === "positive" || input.outcome === "soft") {
    await supabaseAdmin
      .from("linkedin_send_jobs")
      .update({
        status: "cancelled",
        last_error: "Paused — interested reply logged",
      })
      .eq("lead_id", input.leadId)
      .eq("status", "pending");
  }

  return updated;
}

export async function advanceLeadFunnel(input: {
  coachId: string;
  leadId: string;
  status: FunnelStatus;
  note?: string | null;
}) {
  const { data: lead, error } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select("id, funnel_events")
    .eq("id", input.leadId)
    .eq("coach_id", input.coachId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead) throw new Error("Lead not found.");

  const { data, error: upErr } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .update({
      status: input.status,
      next_action_at: null,
      interest_note: input.note?.trim() || undefined,
      funnel_events: appendFunnelEvent(lead.funnel_events, {
        type: "funnel_advance",
        meta: { status: input.status },
      }),
    })
    .eq("id", input.leadId)
    .select(
      "id, status, interest_outcome, interest_note, interest_logged_at, funnel_events"
    )
    .maybeSingle();
  if (upErr) throw new Error(upErr.message);

  await supabaseAdmin
    .from("linkedin_send_jobs")
    .update({
      status: "cancelled",
      last_error: `Paused — ${input.status}`,
    })
    .eq("lead_id", input.leadId)
    .eq("status", "pending");

  return data;
}

/** North-star queue: replies / interested / assessment pending call. */
export async function listInterestQueue(coachId: string) {
  const { data, error } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select(
      "id, campaign_id, first_name, last_name, company, title, status, interest_outcome, interest_note, interest_logged_at, linkedin_url, unipile_chat_id, updated_at, created_at"
    )
    .eq("coach_id", coachId)
    .in("status", [
      "replied",
      "interested",
      "assessment_sent",
      "assessment_done",
      "call_offered",
    ])
    .order("interest_logged_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type StepVariant = { key: string; label?: string; body: string };

export function parseStepVariants(raw: unknown): StepVariant[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => {
      if (!v || typeof v !== "object") return null;
      const r = v as Record<string, unknown>;
      const key = String(r.key || "").trim();
      const body = String(r.body || "");
      if (!key || !body) return null;
      return {
        key,
        label: typeof r.label === "string" ? r.label : undefined,
        body,
      };
    })
    .filter(Boolean) as StepVariant[];
}

/** Pick (and persist) A/B body for a step. */
export async function resolveStepBodyForLead(input: {
  leadId: string;
  stepId: string;
  body: string | null;
  variants: unknown;
  abAssignments: unknown;
}): Promise<{ body: string; variantKey: string | null }> {
  const variants = parseStepVariants(input.variants);
  if (!variants.length) {
    return { body: (input.body || "").trim(), variantKey: null };
  }

  const assignments =
    input.abAssignments &&
    typeof input.abAssignments === "object" &&
    !Array.isArray(input.abAssignments)
      ? ({ ...(input.abAssignments as Record<string, string>) } as Record<
          string,
          string
        >)
      : {};

  let key = assignments[input.stepId];
  if (!key || !variants.some((v) => v.key === key)) {
    key = variants[Math.floor(Math.random() * variants.length)].key;
    assignments[input.stepId] = key;
    await supabaseAdmin
      .from("linkedin_campaign_leads")
      .update({ ab_assignments: assignments })
      .eq("id", input.leadId);
  }

  const chosen = variants.find((v) => v.key === key) || variants[0];
  return { body: chosen.body, variantKey: key };
}

export async function abStatsForCampaign(campaignId: string) {
  const { data: steps } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .select("id, position, step_type, variants")
    .eq("campaign_id", campaignId)
    .order("position", { ascending: true });

  const { data: leads } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select("id, status, interest_outcome, ab_assignments")
    .eq("campaign_id", campaignId);

  const byStep: Record<
    string,
    Record<string, { assigned: number; interested: number; replied: number }>
  > = {};

  for (const step of steps ?? []) {
    const variants = parseStepVariants(step.variants);
    if (!variants.length) continue;
    byStep[step.id as string] = {};
    for (const v of variants) {
      byStep[step.id as string][v.key] = {
        assigned: 0,
        interested: 0,
        replied: 0,
      };
    }
  }

  for (const lead of leads ?? []) {
    const assigns = (lead.ab_assignments || {}) as Record<string, string>;
    for (const [stepId, key] of Object.entries(assigns)) {
      if (!byStep[stepId]?.[key]) continue;
      byStep[stepId][key].assigned += 1;
      const st = lead.status as string;
      if (
        st === "interested" ||
        st === "assessment_sent" ||
        st === "assessment_done" ||
        st === "call_offered" ||
        lead.interest_outcome === "positive" ||
        lead.interest_outcome === "soft"
      ) {
        byStep[stepId][key].interested += 1;
      }
      if (
        st === "replied" ||
        st === "interested" ||
        st === "assessment_sent" ||
        st === "assessment_done" ||
        st === "call_offered"
      ) {
        byStep[stepId][key].replied += 1;
      }
    }
  }

  return { steps: steps ?? [], stats: byStep };
}
