import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Lead webhook payload sent to a coach's admin-configured URL.
 *
 * - `event` is "lead_captured" when prospect supplied at least an email but
 *   the assessment has not yet completed, and "assessment_completed" when the
 *   prospect finishes the assessment (regardless of whether a partial event
 *   has already fired). The webhook is intentionally fire-and-forget on both
 *   events; downstream tools (CRMs / Zapier) should dedupe on `contact_id`.
 * - `total_score` is only included on completion.
 */
export type LeadWebhookEvent = "lead_captured" | "assessment_completed";

export type LeadWebhookContactPayload = {
  contact_id: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  business_name: string | null;
};

export type LeadWebhookPayload = {
  event: LeadWebhookEvent;
  coach_slug: string | null;
  coach_id: string;
  contact: LeadWebhookContactPayload;
  total_score?: number;
  assessment_id?: string;
  source?: string | null;
  fired_at: string;
};

/**
 * Loads the coach's webhook URL by id. Returns null when no URL is configured
 * or the column is missing (e.g. migration hasn't run yet).
 */
export async function getCoachLeadWebhookUrl(
  coachId: string
): Promise<string | null> {
  const res = await supabaseAdmin
    .from("coaches")
    .select("lead_webhook_url")
    .eq("id", coachId)
    .maybeSingle();
  if (res.error) return null;
  const url = (res.data as { lead_webhook_url?: string | null } | null)
    ?.lead_webhook_url;
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

/**
 * Fires the lead webhook in the background. Never throws; failures are logged
 * but must not break the calling request, since prospects must always be able
 * to finish the assessment regardless of webhook state.
 *
 * Returns the awaitable promise so tests can opt-in to waiting; callers in
 * route handlers should ignore the return value.
 */
export async function fireLeadWebhook(
  url: string,
  payload: LeadWebhookPayload
): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) {
        console.warn(
          `lead webhook responded ${res.status} for coach ${payload.coach_id} event=${payload.event}`
        );
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.warn("lead webhook failed:", err);
  }
}
