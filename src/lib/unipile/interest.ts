import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildPersonalisedAssessmentLink,
  buildPersonalisedAssessmentProLink,
} from "@/lib/assessmentContactParams";
import type { AbVariantStats } from "@/lib/unipile/abMetrics";
import {
  sanitizeMessageMediaPatch,
  type CampaignStepMedia,
  type CampaignStepMediaKind,
} from "@/lib/unipile/campaignStepTypes";

export type InterestOutcome = "positive" | "soft" | "negative" | "unclear";

export type ReplySentiment = "positive" | "negative" | "other";

export type ReplyCounts = {
  positive: number;
  negative: number;
  other: number;
};

export function emptyReplyCounts(): ReplyCounts {
  return { positive: 0, negative: 0, other: 0 };
}

/** One exclusive bucket per lead that has replied or been scored. */
export function classifyLeadReply(
  status: string | null | undefined,
  interestOutcome: string | null | undefined
): ReplySentiment | null {
  const outcome = (interestOutcome || "").toLowerCase();
  const s = status || "";
  if (
    outcome === "positive" ||
    s === "interested" ||
    s === "assessment_sent" ||
    s === "assessment_done" ||
    s === "call_offered"
  ) {
    return "positive";
  }
  if (outcome === "negative") return "negative";
  if (outcome === "soft" || outcome === "unclear" || s === "replied") {
    return "other";
  }
  return null;
}

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

export async function buildLeadAssessmentProUrl(input: {
  coachId: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  email?: string | null;
}): Promise<string | null> {
  const slug = await resolveCoachSlug(input.coachId);
  if (!slug) return null;
  return buildPersonalisedAssessmentProLink({
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
  /** When the caller already wrote contacts.reply_disposition. */
  skipContactSync?: boolean;
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
        input.outcome === "positive" ||
        input.outcome === "soft" ||
        input.outcome === "negative"
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

  if (
    input.outcome === "positive" ||
    input.outcome === "soft" ||
    input.outcome === "negative"
  ) {
    const { cancelOpenSendJobs } = await import("@/lib/unipile/remindQueue");
    const reason =
      input.outcome === "negative"
        ? "Paused — not interested"
        : "Paused — interested reply logged";
    await cancelOpenSendJobs(input.leadId, reason);
  }

  if (!input.skipContactSync) {
    const { data: leadContact } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("contact_id")
      .eq("id", input.leadId)
      .maybeSingle();
    const contactId = (leadContact?.contact_id as string | null) ?? null;
    if (contactId) {
      const { applyContactReplyDisposition, dispositionFromInterestOutcome } =
        await import("@/lib/prospects/replyDisposition");
      const disposition = dispositionFromInterestOutcome(input.outcome);
      if (disposition) {
        await applyContactReplyDisposition({
          coachId: input.coachId,
          contactId,
          disposition,
        });
      }
    }
  }

  if (nextStatus === "interested" && updated?.campaign_id) {
    const { data: names } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("first_name, last_name")
      .eq("id", input.leadId)
      .maybeSingle();
    const { fireCoachWatchRulesSafe } = await import("@/lib/coachWatch/fire");
    fireCoachWatchRulesSafe({
      coachId: input.coachId,
      scopeKind: "campaign",
      scopeId: String(updated.campaign_id),
      event: "interested",
      personName: [names?.first_name, names?.last_name].filter(Boolean).join(" "),
    });
  }

  return updated;
}

/** Remove a reply mark so the coach can choose again. */
export async function clearLeadInterest(input: {
  coachId: string;
  leadId: string;
  skipContactSync?: boolean;
}) {
  const { data: lead, error } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select(
      "id, coach_id, campaign_id, status, funnel_events, interest_outcome, contact_id"
    )
    .eq("id", input.leadId)
    .eq("coach_id", input.coachId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead) throw new Error("Lead not found.");

  const currentStatus = (lead.status as string) || "";
  const nextStatus = currentStatus === "interested" ? "replied" : currentStatus;

  const { data: updated, error: upErr } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .update({
      interest_outcome: null,
      interest_logged_at: null,
      status: nextStatus,
      funnel_events: appendFunnelEvent(lead.funnel_events, {
        type: "interest_cleared",
        meta: { status: nextStatus },
      }),
    })
    .eq("id", input.leadId)
    .select(
      "id, status, interest_outcome, interest_note, interest_logged_at, funnel_events, campaign_id"
    )
    .maybeSingle();
  if (upErr) throw new Error(upErr.message);

  if (!input.skipContactSync) {
    const contactId = (lead.contact_id as string | null) ?? null;
    if (contactId) {
      const { clearContactReplyDisposition } = await import(
        "@/lib/prospects/replyDisposition"
      );
      await clearContactReplyDisposition({
        coachId: input.coachId,
        contactId,
      });
    }
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

  const { cancelOpenSendJobs } = await import("@/lib/unipile/remindQueue");
  await cancelOpenSendJobs(input.leadId, `Paused — ${input.status}`);

  if (input.status === "interested") {
    const { data: leadRow } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("campaign_id, first_name, last_name")
      .eq("id", input.leadId)
      .maybeSingle();
    if (leadRow?.campaign_id) {
      const { fireCoachWatchRulesSafe } = await import("@/lib/coachWatch/fire");
      fireCoachWatchRulesSafe({
        coachId: input.coachId,
        scopeKind: "campaign",
        scopeId: String(leadRow.campaign_id),
        event: "interested",
        personName: [leadRow.first_name, leadRow.last_name]
          .filter(Boolean)
          .join(" "),
      });
    }
  }

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

export type StepVariant = {
  key: string;
  label?: string;
  body: string;
  media_kind?: CampaignStepMediaKind | null;
  media?: CampaignStepMedia | null;
};

export function parseStepVariants(raw: unknown): StepVariant[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => {
      if (!v || typeof v !== "object") return null;
      const r = v as Record<string, unknown>;
      const key = String(r.key || "").trim();
      if (!key) return null;
      const body = String(r.body || "");
      const hasMedia = "media_kind" in r || "media" in r;
      const mediaFields = hasMedia
        ? sanitizeMessageMediaPatch({
            media_kind: r.media_kind,
            media: r.media,
          })
        : {};
      return {
        key,
        label: typeof r.label === "string" ? r.label : undefined,
        body,
        ...mediaFields,
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
  preferredVariantKey?: string | null;
}): Promise<{
  body: string;
  variantKey: string | null;
  variant: StepVariant | null;
}> {
  const variants = parseStepVariants(input.variants);
  if (!variants.length) {
    return {
      body: (input.body || "").trim(),
      variantKey: null,
      variant: null,
    };
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
    const preferred = input.preferredVariantKey?.trim();
    key =
      preferred && variants.some((v) => v.key === preferred)
        ? preferred
        : variants[Math.floor(Math.random() * variants.length)].key;
    assignments[input.stepId] = key;
    await supabaseAdmin
      .from("linkedin_campaign_leads")
      .update({ ab_assignments: assignments })
      .eq("id", input.leadId);
  }

  const chosen = variants.find((v) => v.key === key) || variants[0];
  return { body: chosen.body, variantKey: key, variant: chosen };
}

export async function abStatsForCampaign(campaignId: string) {
  const CONNECTED_STATUSES = new Set([
    "connected",
    "in_sequence",
    "replied",
    "interested",
    "assessment_sent",
    "assessment_done",
    "call_offered",
    "completed",
  ]);
  const { data: steps } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .select("id, position, step_type, variants")
    .eq("campaign_id", campaignId)
    .order("position", { ascending: true });

  const { data: leads } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select("id, status, interest_outcome, ab_assignments")
    .eq("campaign_id", campaignId);

  const byStep: Record<string, Record<string, AbVariantStats>> = {};

  for (const step of steps ?? []) {
    const variants = parseStepVariants(step.variants);
    if (!variants.length) continue;
    byStep[step.id as string] = {};
    for (const v of variants) {
      byStep[step.id as string][v.key] = {
        assigned: 0,
        interested: 0,
        replied: 0,
        connected: 0,
        booked: 0,
      };
    }
  }

  for (const lead of leads ?? []) {
    const assigns = (lead.ab_assignments || {}) as Record<string, string>;
    for (const [stepId, key] of Object.entries(assigns)) {
      if (!byStep[stepId]?.[key]) continue;
      const row = byStep[stepId][key];
      row.assigned += 1;
      const st = lead.status as string;
      if (
        st === "interested" ||
        st === "assessment_sent" ||
        st === "assessment_done" ||
        st === "call_offered" ||
        lead.interest_outcome === "positive" ||
        lead.interest_outcome === "soft"
      ) {
        row.interested += 1;
      }
      if (
        st === "replied" ||
        st === "interested" ||
        st === "assessment_sent" ||
        st === "assessment_done" ||
        st === "call_offered"
      ) {
        row.replied += 1;
      }
      if (CONNECTED_STATUSES.has(st)) row.connected += 1;
      if (st === "call_offered") row.booked += 1;
    }
  }

  return { steps: steps ?? [], stats: byStep };
}
