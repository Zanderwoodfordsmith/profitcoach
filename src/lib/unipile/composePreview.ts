import { nextActionStep } from "@/lib/unipile/campaignLeadActivity";
import { renderPreviewForJob } from "@/lib/unipile/remindQueue";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ComposePreviewChannel =
  | "email"
  | "whatsapp"
  | "linkedin"
  | "instagram"
  | "messenger";

export type LeadComposePreview = {
  body: string;
  channel: ComposePreviewChannel | null;
  stepType: string | null;
};

/** Inbox composer channel for a campaign step the coach is about to send. */
export function composeChannelForStep(
  stepType: string,
  campaignChannel?: string | null
): ComposePreviewChannel | null {
  if (stepType === "email") return "email";
  if (stepType === "whatsapp") return "whatsapp";
  if (stepType === "messenger") return "messenger";
  if (stepType === "instagram") return "instagram";
  if (stepType === "message" && campaignChannel === "email") return "email";
  if (stepType === "message" || stepType === "invite") return "linkedin";
  return null;
}

type StepRow = {
  id: string;
  position: number;
  body: string | null;
  fallback_body: string | null;
  variants: unknown;
  step_type: string;
  config: unknown;
};

/**
 * The next message this lead should send, rendered with their name filled in.
 * Finished leads return an empty body so the contact page just opens the thread.
 */
export async function loadLeadComposePreview(
  coachId: string,
  leadId: string
): Promise<LeadComposePreview | null> {
  if (!UUID_RE.test(leadId)) return null;

  const { data: lead, error } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select(
      "id, campaign_id, contact_id, first_name, last_name, company, title, linkedin_url, status, current_step_position, ab_assignments"
    )
    .eq("id", leadId)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead) return null;

  const { data: campaign } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id, channel")
    .eq("id", lead.campaign_id)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (!campaign) return null;

  const campaignChannel = (campaign.channel as string | null) ?? null;
  const { data: jobs } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .select("id, step_id, draft_body, status, scheduled_for")
    .eq("coach_id", coachId)
    .eq("lead_id", leadId)
    .in("status", ["awaiting_coach", "pending"])
    .order("scheduled_for", { ascending: true })
    .limit(8);

  const openJob = [...(jobs ?? [])].sort((a, b) => {
    if (a.status === b.status) {
      return String(a.scheduled_for).localeCompare(String(b.scheduled_for));
    }
    return a.status === "awaiting_coach" ? -1 : 1;
  })[0];

  let step: StepRow | null = null;
  let draftBody: string | null = null;
  if (openJob?.step_id) {
    const { data: stepRow } = await supabaseAdmin
      .from("linkedin_campaign_steps")
      .select("id, position, body, fallback_body, variants, step_type, config")
      .eq("id", openJob.step_id)
      .maybeSingle();
    step = (stepRow as StepRow | null) ?? null;
    draftBody = (openJob.draft_body as string | null) ?? null;
  }

  if (!step) {
    const { data: steps } = await supabaseAdmin
      .from("linkedin_campaign_steps")
      .select("id, position, body, fallback_body, variants, step_type, config")
      .eq("campaign_id", lead.campaign_id)
      .order("position", { ascending: true });
    const rows = (steps ?? []) as StepRow[];
    const next = nextActionStep(
      {
        id: lead.id as string,
        status: String(lead.status || "queued"),
        current_step_position: Number(lead.current_step_position ?? 0),
        linkedin_url: (lead.linkedin_url as string | null) ?? null,
        first_name: (lead.first_name as string | null) ?? null,
        last_name: (lead.last_name as string | null) ?? null,
        company: (lead.company as string | null) ?? null,
        last_error: null,
      },
      rows.map((row) => ({
        id: row.id,
        position: row.position,
        step_type: row.step_type,
        config: row.config,
      }))
    );
    step = next?.id ? rows.find((row) => row.id === next.id) ?? null : null;
  }

  const stepType = step ? String(step.step_type || "") : null;
  const channel = stepType
    ? composeChannelForStep(stepType, campaignChannel)
    : null;
  if (!step || !channel) {
    return { body: "", channel: null, stepType };
  }

  const body = (
    await renderPreviewForJob({
      coachId,
      lead: lead as Record<string, unknown>,
      step: step as unknown as Record<string, unknown>,
      draftBody,
    })
  ).trim();

  if (!body) return { body: "", channel: null, stepType };
  return { body, channel, stepType };
}
