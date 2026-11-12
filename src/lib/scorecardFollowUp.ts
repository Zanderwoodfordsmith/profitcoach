/**
 * BOSS Score report and follow-up emails sent by the app (job 214, 12 Nov).
 *
 * Each coach chooses who sends them: the app (their own Gmail or Outlook) or
 * their old CRM (the lead webhook). Not chosen yet = old CRM when a lead
 * webhook is set, otherwise the app, so nobody gets the same email twice.
 *
 * Finishing adds the person to the coach's "Completed" sequence; stopping part
 * way adds them to "Started, not finished". A coach with no email connected
 * still gets the report email out, from support@ in the coach's name.
 */
import { BCA_SUPPORT_EMAIL } from "@/config/businessContact";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ScorecardEmailSender = "app" | "crm";
export type ScorecardKind = "boss_scorecard" | "diagnostic_50";
type SequenceEvent = "started" | "completed";

/** Name of the call in the emails when the coach's report calendar has none. */
export const DEFAULT_REVIEW_CALL_NAME = "Constraint Call";

const SEQUENCE_PLAYBOOKS: Record<ScorecardKind, Record<SequenceEvent, string>> = {
  boss_scorecard: { started: "scorecard-incomplete", completed: "scorecard-complete" },
  diagnostic_50: { started: "scorecard-pro-incomplete", completed: "scorecard-pro-complete" },
};

const ALL_SEQUENCE_PLAYBOOKS = Object.values(SEQUENCE_PLAYBOOKS).flatMap((p) => Object.values(p));

export function resolveScorecardEmailSender(row: {
  scorecard_email_sender?: string | null;
  lead_webhook_url?: string | null;
}): ScorecardEmailSender {
  if (row.scorecard_email_sender === "app" || row.scorecard_email_sender === "crm") {
    return row.scorecard_email_sender;
  }
  return row.lead_webhook_url?.trim() ? "crm" : "app";
}

export async function loadScorecardEmailSender(coachId: string): Promise<{
  sender: ScorecardEmailSender;
  chosen: boolean;
  hasCrmLink: boolean;
}> {
  const { data } = await supabaseAdmin
    .from("coaches")
    .select("scorecard_email_sender, lead_webhook_url")
    .eq("id", coachId)
    .maybeSingle();
  const row = (data ?? {}) as { scorecard_email_sender?: string | null; lead_webhook_url?: string | null };
  return {
    sender: resolveScorecardEmailSender(row),
    chosen: row.scorecard_email_sender === "app" || row.scorecard_email_sender === "crm",
    hasCrmLink: Boolean(row.lead_webhook_url?.trim()),
  };
}

/** The call named in the emails: the same calendar the report page books into. */
export async function reviewCallName(coachId: string): Promise<string> {
  const { ASSESSMENT_BOOKING_CALENDAR_SLUG } = await import("@/lib/booking/coachBookingProvider");
  const { data } = await supabaseAdmin
    .from("coach_calendars")
    .select("name")
    .eq("coach_id", coachId)
    .eq("slug", ASSESSMENT_BOOKING_CALENDAR_SLUG)
    .maybeSingle();
  return (data?.name as string | null)?.trim() || DEFAULT_REVIEW_CALL_NAME;
}

async function findSequenceCampaign(coachId: string, playbookId: string) {
  const { data } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id, status")
    .eq("coach_id", coachId)
    .eq("source_playbook_id", playbookId)
    .neq("status", "archived")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id as string, status: String(data.status || "") } : null;
}

async function ensureSequenceCampaign(coachId: string, playbookId: string) {
  const found = await findSequenceCampaign(coachId, playbookId);
  if (found) return found;
  const { ensureDefaultCampaigns } = await import("@/lib/unipile/defaultCampaigns");
  await ensureDefaultCampaigns(coachId);
  return findSequenceCampaign(coachId, playbookId);
}

async function hasFinished(contactId: string, kind: ScorecardKind): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("assessments")
    .select("id")
    .eq("contact_id", contactId)
    .eq("assessment_type", kind)
    .not("completed_at", "is", null)
    .limit(1);
  return Boolean(data?.length);
}

/**
 * Start the right sequence after someone finishes or leaves the scorecard.
 * Never throws: the person taking the scorecard must never see an error.
 */
export async function startScorecardFollowUp(input: {
  coachId: string;
  contactId: string | null;
  kind: ScorecardKind;
  event: SequenceEvent;
}): Promise<void> {
  const { coachId, contactId, kind, event } = input;
  if (!contactId) return;
  try {
    const { sender } = await loadScorecardEmailSender(coachId);
    if (sender !== "app") return;
    if (event === "started" && (await hasFinished(contactId, kind))) return;

    const { resolveAccountIdForChannel } = await import("@/lib/messaging/startConversation");
    const emailAccount = await resolveAccountIdForChannel(coachId, "email");
    if (!emailAccount) {
      // No email connected: keep the "we'll send your score" promise from support@.
      if (event === "completed" && kind === "boss_scorecard") {
        await sendReportEmailFromSupport({ coachId, contactId });
      }
      return;
    }

    const campaigns = await import("@/lib/unipile/campaigns");
    if (event === "completed") {
      const started = await findSequenceCampaign(coachId, SEQUENCE_PLAYBOOKS[kind].started);
      if (started) {
        await campaigns.removeContactFromCampaign(coachId, started.id, contactId).catch(() => undefined);
      }
    }

    const campaign = await ensureSequenceCampaign(coachId, SEQUENCE_PLAYBOOKS[kind][event]);
    if (!campaign) {
      console.error("scorecard follow-up: no sequence campaign", { coachId, kind, event });
      return;
    }
    if (campaign.status !== "running") {
      await campaigns.setCampaignStatus(coachId, campaign.id, "running");
    }
    await campaigns.enrollContactInCampaign(coachId, campaign.id, contactId);
  } catch (err) {
    console.error("scorecard follow-up failed:", err, { coachId, contactId, kind, event });
  }
}

/** A booked call ends the scorecard emails (the coach takes it from there). */
export async function stopScorecardFollowUp(coachId: string, contactId: string | null): Promise<void> {
  if (!contactId) return;
  try {
    const { data: camps } = await supabaseAdmin
      .from("linkedin_campaigns")
      .select("id")
      .eq("coach_id", coachId)
      .in("source_playbook_id", ALL_SEQUENCE_PLAYBOOKS);
    const campaignIds = (camps ?? []).map((c) => c.id as string);
    if (!campaignIds.length) return;
    const { data: leads } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("id, campaign_id, status")
      .eq("coach_id", coachId)
      .eq("contact_id", contactId)
      .in("campaign_id", campaignIds)
      .in("status", ["queued", "in_sequence"]);
    if (!leads?.length) return;
    const { pauseCampaignLeads } = await import("@/lib/unipile/campaigns");
    const byCampaign = new Map<string, string[]>();
    for (const lead of leads) {
      const list = byCampaign.get(lead.campaign_id as string) ?? [];
      list.push(lead.id as string);
      byCampaign.set(lead.campaign_id as string, list);
    }
    for (const [campaignId, ids] of byCampaign) {
      await pauseCampaignLeads(coachId, campaignId, ids);
    }
  } catch (err) {
    console.error("scorecard follow-up stop failed:", err, { coachId, contactId });
  }
}

/** Email 1 (the report) from support@, in the coach's name, for coaches with no email connected. */
async function sendReportEmailFromSupport(input: { coachId: string; contactId: string }) {
  const { coachId, contactId } = input;
  const { data: contact } = await supabaseAdmin
    .from("contacts")
    .select("email, full_name")
    .eq("id", contactId)
    .eq("coach_id", coachId)
    .maybeSingle();
  const email = (contact?.email as string | null)?.trim();
  if (!email || /@noemail\.local$/i.test(email)) return;

  const { isUnipileConfigured, sendUnipileEmail } = await import("@/lib/unipile/client");
  if (!isUnipileConfigured()) return;
  const { getSupportMailboxAccount } = await import("@/lib/support/mailbox");
  const mailbox = await getSupportMailboxAccount();
  if (!mailbox || (mailbox.status && mailbox.status !== "OK")) {
    console.error("scorecard report email: support mailbox not connected", { coachId });
    return;
  }

  const { data: coachRow } = await supabaseAdmin
    .from("profiles")
    .select("full_name, first_name")
    .eq("id", coachId)
    .maybeSingle();
  const coachName = (coachRow?.full_name as string | null)?.trim() || (coachRow?.first_name as string | null)?.trim() || "";

  // The coach's own edited email 1 when they have one, else the standard copy.
  const campaign = await findSequenceCampaign(coachId, SEQUENCE_PLAYBOOKS.boss_scorecard.completed);
  let body = "";
  let variants: unknown = null;
  if (campaign) {
    const { data: step } = await supabaseAdmin
      .from("linkedin_campaign_steps")
      .select("body, variants")
      .eq("campaign_id", campaign.id)
      .eq("step_type", "email")
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    body = (step?.body as string | null) ?? "";
    variants = step?.variants ?? null;
  }
  if (!body.trim()) {
    const { SCORECARD_COMPLETE_PLAYBOOK } = await import("@/lib/unipile/playbooks/scorecardSequences");
    const first = SCORECARD_COMPLETE_PLAYBOOK.steps.find((s) => s.step_type === "email");
    body = first?.body ?? "";
    variants = first?.variants ?? null;
  }
  if (!body.trim()) return;

  const { loadScorecardOutreachVars } = await import("@/lib/unipile/scorecardVars");
  const vars = await loadScorecardOutreachVars({ coachId, contactId });
  if (!vars?.boss_score_report_link) return;

  const { resolveStepBodyForLead } = await import("@/lib/unipile/interest");
  const picked = await resolveStepBodyForLead({
    leadId: "",
    stepId: "",
    body,
    variants,
    abAssignments: null,
    preferredVariantKey: vars.business_level_number || null,
  });

  const { splitFullName } = await import("@/lib/splitFullName");
  const { first_name, last_name } = splitFullName((contact?.full_name as string | null) ?? "");
  const { buildMessageBody } = await import("@/lib/unipile/campaigns");
  const rendered = buildMessageBody(
    picked.body,
    { first_name: first_name ?? null, last_name: last_name ?? null },
    { ...vars, coach_name: coachName, review_name: await reviewCallName(coachId) }
  );
  const { unpackEmailBody } = await import("@/lib/unipile/playbookSteps");
  const unpacked = unpackEmailBody(rendered);

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(coachId);
  const coachEmail = authUser.user?.email?.trim();
  const base = {
    account_id: mailbox.unipile_account_id,
    to: [{ identifier: email, ...(contact?.full_name ? { display_name: String(contact.full_name) } : {}) }],
    subject: unpacked.subject,
    body: (await import("@/lib/email/plainEmailHtml")).plainEmailToHtml(unpacked.body),
  };
  const from = {
    identifier: BCA_SUPPORT_EMAIL,
    display_name: coachName ? `${coachName} via Profit Coach` : "Profit Coach",
  };
  // Replies should reach the coach. Gmail can refuse a custom From or header, so step down like support replies do.
  let sent = await sendUnipileEmail({
    ...base,
    from,
    ...(coachEmail ? { custom_headers: [{ name: "Reply-To", value: coachEmail }] } : {}),
  });
  if (!sent.ok && coachEmail) sent = await sendUnipileEmail({ ...base, from });
  if (!sent.ok) sent = await sendUnipileEmail(base);
  if (!sent.ok) console.error("scorecard report email failed:", sent.error, { coachId, contactId });
}
