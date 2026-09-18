import { canonicalizeProspectStatus } from "@/lib/prospectStatus";
import type { InterestOutcome } from "@/lib/unipile/interest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const REPLY_DISPOSITIONS = [
  "interested",
  "neutral",
  "not_interested",
] as const;

export type ReplyDisposition = (typeof REPLY_DISPOSITIONS)[number];

const PIPELINE_LOCK = new Set(["booked", "rebook", "won"]);

export function isReplyDisposition(
  value: string | null | undefined
): value is ReplyDisposition {
  return (
    value === "interested" ||
    value === "neutral" ||
    value === "not_interested"
  );
}

export function interestOutcomeForDisposition(
  disposition: ReplyDisposition
): InterestOutcome {
  switch (disposition) {
    case "interested":
      return "positive";
    case "neutral":
      return "soft";
    case "not_interested":
      return "negative";
  }
}

export function dispositionFromInterestOutcome(
  outcome: string | null | undefined
): ReplyDisposition | null {
  const key = (outcome || "").toLowerCase();
  if (key === "positive") return "interested";
  if (key === "soft") return "neutral";
  if (key === "negative") return "not_interested";
  return null;
}

/** Pipeline column to move into, unless the person is already booked/won. */
export function prospectStatusForDisposition(
  disposition: ReplyDisposition,
  currentStatus: string | null | undefined
): string | null {
  const canonical = canonicalizeProspectStatus(currentStatus);
  if (canonical && PIPELINE_LOCK.has(canonical)) return null;
  switch (disposition) {
    case "interested":
      return "interested";
    case "neutral":
      return "follow_up";
    case "not_interested":
      return "lost";
  }
}

export function inferReplyDisposition(input: {
  replyDisposition?: string | null;
  prospectStatus?: string | null;
  interestOutcome?: string | null;
}): ReplyDisposition | null {
  if (isReplyDisposition(input.replyDisposition)) return input.replyDisposition;
  const fromOutcome = dispositionFromInterestOutcome(input.interestOutcome);
  if (fromOutcome) return fromOutcome;
  const status = canonicalizeProspectStatus(input.prospectStatus);
  if (status === "interested") return "interested";
  if (status === "follow_up") return "neutral";
  if (status === "lost" || status === "abandoned") return "not_interested";
  return null;
}

/**
 * Persist reply classification on the contact and shift pipeline status when
 * they are still in the open funnel.
 */
export async function applyContactReplyDisposition(input: {
  coachId: string;
  contactId: string;
  disposition: ReplyDisposition;
}): Promise<{ prospect_status: string | null; reply_disposition: ReplyDisposition }> {
  const { data: contact, error } = await supabaseAdmin
    .from("contacts")
    .select("id, prospect_status")
    .eq("id", input.contactId)
    .eq("coach_id", input.coachId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!contact) throw new Error("Prospect not found.");

  const nextStatus = prospectStatusForDisposition(
    input.disposition,
    (contact.prospect_status as string | null) ?? null
  );
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    reply_disposition: input.disposition,
    reply_disposition_at: now,
  };
  if (nextStatus) patch.prospect_status = nextStatus;

  const { data: updated, error: upErr } = await supabaseAdmin
    .from("contacts")
    .update(patch)
    .eq("id", input.contactId)
    .eq("coach_id", input.coachId)
    .select("prospect_status, reply_disposition")
    .maybeSingle();
  if (upErr) {
    if (upErr.code === "42703" || upErr.code === "PGRST204") {
      if (nextStatus) {
        const { error: statusErr } = await supabaseAdmin
          .from("contacts")
          .update({ prospect_status: nextStatus })
          .eq("id", input.contactId)
          .eq("coach_id", input.coachId);
        if (statusErr) throw new Error(statusErr.message);
      }
      return {
        prospect_status: nextStatus ?? ((contact.prospect_status as string | null) ?? null),
        reply_disposition: input.disposition,
      };
    }
    throw new Error(upErr.message);
  }

  return {
    prospect_status:
      (updated?.prospect_status as string | null) ??
      nextStatus ??
      ((contact.prospect_status as string | null) ?? null),
    reply_disposition: input.disposition,
  };
}

const OPEN_LEAD_STATUSES = [
  "invited",
  "connected",
  "in_sequence",
  "replied",
  "interested",
  "assessment_sent",
  "assessment_done",
  "call_offered",
];

/** Mark the reply on the contact and any open campaign leads for them. */
export async function applyReplyDisposition(input: {
  coachId: string;
  contactId?: string | null;
  unipileChatId?: string | null;
  disposition: ReplyDisposition;
}): Promise<{
  prospect_status: string | null;
  reply_disposition: ReplyDisposition;
  lead_ids: string[];
}> {
  let prospectStatus: string | null = null;
  if (input.contactId) {
    const contact = await applyContactReplyDisposition({
      coachId: input.coachId,
      contactId: input.contactId,
      disposition: input.disposition,
    });
    prospectStatus = contact.prospect_status;
  }

  const leadIds = new Set<string>();
  if (input.contactId) {
    const { data, error } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("id")
      .eq("coach_id", input.coachId)
      .eq("contact_id", input.contactId)
      .in("status", OPEN_LEAD_STATUSES);
    if (error && error.code !== "42703" && error.code !== "PGRST204") {
      throw new Error(error.message);
    }
    for (const row of data ?? []) {
      if (row.id) leadIds.add(row.id as string);
    }
  }
  if (input.unipileChatId) {
    const { data, error } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("id")
      .eq("coach_id", input.coachId)
      .eq("unipile_chat_id", input.unipileChatId)
      .in("status", OPEN_LEAD_STATUSES);
    if (error && error.code !== "42703" && error.code !== "PGRST204") {
      throw new Error(error.message);
    }
    for (const row of data ?? []) {
      if (row.id) leadIds.add(row.id as string);
    }
  }

  if (leadIds.size) {
    const { logLeadInterest } = await import("@/lib/unipile/interest");
    const outcome = interestOutcomeForDisposition(input.disposition);
    for (const leadId of leadIds) {
      await logLeadInterest({
        coachId: input.coachId,
        leadId,
        outcome,
        skipContactSync: true,
      });
    }
  }

  return {
    prospect_status: prospectStatus,
    reply_disposition: input.disposition,
    lead_ids: [...leadIds],
  };
}
