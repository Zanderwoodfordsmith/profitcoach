/**
 * Notify GHL when someone pays for programme join via Stripe.
 * Flat JSON — GHL inbound webhooks only map top-level keys.
 */

import { splitFullName } from "@/lib/splitFullName";

export const PROGRAMME_JOIN_GHL_WEBHOOK_URL =
  process.env.PROGRAMME_JOIN_GHL_WEBHOOK_URL?.trim() ||
  "https://services.leadconnectorhq.com/hooks/BsRxKtV0lVHcvvZ6qHtu/webhook-trigger/6b32ca51-6365-4f28-95aa-7fb65c4f7124";

export type ProgrammeJoinGhlPayload = {
  event: "programme_joined";
  status: "programme_joined";
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string;
  phone: string | null;
  coach_id: string | null;
  slug: string | null;
  stripe_session_id: string | null;
  source: "stripe_checkout";
  fired_at: string;
};

export function buildProgrammeJoinGhlPayload(input: {
  email: string;
  fullName: string;
  phone?: string | null;
  coachId?: string | null;
  slug?: string | null;
  stripeSessionId?: string | null;
}): ProgrammeJoinGhlPayload {
  const { first_name, last_name } = splitFullName(input.fullName);
  return {
    event: "programme_joined",
    status: "programme_joined",
    first_name: first_name || null,
    last_name: last_name || null,
    full_name: input.fullName.trim() || null,
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || null,
    coach_id: input.coachId?.trim() || null,
    slug: input.slug?.trim() || null,
    stripe_session_id: input.stripeSessionId?.trim() || null,
    source: "stripe_checkout",
    fired_at: new Date().toISOString(),
  };
}

/** Fire-and-forget; never throws to the caller. */
export async function notifyProgrammeJoinGhl(
  input: Parameters<typeof buildProgrammeJoinGhlPayload>[0]
): Promise<{ ok: boolean; status?: number; body?: string }> {
  const url = PROGRAMME_JOIN_GHL_WEBHOOK_URL;
  if (!url) {
    return { ok: false, body: "missing webhook url" };
  }

  const payload = buildProgrammeJoinGhlPayload(input);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.text().catch(() => "");
    if (!res.ok) {
      console.warn(
        "[programmeJoinGhl] webhook failed",
        res.status,
        body.slice(0, 300)
      );
      return { ok: false, status: res.status, body };
    }
    return { ok: true, status: res.status, body };
  } catch (error) {
    console.warn("[programmeJoinGhl] webhook error", error);
    return {
      ok: false,
      body: error instanceof Error ? error.message : "webhook error",
    };
  }
}
